// Arayüz testleri (Vitest + Testing Library, tarayıcı yerine jsdom)
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
      css: false,
      restoreMocks: true,
    },
  })
);
