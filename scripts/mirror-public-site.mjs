/**
 * Mirrors same-origin responses from CUSTOM_DOMAIN/public site into a local folder.
 * Usage: node scripts/mirror-public-site.mjs [outputDir]
 * Requires Node 18+ (global fetch).
 */
import fs from "fs/promises";
import path from "path";

const SITE = "https://studio.ads2wallet.com";
const SITE_HOST = new URL(SITE).hostname;
/** Public script/style CDNs referenced by the SPA (offline bundle). */
const EXTERNAL_MIRROR_HOSTS = /** @type {string[]} */ (["cdnjs.cloudflare.com"]);
const MAX_PAGES = 800;
const CONCURRENCY = 6;

const OUT = path.resolve(process.argv[2] || path.join(process.cwd(), "studio-ads2wallet-static-mirror"));

const SEEDS = ["/", "/dashboard/", "/motor-k", "/motor-k/"];

const visited = new Set();
/** Dedup identical responses after redirects (e.g. / → /dashboard/). */
const seenFinal = new Set();
/** @type {string[]} */
const queue = SEEDS.map((p) => canonicalKey(stripHash(new URL(p, SITE).href)));

function stripHash(u) {
  const i = u.indexOf("#");
  return i === -1 ? u : u.slice(0, i);
}

/**
 * Treat /path and /path/ as one URL for dedup.
 * @param {string} urlStr
 */
function canonicalKey(urlStr) {
  const u = new URL(urlStr);
  if (u.pathname !== "/" && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }
  return u.origin + u.pathname + u.search;
}

/**
 * Skip template fragments and obvious non-URLs from inline dashboard JS.
 * @param {string} raw
 */
function looksLikeStaticRef(raw) {
  const t = raw.trim();
  if (!t || t.startsWith("#") || t.startsWith("javascript:") || t.startsWith("mailto:")) return false;
  if (t.includes("${") || t.includes("{{") || t.includes("(%") || t.includes(" esc(")) return false;
  return true;
}

/**
 * @param {string} hostname
 */
function mirrorHost(hostname) {
  return hostname === SITE_HOST || EXTERNAL_MIRROR_HOSTS.includes(hostname);
}

/**
 * @param {string} hostname
 * @param {string} pathname
 */
function blockPath(hostname, pathname) {
  return hostname === SITE_HOST && pathname.startsWith("/api");
}

/**
 * @param {string} pathname
 */
function htmlRelPath(pathname) {
  let p = pathname.replace(/^\/+/, "");
  if (!p) return "index.html";
  if (p.endsWith("/")) return path.join(p, "index.html");
  if (!path.posix.extname("/" + p)) return path.join(p, "index.html");
  return p;
}

/**
 * @param {string} pathname
 * @param {string} contentType
 */
function diskRelPath(pathname, contentType) {
  const ext = path.posix.extname(pathname).toLowerCase();
  const ct = (contentType || "").toLowerCase();
  if (ext === ".css" || ext === ".js" || /\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|map)$/.test(ext)) {
    return pathname.replace(/^\/+/, "");
  }
  if (ct.includes("text/html")) {
    return htmlRelPath(pathname);
  }
  return pathname.replace(/^\/+/, "") || "index.bin";
}

/**
 * @param {string} finalUrl
 * @param {string} contentType
 */
function diskPathForFetched(finalUrl, contentType) {
  const u = new URL(finalUrl);
  const pathname = u.pathname;
  if (u.hostname === SITE_HOST) {
    return diskRelPath(pathname, contentType);
  }
  const segs = pathname.split("/").filter(Boolean);
  return path.posix.join("_vendor", u.hostname, ...segs);
}

/**
 * @param {string} body
 * @param {string} baseUrl
 */
function extractFromHtml(body, baseUrl) {
  const out = new Set();
  const re = /(?:src|href)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(body))) {
    if (!looksLikeStaticRef(m[1])) continue;
    try {
      const u = new URL(m[1], baseUrl);
      if (!mirrorHost(u.hostname) || blockPath(u.hostname, u.pathname)) continue;
      const p = u.pathname;
      if (p.includes("$") || p.includes("%24") || p.includes("%7B")) continue;
      out.add(stripHash(u.origin + u.pathname + u.search));
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * @param {string} body
 * @param {string} baseUrl
 */
function extractFromCss(body, baseUrl) {
  const out = new Set();
  const re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let m;
  while ((m = re.exec(body))) {
    const raw = m[1].trim();
    if (raw.startsWith("data:") || !looksLikeStaticRef(raw)) continue;
    try {
      const u = new URL(raw, baseUrl);
      if (!mirrorHost(u.hostname) || blockPath(u.hostname, u.pathname)) continue;
      if (u.pathname.includes("$") || u.pathname.includes("%24")) continue;
      out.add(stripHash(u.origin + u.pathname + u.search));
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * @param {string} urlStr
 */
async function fetchOne(urlStr) {
  const res = await fetch(urlStr, {
    redirect: "follow",
    headers: {
      "user-agent": "Ads2Wallet-local-mirror/1.0",
      accept: "*/*",
    },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") || "";
  const finalUrl = stripHash(res.url);
  return { ok: res.ok, status: res.status, buf, ct, finalUrl };
}

/**
 * @param {string} urlStr
 * @param {{ ok: boolean, status: number, buf: Buffer, ct: string, finalUrl: string }} r
 */
function enqueueDependencies(urlStr, r) {
  const base = r.finalUrl;
  const low = (r.ct || "").toLowerCase();
  if (low.includes("text/html")) {
    const text = r.buf.toString("utf8");
    for (const u of extractFromHtml(text, base)) {
      const k = canonicalKey(u);
      if (!visited.has(k)) queue.push(k);
    }
  }
  if (low.includes("text/css")) {
    const text = r.buf.toString("utf8");
    for (const u of extractFromCss(text, base)) {
      const k = canonicalKey(u);
      if (!visited.has(k)) queue.push(k);
    }
  }
}

/**
 * Rewrite mirrored CDN URLs in HTML files to relative `_vendor/...` paths for file:// browsing.
 */
async function rewriteHtmlOfflinePaths() {
  const escDots = (h) => h.replace(/\./g, "\\.");
  /** @type {string[]} */
  const stack = [OUT];
  let scanned = 0;
  let patched = 0;
  while (stack.length) {
    const absDir = /** @type {string} */ (stack.pop());
    const ents = await fs.readdir(absDir, { withFileTypes: true });
    for (const e of ents) {
      const full = path.join(absDir, e.name);
      if (e.isDirectory()) {
        if (e.name === "_vendor") continue;
        stack.push(full);
      } else if (e.name.endsWith(".html")) {
        scanned++;
        let text = await fs.readFile(full, "utf8");
        const relPosix = path.relative(OUT, full).split(path.sep).join("/");
        const fromDir = path.posix.dirname(relPosix);
        let changed = false;
        for (const host of EXTERNAL_MIRROR_HOSTS) {
          const needle = `https://${host}`;
          const re = new RegExp(`${escDots(needle)}(/[^"'\\s]*)`, "g");
          text = text.replace(re, (_m, pth) => {
            changed = true;
            const target = path.posix.join("_vendor", host, pth.replace(/^\/+/, ""));
            return path.posix.relative(fromDir, target);
          });
        }
        if (changed) {
          patched++;
          await fs.writeFile(full, text, "utf8");
        }
      }
    }
  }
  console.log("OFFLINE_REWRITE html scanned:", scanned, "patched:", patched);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(
    path.join(OUT, "README-MIRROR.txt"),
    [
      "Static mirror of " + SITE + " (same-origin assets only).",
      "Generated: " + new Date().toISOString(),
      "API routes (/api/*) are not crawled — dashboard actions need the live backend.",
      "Third-party mirrors (when referenced): ./_vendor/<host>/…",
      "",
    ].join("\n"),
    "utf8",
  );

  while (queue.length && visited.size < MAX_PAGES) {
    const batch = [];
    while (queue.length && batch.length < CONCURRENCY) {
      const u = queue.shift();
      if (!u) break;
      const norm = canonicalKey(stripHash(u));
      if (visited.has(norm)) continue;
      visited.add(norm);
      batch.push(norm);
    }
    if (!batch.length) break;

    const results = await Promise.all(
      batch.map(async (urlStr) => {
        try {
          const r = await fetchOne(urlStr);
          return { urlStr, r };
        } catch (e) {
          return { urlStr, err: /** @type {Error} */ (e) };
        }
      }),
    );

    for (const item of results) {
      if ("err" in item) {
        console.error("FETCH_FAIL", item.urlStr, item.err.message);
        continue;
      }
      const { urlStr, r } = item;
      if (!r.ok) {
        console.error("HTTP", r.status, urlStr);
        continue;
      }
      const fk = canonicalKey(r.finalUrl);
      if (seenFinal.has(fk)) {
        continue;
      }
      seenFinal.add(fk);
      const rel = diskPathForFetched(r.finalUrl, r.ct);
      const full = path.join(OUT, rel);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, r.buf);
      console.log("OK", rel, r.buf.length, r.ct.split(";")[0] || "");
      enqueueDependencies(urlStr, r);
    }
  }

  await rewriteHtmlOfflinePaths();

  console.log("Mirror root:", OUT);
  console.log("Unique URLs fetched:", visited.size);
  console.log("Queue remaining:", queue.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
