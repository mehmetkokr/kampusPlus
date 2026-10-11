// Erişilebilirlik taraması (axe-core, WCAG 2.1 A ve AA): ekran okuyucu
// etiketleri, renk kontrastı, form etiketleri, başlık sırası vb.
// Açık ve koyu temada, giriş öncesi ve sonrası sayfalar taranır.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { USERS } from './db.js';
import { login } from './helpers.js';
import fs from 'node:fs';

const PUBLIC = ['/', '/login', '/register', '/forgot-password', '/gizlilik'];
const APP = ['/discover', '/discover/swipe', '/feed', '/clubs', '/matches', '/profile', '/settings', '/notifications'];

async function scan(page) {
  // Animasyonlar bitsin ki kontrast doğru ölçülsün
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // 3D tuval ve dekoratif arka plan katmanları içerik değildir
    .exclude('canvas')
    .analyze();
  // Ayrıntılı döküm (renk düzeltmeleri için): A11Y_DUMP=dosya.json
  if (process.env.A11Y_DUMP) {
    const rows = results.violations.flatMap((v) => v.nodes.map((n) => ({ page: page.url(), id: v.id, target: n.target.join(' '), msg: n.any.map((a) => a.message).join(' | ') })));
    fs.appendFileSync(process.env.A11Y_DUMP, rows.map((r) => JSON.stringify(r) + '\n').join(''));
  }
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
}

// Animasyonlar durur: renkler geçişin ortasında değil, son hâlinde ölçülür
test.use({ reducedMotion: 'reduce' });

for (const theme of ['dark', 'light']) {
  test.describe(`${theme === 'dark' ? 'koyu' : 'açık'} tema`, () => {
    test.use({ colorScheme: theme });

    for (const path of PUBLIC) {
      test(`${path} erişilebilir`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem('kp-theme', t), theme);
        await page.goto(path);
        expect(await scan(page)).toEqual([]);
      });
    }

    test('uygulama sayfaları erişilebilir', async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('kp-theme', t), theme);
      await login(page, USERS.ayse.email);
      if (theme === 'light') await page.evaluate(() => fetch('/api/profile/me/appearance', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ theme: 'light' }) }));
      const all = {};
      for (const path of APP) {
        await page.goto(path);
        const v = await scan(page);
        if (v.length) all[path] = v;
      }
      expect(all).toEqual({});
    });
  });
}
