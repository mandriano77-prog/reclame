// @ts-check
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const FD_LAYOUT_CSS = path.join(__dirname, '../src/filodiretto/fd-layout.css');
const FD_LAYOUT_JS = path.join(__dirname, '../src/filodiretto/fd-layout.js');

async function bootFiloLayoutShell(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(
    `<!DOCTYPE html>
<html data-app="filodiretto" data-shell="light">
<head>
<style>
  .layout { display: grid; grid-template-columns: 1fr; min-height: 100vh; }
  @media (max-width: 768px) { .sidebar { display: none; } }
</style>
</head>
<body>
  <div id="sidebarBackdrop" class="sidebar-backdrop" aria-hidden="true"></div>
  <div class="layout">
    <aside class="sidebar">
      <a class="logo" href="#">FiloDiretto</a>
      <div class="nav-item" data-section-id="welcome">Inizio</div>
      <div class="nav-item" data-section-id="push">Push</div>
      <div class="sidebar-footer"><span class="sidebar-footer-text">footer</span></div>
    </aside>
    <main class="main">
      <button type="button" class="sidebar-toggle" id="sidebarToggle" aria-label="Apri menu" aria-expanded="false">☰</button>
    </main>
  </div>
</body>
</html>`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.addStyleTag({ content: fs.readFileSync(FD_LAYOUT_CSS, 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(FD_LAYOUT_JS, 'utf8') });
  await page.waitForFunction(() => document.getElementById('sidebarToggle')?.dataset?.fdLayoutBound === '1');
}

test.describe('Filo mobile sidebar drawer', () => {
  test('hamburger opens sidebar with nav items visible', async ({ page }) => {
    await bootFiloLayoutShell(page);
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeHidden();
    await page.locator('#sidebarToggle').click();
    await expect(page.locator('body')).toHaveClass(/sidebar-open/);
    await expect(sidebar).toBeVisible();
    await expect(page.getByText('Inizio')).toBeVisible();
    await expect(page.getByText('Push')).toBeVisible();
    const display = await sidebar.evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('flex');
  });

  test('backdrop click closes drawer', async ({ page }) => {
    await bootFiloLayoutShell(page);
    await page.locator('#sidebarToggle').click();
    await expect(page.locator('body')).toHaveClass(/sidebar-open/);
    await page.mouse.click(340, 400);
    await expect(page.locator('body')).not.toHaveClass(/sidebar-open/);
    await expect(page.locator('.sidebar')).toBeHidden();
  });

  test('nav item click closes drawer', async ({ page }) => {
    await bootFiloLayoutShell(page);
    await page.locator('#sidebarToggle').click();
    await page.getByText('Push').click();
    await expect(page.locator('body')).not.toHaveClass(/sidebar-open/);
  });

  test('body scroll locked while open', async ({ page }) => {
    await bootFiloLayoutShell(page);
    await page.locator('#sidebarToggle').click();
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(overflow).toBe('hidden');
  });

  test('Escape closes drawer and updates aria-expanded', async ({ page }) => {
    await bootFiloLayoutShell(page);
    await page.locator('#sidebarToggle').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/sidebar-open/);
    await expect(page.locator('#sidebarToggle')).toHaveAttribute('aria-expanded', 'false');
  });
});
