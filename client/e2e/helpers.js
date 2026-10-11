import { expect } from '@playwright/test';
import { PASSWORD } from './db.js';

// Giriş ekranından oturum aç ve uygulamaya geçişi bekle
export async function login(page, email, password = PASSWORD) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page).toHaveURL(/\/(discover|welcome)/, { timeout: 15_000 });
}

// Tarayıcı konsolundaki hataları topla (3D/WebGL uyarıları sayılmaz)
export function collectConsoleErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/WebGL|THREE|GPU|favicon|ERR_CONNECTION_REFUSED|Failed to load resource/i.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}
