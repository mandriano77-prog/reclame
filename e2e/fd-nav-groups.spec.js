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
    <details class="nav-group" data-nav-group="dashboard" open>
      <summary class="nav-group-label">Dashboard</summary>
      <div class="nav-item active" data-section-id="welcome" onclick="nav('welcome')">Inizio</div>
    </details>
    <details class="nav-group" data-nav-group="database">
      <summary class="nav-group-label">Database</summary>
      <div class="nav-item" data-section-id="leads" onclick="nav('leads')">Contatti</div>
      <div class="nav-item" data-section-id="audiences" onclick="nav('audiences')">Audience</div>
      <div class="nav-item" data-section-id="imports" onclick="nav('imports')">Import</div>
    </details>
    <details class="nav-group" data-nav-group="engagement">
      <summary class="nav-group-label">Engagement</summary>
      <div class="nav-item" data-section-id="instant-win" onclick="nav('instant-win')">Reward</div>
      <div class="nav-item" data-section-id="gamification" onclick="nav('gamification')">Challenge</div>
      <div class="nav-item" data-section-id="loyalty" onclick="nav('loyalty')">Loyalty</div>
    </details>
    <details class="nav-group" data-nav-group="setup">
      <summary class="nav-group-label">Setup</summary>
      <div class="nav-item" data-section-id="users" onclick="nav('users')">Utenti</div>
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

  test('setup group stays pinned open without chevron', async ({ page }) => {
    await bootNavGroupsShell(page);
    const setup = page.locator('details[data-nav-group="setup"]');
    await expect(setup).toHaveClass(/nav-group--pinned/);
    await expect(setup).toHaveAttribute('open', '');
    const chevronDisplay = await setup.locator('summary').evaluate((el) => {
      return getComputedStyle(el, '::after').display;
    });
    expect(chevronDisplay).toBe('none');
  });

  test('opening one group does not close another', async ({ page }) => {
    await bootNavGroupsShell(page);
    await page.evaluate(() => window.nav('leads'));
    const database = page.locator('details[data-nav-group="database"]');
    await expect(database).toHaveAttribute('open', '');
    const engagement = page.locator('details[data-nav-group="engagement"]');
    await expect(engagement).not.toHaveAttribute('open', '');
    await engagement.locator('summary').click();
    await expect(engagement).toHaveAttribute('open', '');
    await expect(database).toHaveAttribute('open', '');
  });
});
