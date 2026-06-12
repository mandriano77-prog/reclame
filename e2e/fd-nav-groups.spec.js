// @ts-check
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const NAV_JS = path.join(__dirname, '../src/dashboard/lib/nav.js');
const FD_NAV_JS = path.join(__dirname, '../src/filodiretto/fd-nav.js');
const FD_NAV_CSS = path.join(__dirname, '../src/filodiretto/fd-nav.css');

async function bootNavGroupsShell(page) {
  await page.setContent(
    `<!DOCTYPE html>
<html data-app="filodiretto" data-shell="light">
<body>
  <aside class="sidebar">
    <div class="nav-item active" data-section-id="welcome" onclick="nav('welcome')" role="button" tabindex="0">Inizio</div>
    <details class="nav-group" data-nav-group="brand-pass">
      <summary class="nav-group-label">Brand &amp; Pass</summary>
      <div class="nav-group-items">
        <div class="nav-item" data-section-id="brand-identity" onclick="nav('brand-identity')">Identità Brand</div>
      </div>
    </details>
    <details class="nav-group" data-nav-group="database">
      <summary class="nav-group-label">Database</summary>
      <div class="nav-group-items">
        <div class="nav-item" data-section-id="leads" onclick="nav('leads')">Contatti</div>
        <div class="nav-item" data-section-id="audiences" onclick="nav('audiences')">Audience</div>
      </div>
    </details>
    <details class="nav-group" data-nav-group="comunicazione">
      <summary class="nav-group-label">Comunicazione</summary>
      <div class="nav-group-items">
        <div class="nav-item" data-section-id="instant-win" onclick="nav('instant-win')">Reward</div>
        <div class="nav-item" data-section-id="gamification" onclick="nav('gamification')">Challenge</div>
      </div>
    </details>
    <details class="nav-group nav-group--setup" data-nav-group="setup">
      <summary class="nav-group-label">Setup</summary>
      <div class="nav-group-items">
        <div class="nav-item" data-section-id="users" onclick="nav('users')">Utenti</div>
      </div>
    </details>
  </aside>
  <script>
    window.__2WALLET_PRODUCT_LOCK__ = 'hr';
    let active = 'welcome';
    function getActiveSectionId() { return active; }
    function syncNavAriaCurrent(id) {
      active = id;
      document.querySelectorAll('.nav-item').forEach((n) => {
        const sid = n.getAttribute('data-section-id');
        n.classList.toggle('active', sid === id);
        if (sid === id) n.setAttribute('aria-current', 'page');
        else n.removeAttribute('aria-current');
      });
      if (window.fdSyncNavGroups) window.fdSyncNavGroups(id);
    }
    function nav(id) { syncNavAriaCurrent(id); }
  </script>
</body>
</html>`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.addStyleTag({ content: fs.readFileSync(FD_NAV_CSS, 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(NAV_JS, 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(FD_NAV_JS, 'utf8') });
  await page.evaluate(() => {
    window.fdInitNavGroups();
  });
}

test.describe('Filo nav groups accordion', () => {
  test('navigating opens parent group and highlights it', async ({ page }) => {
    await bootNavGroupsShell(page);
    const database = page.locator('details[data-nav-group="database"]');
    await expect(database).not.toHaveAttribute('open', '');
    await page.evaluate(() => window.nav('leads'));
    await expect(database).toHaveAttribute('open', '');
    await expect(database).toHaveClass(/nav-group--active/);
    await expect(page.locator('.nav-item[data-section-id="leads"]')).toHaveAttribute('aria-current', 'page');
  });

  test('nav items receive stroke icons', async ({ page }) => {
    await bootNavGroupsShell(page);
    await expect(page.locator('.nav-item[data-section-id="welcome"] .nav-icon')).toHaveCount(1);
    await expect(page.locator('.nav-item[data-section-id="leads"] .nav-icon')).toHaveCount(1);
  });

  test('nav item labels are not duplicated as text nodes', async ({ page }) => {
    await bootNavGroupsShell(page);
    const duplicateCount = await page.evaluate(() => {
      const item = document.querySelector('.nav-item[data-section-id="brand-identity"]');
      if (!item) return -1;
      let textNodes = 0;
      item.childNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE && String(n.textContent || '').trim()) textNodes += 1;
      });
      const labels = item.querySelectorAll('.nav-label').length;
      return textNodes + labels;
    });
    expect(duplicateCount).toBe(1);
  });

  test('opening one group does not close another', async ({ page }) => {
    await bootNavGroupsShell(page);
    await page.evaluate(() => window.nav('leads'));
    const database = page.locator('details[data-nav-group="database"]');
    await expect(database).toHaveAttribute('open', '');
    const comunicazione = page.locator('details[data-nav-group="comunicazione"]');
    await expect(comunicazione).not.toHaveAttribute('open', '');
    await comunicazione.locator('summary').click();
    await expect(comunicazione).toHaveAttribute('open', '');
    await expect(database).toHaveAttribute('open', '');
  });
});
