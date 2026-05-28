// @ts-check
const { test, expect } = require('@playwright/test');

const STUDIO = process.env.E2E_BASE_URL || 'https://studio.filodiretto.app';
const FD_WAI_JS = `${STUDIO}/filodiretto/fd-wai.js`;
const FD_WAI_CSS = `${STUDIO}/filodiretto/fd-wai.css`;

async function bootFiloShell(page, opts = {}) {
  const { a2w = false } = opts;
  await page.setContent(
    `<!DOCTYPE html>
<html ${a2w ? 'class="a2w-shell"' : ''} data-app="${a2w ? 'ads2wallet' : 'filodiretto'}">
<head>
  <link rel="stylesheet" href="${STUDIO}/filodiretto/tokens.css" />
  <link rel="stylesheet" href="${FD_WAI_CSS}" />
  <script>window.__2WALLET_PRODUCT_LOCK__='${a2w ? 'ads' : 'hr'}';</script>
</head>
<body>
  <div class="main">
  <div class="content">
    <section id="welcome" class="section active"></section>
    <section id="analytics" class="section" hidden></section>
    <section id="push" class="section" hidden></section>
  </div>
  </div>
  <div id="fdHomeRoot">
    <button type="button" class="btn" data-fd-nav="push">Invia una push</button>
    <button type="button" class="btn sec small" data-fd-nav="push">Push</button>
  </div>
  <div class="nav-item" data-section-id="analytics" id="navAnalytics">Analytics</div>
  <div id="waiOverlay" class="wai-panel" style="display:none"></div>
  <button type="button" id="waiBtn" class="wai-fab">W.AI</button>
</body>
</html>`,
    { waitUntil: 'domcontentloaded' }
  );

  await page.evaluate(() => {
    window.__lastNav = null;
    window.nav = function (id) {
      window.__lastNav = id;
      document.querySelectorAll('.section').forEach((s) => {
        s.classList.remove('active');
        s.setAttribute('hidden', '');
      });
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('active');
        el.removeAttribute('hidden');
      }
    };
    window.toggleWaiOverlay = function (forceOpen) {
      const el = document.getElementById('waiOverlay');
      if (!el) return;
      const open =
        typeof forceOpen === 'boolean'
          ? forceOpen
          : el.style.display === 'none' || !el.style.display;
      el.style.display = open ? 'flex' : 'none';
    };
    window.syncWaiUi = function () {};
  });

  await page.addScriptTag({ url: FD_WAI_JS });
  await page.waitForFunction(() => typeof window.fdNavigateFromWai === 'function');
}

test.describe('FD W.AI smoke (live fd-wai.js)', () => {
  test('live asset includes handleFdNavWhileWaiOpen', async ({ request }) => {
    const res = await request.get(FD_WAI_JS);
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toContain('handleFdNavWhileWaiOpen');
    expect(body).toContain('fdNavigateFromWai');
  });

  test('Home -> W.AI -> Analytics: panel closed, on analytics', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootFiloShell(page);
    await page.evaluate(() => window.toggleWaiOverlay(true));
    await expect(page.locator('body')).toHaveClass(/fd-wai-open/);

    await page.locator('#navAnalytics').click();
    await expect.poll(() => page.evaluate(() => window.__lastNav)).toBe('analytics');
    await expect(page.locator('#waiOverlay')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/fd-wai-open/);
    await expect(page.locator('#analytics')).toHaveClass(/active/);
    await expect(page.locator('#analytics')).not.toHaveAttribute('hidden');
  });

  test('Home -> W.AI -> Invia una push: panel closed, on push', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootFiloShell(page);
    await page.evaluate(() => window.toggleWaiOverlay(true));
    await page.getByRole('button', { name: 'Invia una push' }).click();
    await expect.poll(() => page.evaluate(() => window.__lastNav)).toBe('push');
    await expect(page.locator('#waiOverlay')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/fd-wai-open/);
    await expect(page.locator('#push')).toHaveClass(/active/);
    await expect(page.locator('#push')).not.toHaveAttribute('hidden');
  });

  test('Home -> W.AI -> quick link Push', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootFiloShell(page);
    await page.evaluate(() => window.toggleWaiOverlay(true));
    await page.getByRole('button', { name: 'Push', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__lastNav)).toBe('push');
    await expect(page.locator('#waiOverlay')).toBeHidden();
    await expect(page.locator('#push')).toHaveClass(/active/);
    await expect(page.locator('#push')).not.toHaveAttribute('hidden');
  });

  test('narrow viewport: sheet layout + nav from Home CTA', async ({ page }) => {
    await page.setViewportSize({ width: 361, height: 762 });
    await bootFiloShell(page);
    await page.evaluate(() => window.toggleWaiOverlay(true));
    await expect(page.locator('body')).toHaveClass(/fd-wai-critical-page/);
    await expect(page.locator('body')).toHaveClass(/fd-wai-open/);
    await page.getByRole('button', { name: 'Invia una push' }).click();
    await expect.poll(() => page.evaluate(() => window.__lastNav)).toBe('push');
    await expect(page.locator('#push')).toHaveClass(/active/);
    await expect(page.locator('body')).not.toHaveClass(/fd-wai-open/);
  });

  test('Ads2Wallet shell: no fd-wai bindings or layout classes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootFiloShell(page, { a2w: true });
    await expect(page.locator('html')).not.toHaveClass(/fd-wai-shell/);
    await page.evaluate(() => window.toggleWaiOverlay(true));
    await page.getByRole('button', { name: 'Invia una push' }).click();
    expect(await page.evaluate(() => window.__lastNav)).toBeNull();
    await expect(page.locator('body')).not.toHaveClass(/fd-wai-open/);
    await expect(page.locator('body')).not.toHaveClass(/fd-wai-critical-page/);
  });

  test('studio dashboard boot lists fd-wai assets', async ({ request }) => {
    const res = await request.get(`${STUDIO}/dashboard`);
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    expect(html).toContain('/filodiretto/fd-wai.js');
    expect(html).toContain('/filodiretto/fd-wai.css');
  });
});
