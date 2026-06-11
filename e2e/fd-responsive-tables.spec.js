// @ts-check
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const FD_TABLES_JS = path.join(__dirname, '../src/filodiretto/fd-responsive-tables.js');
const FD_TABLES_CSS = path.join(__dirname, '../src/filodiretto/fd-responsive-tables.css');

async function bootUsersTableShell(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(
    `<!DOCTYPE html>
<html data-app="filodiretto" data-shell="light">
<body>
  <div class="content">
    <div class="section" id="users">
      <table class="table table-keep-actions" id="usersTable">
        <thead><tr><th>Nome</th><th>Email</th><th>Ruolo</th><th>Brand</th><th>Stato</th><th>Azioni</th></tr></thead>
        <tbody>
          <tr>
            <td>Ada Lovelace</td>
            <td>ada@example.com</td>
            <td><span class="badge">Admin</span></td>
            <td class="fd-users-brand"><span class="fd-users-brand__name">Acme HR</span></td>
            <td><span class="badge active">Attivo</span></td>
            <td><button type="button">⋮</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`,
    { waitUntil: 'domcontentloaded' }
  );
  await page.addStyleTag({ content: fs.readFileSync(FD_TABLES_CSS, 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(FD_TABLES_JS, 'utf8') });
  await page.evaluate(() => window.fdEnhanceResponsiveTables());
}

test.describe('Filo responsive table cards', () => {
  test('users row cells get data-label for all columns on mobile', async ({ page }) => {
    await bootUsersTableShell(page);
    await expect(page.locator('#usersTable')).toHaveClass(/fd-table-cards/);
    await expect(page.locator('#usersTable tbody td[data-label="Brand"]')).toHaveText(/Acme HR/);
    await expect(page.locator('#usersTable tbody td[data-label="Stato"]')).toHaveText(/Attivo/);
    await expect(page.locator('#usersTable tbody td[data-label="Azioni"]')).toBeVisible();
    await expect(page.locator('#usersTable thead')).toBeHidden();
  });

  test('card layout uses flex rows at mobile width', async ({ page }) => {
    await bootUsersTableShell(page);
    const display = await page.locator('#usersTable tbody td[data-label="Email"]').evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('flex');
  });
});
