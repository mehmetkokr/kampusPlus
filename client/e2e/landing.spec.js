import { test, expect } from '@playwright/test';
import { collectConsoleErrors } from './helpers.js';

test('tanıtım sayfası açılır, konsolda hata yok', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kampüsünde');
  await expect(page.getByRole('link', { name: /Ücretsiz katıl|Hemen katıl/ }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('telefona yükleme dosyaları ve arama motoru dosyaları yayında', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBeTruthy();
  expect(sw.headers()['cache-control']).toContain('no-cache');
  expect((await request.get('/offline.html')).ok()).toBeTruthy();
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap:');
  expect(robots).toContain('Disallow: /admin');
});

test('olmayan sayfa 404 ekranı gösterir', async ({ page }) => {
  await page.goto('/bu-sayfa-yok');
  await expect(page.getByText(/bulunamadı/i).first()).toBeVisible();
});
