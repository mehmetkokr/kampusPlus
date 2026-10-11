import { test, expect } from '@playwright/test';
import { USERS, PASSWORD } from './db.js';
import { login } from './helpers.js';

test.describe.configure({ mode: 'serial' });

test('verilerimi indir JSON dosyası verir', async ({ page }) => {
  await login(page, USERS.ayse.email);
  await page.goto('/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Verilerimi İndir/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^kampus-verilerim-.*\.json$/);
  const data = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
  expect(data.account.email).toBe(USERS.ayse.email);
  expect(data.account.passwordHash).toBeUndefined();
});

test('şifre değiştirme: eski şifre geçmez, yenisiyle giriş yapılır', async ({ page }) => {
  const NEW = 'yeni-e2e-sifresi-42';
  await login(page, USERS.mert.email);
  await page.goto('/settings');
  await page.getByRole('button', { name: /Şifreyi Değiştir/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mevcut şifre').fill('yanlis-sifre');
  await dialog.getByLabel('Yeni şifre', { exact: true }).fill(NEW);
  await dialog.getByLabel('Yeni şifre (tekrar)').fill(NEW);
  await dialog.getByRole('button', { name: 'Şifreyi Değiştir' }).click();
  await expect(dialog.getByText('Mevcut şifren hatalı.')).toBeVisible();

  await dialog.getByLabel('Mevcut şifre').fill(PASSWORD);
  await dialog.getByRole('button', { name: 'Şifreyi Değiştir' }).click();
  await expect(dialog).toBeHidden();
  // Bu cihaz açık kalır
  await page.reload();
  await expect(page).toHaveURL(/\/settings/);

  // Yeni şifreyle giriş (yeni oturumda)
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await login(page, USERS.mert.email, NEW);
});

test('Instagram alanına geçersiz bağlantı kaydedilemez', async ({ page }) => {
  await login(page, USERS.ayse.email);
  await page.goto('/profile');
  await page.getByLabel('Instagram kullanıcı adı').fill('javascript:alert(1)');
  await page.getByRole('button', { name: /Değişiklikleri kaydet/i }).click();
  await expect(page.getByText(/Instagram için kullanıcı adını/)).toBeVisible();
  await page.getByLabel('Instagram kullanıcı adı').fill('@ayse.deneme');
  await page.getByRole('button', { name: /Değişiklikleri kaydet/i }).click();
  await expect(page.getByText('Değişiklikler kaydedildi.')).toBeVisible();
});
