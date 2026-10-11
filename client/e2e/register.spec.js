import { test, expect } from '@playwright/test';
import { db, crypto, PASSWORD, UNI_DOMAIN } from './db.js';

// Kayıt: okul e-postasına kod → kodla hesap oluşturma → başlangıç bilgileri
test('yeni öğrenci okul e-postasıyla kaydolur ve başlangıç adımını tamamlar', async ({ page }) => {
  const email = `yeni-${Date.now()}@${UNI_DOMAIN}`;
  await page.goto('/register');
  await page.getByLabel('Ad Soyad').fill('Yeni Öğrenci');
  await page.getByRole('combobox').fill('E2E');
  await page.getByRole('option', { name: /E2E Üniversitesi/ }).click();
  await page.getByLabel('Üniversite E-posta Adresi').fill(email);
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Şifre (tekrar)').fill(PASSWORD);
  await page.getByRole('button', { name: 'Devam et' }).click();

  await expect(page.getByRole('heading', { name: 'E-postanı doğrula' })).toBeVisible();
  // Gerçek kod e-postayla gider; testte bilinen bir kodla değiştirilir
  const hash = crypto.createHash('sha256').update('123456').digest('hex');
  await db().emailVerificationCode.update({ where: { email }, data: { codeHash: hash } });
  for (const [i, d] of [...'123456'].entries()) {
    await page.getByLabel(`Kodun ${i + 1}. hanesi`).fill(d);
  }
  await page.getByRole('button', { name: 'Hesabı oluştur' }).click();

  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('heading', { name: 'Seni biraz tanıyalım' })).toBeVisible();
  await page.getByLabel('Gün').fill('15');
  await page.getByLabel('Ay').fill('06');
  await page.getByLabel('Yıl').fill('2004');
  await page.getByLabel('Bölüm').fill('Fizik');
  await page.getByLabel('Sınıf').selectOption({ index: 2 });
  await page.getByRole('button', { name: /Devam et/ }).click();

  // Bilgiler kaydedildi: sonraki adıma geçildi ve analitik olayı yazıldı
  await expect(page.getByRole('heading', { name: 'Seni biraz tanıyalım' })).toBeHidden();
  const user = await db().user.findUnique({ where: { email } });
  expect(user.department).toBe('Fizik');
  expect(user.schoolEmailVerifiedAt).not.toBeNull();
  expect(await db().analyticsEvent.count({ where: { userId: user.id, name: { in: ['signup', 'onboarding_done'] } } })).toBe(2);
});

test('okul dışı e-postayla kod istenemez', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Ad Soyad').fill('Dış Adres');
  await page.getByRole('combobox').fill('E2E');
  await page.getByRole('option', { name: /E2E Üniversitesi/ }).click();
  await page.getByLabel('Üniversite E-posta Adresi').fill('biri@gmail.com');
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Şifre (tekrar)').fill(PASSWORD);
  await page.getByRole('button', { name: 'Devam et' }).click();
  await expect(page.getByRole('heading', { name: 'E-postanı doğrula' })).toBeHidden();
  await expect(page.getByText(`@${UNI_DOMAIN}`).first()).toBeVisible();
});
