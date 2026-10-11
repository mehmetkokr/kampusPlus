// Uçtan uca testler (Playwright): gerçek tarayıcıda, gerçek sunucuya karşı.
// Her çalıştırmada geçici bir veritabanı ve dosya klasörü kurulur, deneme
// hesapları eklenir; mevcut veriye dokunulmaz. Arayüz, sunucunun verdiği
// derlenmiş sürümdür (client/dist), yani yayındakiyle aynı şekilde çalışır.
//
// Çalıştırma: npm run test:e2e   (önce: npx playwright install chromium)
// Yüklü Edge ile: E2E_CHANNEL=msedge npm run test:e2e
import { defineConfig, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(CLIENT_DIR, '..', 'server');
const PORT = Number(process.env.E2E_PORT || 4400);
const BASE_URL = `http://localhost:${PORT}`;
const channel = process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {};

// Yapılandırma her işçi süreçte yeniden okunur: hazırlık yalnızca bir kez yapılır
if (!process.env.KP_E2E_DIR) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kampus-e2e-'));
  process.env.KP_E2E_DIR = dir;
  process.env.KP_E2E_DB = `file:${path.join(dir, 'e2e.db')}`;

  // Veritabanı şeması
  execFileSync(process.execPath, [path.join(SERVER_DIR, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: process.env.KP_E2E_DB },
    stdio: 'ignore',
  });

  // Arayüz aynı adresten çalışsın diye API adresi boş derlenir
  if (!process.env.E2E_SKIP_BUILD) {
    execFileSync(process.execPath, [path.join(CLIENT_DIR, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
      cwd: CLIENT_DIR,
      env: { ...process.env, VITE_API_URL: '' },
      stdio: 'ignore',
    });
  }
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.js',
  use: {
    baseURL: BASE_URL,
    locale: 'tr-TR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'masaüstü', use: { ...devices['Desktop Chrome'], ...channel }, testIgnore: /mobile\.spec\.js/ },
    { name: 'telefon', use: { ...devices['Pixel 7'], ...channel }, testMatch: /mobile\.spec\.js/ },
  ],
  webServer: {
    command: `node "${path.join(SERVER_DIR, 'src', 'index.js')}"`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: process.env.KP_E2E_DB,
      STORAGE_DIR: process.env.KP_E2E_DIR,
      PORT: String(PORT),
      CLIENT_URL: BASE_URL,
      JWT_SECRET: 'e2e-gizli-anahtar-yalnizca-test',
      MOCK_PAYMENTS: 'true',
      SMTP_HOST: '',
      ADMIN_EMAIL: '',
      SEED_DEMO_USERS: '',
      LOGIN_RATE_LIMIT: '1000',
    },
  },
});
