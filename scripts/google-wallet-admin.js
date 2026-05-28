#!/usr/bin/env node
/**
 * Google Wallet admin script.
 *
 * Sub-commands:
 *   issuer:get                        Print current issuer record (incl. callbackOptions).
 *   issuer:set-callback <url>         PATCH issuer.callbackOptions.url to <url>.
 *   loyaltyClass:get <classId>        Print a loyalty class.
 *   loyaltyClass:publish <classId>    PATCH loyaltyClass.reviewStatus = APPROVED.
 *   classes:list                      List all generic + loyalty classes for the issuer
 *                                     and highlight case-sensitivity duplicates.
 *
 * Requires env: GOOGLE_WALLET_ISSUER_ID + one of
 *   GOOGLE_WALLET_SA_BASE64 / GOOGLE_WALLET_SERVICE_ACCOUNT_JSON / GOOGLE_WALLET_SERVICE_ACCOUNT_FILE
 *
 * Examples:
 *   node scripts/google-wallet-admin.js issuer:get
 *   node scripts/google-wallet-admin.js issuer:set-callback https://studio.ads2wallet.com/api/v1/google-wallet/callback
 *   node scripts/google-wallet-admin.js loyaltyClass:publish 3388000000023116539.loyalty_motor-k_911b9bf2-7ba2-4a85-b22a-12256579a80c
 *   node scripts/google-wallet-admin.js classes:list
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID || '';
const API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';

function parseServiceAccount(raw, label) {
  try { return JSON.parse(raw); }
  catch (e) {
    console.error(`Failed to parse ${label}:`, e.message);
    return null;
  }
}

function loadServiceAccount() {
  if (process.env.GOOGLE_WALLET_SA_BASE64) {
    const decoded = Buffer.from(process.env.GOOGLE_WALLET_SA_BASE64, 'base64').toString('utf8');
    const p = parseServiceAccount(decoded, 'GOOGLE_WALLET_SA_BASE64');
    if (p) return p;
  }
  if (process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON) {
    const p = parseServiceAccount(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON, 'GOOGLE_WALLET_SERVICE_ACCOUNT_JSON');
    if (p) return p;
  }
  const f = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_FILE;
  if (f && fs.existsSync(f)) {
    return parseServiceAccount(fs.readFileSync(f, 'utf8'), `file ${f}`);
  }
  const def = path.join(__dirname, '..', 'google-pass-credentials.json');
  if (fs.existsSync(def)) {
    return parseServiceAccount(fs.readFileSync(def, 'utf8'), `file ${def}`);
  }
  return null;
}

const SA = loadServiceAccount();
if (!SA) {
  console.error('No Google Wallet service account credentials found. Set GOOGLE_WALLET_SA_BASE64 or GOOGLE_WALLET_SERVICE_ACCOUNT_JSON.');
  process.exit(1);
}
if (!ISSUER_ID) {
  console.error('GOOGLE_WALLET_ISSUER_ID is required.');
  process.exit(1);
}

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createSAJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signInput = `${headerB64}.${payloadB64}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(SA.private_key);
  return `${signInput}.${base64url(signature)}`;
}

function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers: { ...headers }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        if (res.statusCode >= 400) {
          const err = new Error(`${method} ${url} -> ${res.statusCode}: ${data}`);
          err.statusCode = res.statusCode;
          err.body = json || data;
          return reject(err);
        }
        resolve(json || data);
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let cachedToken = null;
let tokenExp = 0;
async function getToken() {
  if (cachedToken && Date.now() < tokenExp) return cachedToken;
  const jwt = createSAJwt();
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const res = await request('POST', 'https://oauth2.googleapis.com/token', body, {
    'Content-Type': 'application/x-www-form-urlencoded'
  });
  cachedToken = res.access_token;
  tokenExp = Date.now() + (res.expires_in - 60) * 1000;
  return cachedToken;
}

async function api(method, p, body) {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  let payload = null;
  if (body) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  return request(method, `${API_BASE}${p}`, payload, headers);
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

async function cmdIssuerGet() {
  const issuer = await api('GET', `/issuer/${ISSUER_ID}`);
  console.log(pretty(issuer));
  console.log('\n--- callbackOptions ---');
  console.log(pretty(issuer.callbackOptions || null));
}

async function cmdIssuerSetCallback(url) {
  if (!url) throw new Error('callback URL is required');
  const patch = { callbackOptions: { url } };
  const res = await api('PATCH', `/issuer/${ISSUER_ID}`, patch);
  console.log('Issuer patched. New callbackOptions:');
  console.log(pretty(res.callbackOptions || null));
}

async function cmdLoyaltyClassGet(classId) {
  if (!classId) throw new Error('classId is required');
  const cls = await api('GET', `/loyaltyClass/${classId}`);
  console.log(pretty(cls));
}

async function cmdLoyaltyClassPublish(classId) {
  if (!classId) throw new Error('classId is required');
  const res = await api('PATCH', `/loyaltyClass/${classId}`, { reviewStatus: 'APPROVED' });
  console.log(`loyaltyClass ${classId} reviewStatus =`, res.reviewStatus);
}

async function listClassesOfType(type) {
  const out = [];
  let pageToken = '';
  for (;;) {
    const q = new URLSearchParams({ issuerId: ISSUER_ID, maxResults: '50' });
    if (pageToken) q.set('token', pageToken);
    const res = await api('GET', `/${type}?${q.toString()}`);
    const resources = res.resources || [];
    for (const r of resources) out.push({ type, id: r.id, reviewStatus: r.reviewStatus || null });
    pageToken = res.pagination && res.pagination.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

async function cmdClassesList() {
  const generics = await listClassesOfType('genericClass');
  const loyalties = await listClassesOfType('loyaltyClass');
  const all = [...generics, ...loyalties];

  console.log(`Found ${generics.length} generic + ${loyalties.length} loyalty class(es).\n`);
  for (const c of all) {
    console.log(`[${c.type.padEnd(13)}] ${c.id}    reviewStatus=${c.reviewStatus}`);
  }

  const map = new Map();
  for (const c of all) {
    const lower = c.id.toLowerCase();
    if (!map.has(lower)) map.set(lower, []);
    map.get(lower).push(c);
  }
  const realDupes = [...map.values()].filter(arr => arr.length > 1);
  if (realDupes.length) {
    console.log('\n⚠️  Case-sensitivity duplicates found:');
    for (const arr of realDupes) {
      console.log('   group:');
      for (const c of arr) console.log(`     - ${c.id}`);
    }
  } else {
    console.log('\nNo case-sensitivity duplicates detected.');
  }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'issuer:get':            return cmdIssuerGet();
    case 'issuer:set-callback':   return cmdIssuerSetCallback(args[0]);
    case 'loyaltyClass:get':      return cmdLoyaltyClassGet(args[0]);
    case 'loyaltyClass:publish':  return cmdLoyaltyClassPublish(args[0]);
    case 'classes:list':          return cmdClassesList();
    default:
      console.error('Usage:');
      console.error('  node scripts/google-wallet-admin.js issuer:get');
      console.error('  node scripts/google-wallet-admin.js issuer:set-callback <url>');
      console.error('  node scripts/google-wallet-admin.js loyaltyClass:get <classId>');
      console.error('  node scripts/google-wallet-admin.js loyaltyClass:publish <classId>');
      console.error('  node scripts/google-wallet-admin.js classes:list');
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  if (e.body) console.error(e.body);
  process.exit(1);
});
