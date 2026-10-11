import { test, expect } from '@playwright/test';
import { USERS } from './db.js';
import { login, collectConsoleErrors } from './helpers.js';

// Telefon boyutunda: alt menü, yatay kayma olmaması, ayarlardaki bildirim satırı
for (const path of ['/', '/discover', '/matches', '/settings', '/profile']) {
  test(`${path} telefonda yatay kaymıyor`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    if (path !== '/') await login(page, USERS.ayse.email);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test('alt menü ve anlık bildirim ayarı telefonda görünür', async ({ page }) => {
  await login(page, USERS.ayse.email);
  await expect(page.locator('.dock')).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByText('Anlık Bildirimler').first()).toBeVisible();
});
