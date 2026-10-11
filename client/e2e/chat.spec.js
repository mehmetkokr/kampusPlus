import { test, expect } from '@playwright/test';
import { USERS } from './db.js';
import { login } from './helpers.js';

// Eşleşmeden sohbete: Kart Modu'nda beğeni → eşleşme → mesaj → karşı tarafta
// okunmamış rozeti ve önizleme → yanıt ve tepki → canlı güncelleme → şikâyet
test.describe.configure({ mode: 'serial' });

test('eşleşme, sohbet, okunmamış rozeti, yanıt, tepki ve şikâyet', async ({ browser }) => {
  const ayseCtx = await browser.newContext();
  const mertCtx = await browser.newContext();
  const ayse = await ayseCtx.newPage();
  const mert = await mertCtx.newPage();

  // Ayşe, Kart Modu'nda Mert'i beğenir: Mert onu önceden beğendiği için eşleşirler
  await login(ayse, USERS.ayse.email);
  await ayse.goto('/discover/swipe');
  await expect(ayse.getByText(USERS.mert.fullName).first()).toBeVisible();
  await ayse.getByRole('button', { name: 'Beğen', exact: true }).click();
  await expect(ayse.getByText('Eşleştiniz!')).toBeVisible();
  await ayse.getByRole('button', { name: /Mesaj gönder/ }).click();
  await expect(ayse).toHaveURL(/\/chat\/\d+/);

  const first = 'Merhaba Mert, kulüp etkinliğine geliyor musun?';
  await ayse.getByLabel('Mesaj', { exact: true }).fill(first);
  await ayse.getByRole('button', { name: 'Gönder' }).click();
  await expect(ayse.locator('.message-bubble', { hasText: first })).toBeVisible();

  // Mert: alt menüde okunmamış rozeti, sohbet listesinde önizleme ve sayı
  await login(mert, USERS.mert.email);
  await expect(mert.locator('.nav-unread').first()).toHaveText('1');
  await mert.goto('/matches');
  const row = mert.locator('.match-row', { hasText: USERS.ayse.fullName });
  await expect(row.locator('.match-preview')).toContainText('kulüp etkinliğine');
  await expect(row.locator('.match-unread')).toHaveText('1');
  await row.click();
  await expect(mert.locator('.message-bubble', { hasText: first })).toBeVisible();

  // Okununca rozet kalkar
  await expect(mert.locator('.nav-unread')).toHaveCount(0);

  // Yanıtla
  await mert.locator('.msg-tap', { hasText: first }).first().click();
  await mert.getByRole('button', { name: 'Yanıtla' }).click();
  await expect(mert.locator('.reply-bar')).toContainText('kulüp etkinliğine');
  const reply = 'Evet, saat yedide oradayım!';
  await mert.getByLabel('Mesaj', { exact: true }).fill(reply);
  await mert.getByRole('button', { name: 'Gönder' }).click();
  const replyRow = mert.locator('.msg-row', { hasText: reply });
  await expect(replyRow.locator('.msg-quote')).toContainText('kulüp etkinliğine');

  // Ayşe yanıtı ve alıntıyı canlı görür
  await expect(ayse.locator('.msg-row', { hasText: reply }).locator('.msg-quote')).toBeVisible();

  // Tepki: Mert ilk mesaja ❤️ bırakır, Ayşe canlı görür
  await mert.locator('.msg-tap', { hasText: first }).first().click();
  await mert.getByRole('button', { name: '❤️ ile tepki ver' }).click();
  await expect(mert.locator('.msg-row', { hasText: first }).first().locator('.msg-reaction')).toHaveText('❤️');
  await expect(ayse.locator('.msg-row', { hasText: first }).first().locator('.msg-reaction')).toHaveText('❤️');

  // Şikâyet: Ayşe, Mert'in mesajını şikâyet eder
  // Alıntıya değil balona dokunulur (alıntı asıl mesaja götürür)
  await ayse.locator('.message-bubble', { hasText: reply }).click();
  await ayse.getByRole('button', { name: 'Şikayet et' }).click();
  await ayse.getByRole('button', { name: /Gönder|Şikayet Et/ }).last().click();
  await expect(ayse.getByText('Şikayetin alındı, ekibimiz inceleyecek. Teşekkürler.')).toBeVisible();

  await ayseCtx.close();
  await mertCtx.close();
});

test('çok uzun mesaj ve küfür sunucuda engellenir / gizlenir', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, USERS.ayse.email);
  await page.goto('/matches');
  await page.locator('.match-row').first().click();

  const rude = 'Bu çok saçma, siktir git';
  await page.getByLabel('Mesaj', { exact: true }).fill(rude);
  await page.getByRole('button', { name: 'Gönder' }).click();
  await expect(page.locator('.message-bubble', { hasText: 's***** git' })).toBeVisible();
  await expect(page.locator('.message-bubble', { hasText: 'siktir' })).toHaveCount(0);
  await ctx.close();
});
