// Kod denetimi (ESLint). Gerçek hataları yakalayan kurallar "error", biçim ve
// tercih meseleleri kapalı ya da "warn". CI'da `npm run lint` hata varsa durur.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'ios/**', 'android/**', 'resources/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'react/no-unknown-property': ['error', { ignore: ['args', 'attach', 'position', 'rotation', 'intensity', 'transparent', 'side', 'depthWrite', 'toneMapped', 'castShadow', 'receiveShadow', 'object', 'dispose', 'geometry', 'material', 'metalness', 'roughness', 'visible', 'emissive', 'emissiveIntensity', 'frustumCulled', 'renderOrder'] }],
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Yapılandırma ve test dosyaları Node ortamında da çalışır
    files: ['*.config.js', 'scripts/**', 'e2e/**', 'src/**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // Service worker ayrı bir ortamdır
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
];
