import { test, expect } from '@playwright/test';
import { USERS, db } from './db.js';
import { login, collectConsoleErrors } from './helpers.js';

// Kulüp sohbeti: sayfa açılır (gerçek zamanlı dinleyiciler kurulurken çökmez),
// mesaj gönderilir ve diğer üyeye anında ulaşır.
test('kulüp sayfası açılır, mesaj diğer üyeye canlı ulaşır', async ({ browser }) => {
  const prisma = db();
  const [ayse, mert] = await Promise.all([
    prisma.user.findUnique({ where: { email: USERS.ayse.email } }),
    prisma.user.findUnique({ where: { email: USERS.mert.email } }),
  ]);
  const club = await prisma.club.create({
    data: {
      name: `E2E Kulübü ${Date.now()}`,
      universityId: ayse.universityId,
      creatorId: ayse.id,
      memberships: {
        create: [
          { userId: ayse.id, role: 'president', status: 'active' },
          { userId: mert.id, role: 'member', status: 'active' },
        ],
      },
    },
  });

  const ayseCtx = await browser.newContext();
  const mertCtx = await browser.newContext();
  const aysePage = await ayseCtx.newPage();
  const mertPage = await mertCtx.newPage();
  const ayseErrors = collectConsoleErrors(aysePage);
  const mertErrors = collectConsoleErrors(mertPage);

  await login(aysePage, USERS.ayse.email);
  await login(mertPage, USERS.mert.email);
  await aysePage.goto(`/clubs/${club.id}`);
  await mertPage.goto(`/clubs/${club.id}`);
  await expect(aysePage.getByText(club.name).first()).toBeVisible();
  await expect(mertPage.getByText(club.name).first()).toBeVisible();
  await expect(aysePage.getByText('Bir şeyler ters gitti')).toHaveCount(0);

  const text = 'Bu akşamki buluşma saat kaçta?';
  await aysePage.getByPlaceholder('Kulübe mesaj yaz...').fill(text);
  await aysePage.keyboard.press('Enter');
  await expect(aysePage.getByText(text)).toBeVisible();
  await expect(mertPage.getByText(text)).toBeVisible();

  expect(ayseErrors).toEqual([]);
  expect(mertErrors).toEqual([]);
  await ayseCtx.close();
  await mertCtx.close();
});
