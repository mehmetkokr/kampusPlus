import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// Sitenin adresi tek yerden: VITE_SITE_URL (ve VITE_CONTACT_EMAIL). Kaynak
// dosyalarda varsayılan adres yazılı; derlemede index.html, robots.txt ve
// sitemap.xml içindeki adres bu değerle değiştirilir. Böylece alan adı
// değişince yalnızca ortam değişkeni güncellenir.
const DEFAULT_SITE = 'https://kampusplus.app';
const DEFAULT_EMAIL = 'destek@kampusplus.app';

function siteUrlPlugin(env) {
  const url = (env.VITE_SITE_URL || DEFAULT_SITE).replace(/\/+$/, '');
  const email = env.VITE_CONTACT_EMAIL || DEFAULT_EMAIL;
  const swap = (text) => text.replaceAll(DEFAULT_SITE, url).replaceAll(DEFAULT_EMAIL, email);
  return {
    name: 'kampus-site-url',
    transformIndexHtml: swap,
    // public/ altındaki statik dosyalar olduğu gibi kopyalanır; kopyadan sonra düzelt
    writeBundle(options) {
      for (const file of ['robots.txt', 'sitemap.xml']) {
        const target = path.join(options.dir, file);
        if (fs.existsSync(target)) fs.writeFileSync(target, swap(fs.readFileSync(target, 'utf8')));
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), siteUrlPlugin(env)],
    // shadcn bileşenlerinin beklediği kısayol: "@/components/ui/..." → src/components/ui/...
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
    },
  };
});
