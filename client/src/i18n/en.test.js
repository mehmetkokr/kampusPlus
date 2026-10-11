import { describe, expect, it } from 'vitest';
import en from './en';

// Türkçe anahtardaki {degisken} yer tutucuları İngilizce karşılıkta da olmalı;
// yoksa ekranda örneğin kişi adı kaybolur.
describe('İngilizce sözlük', () => {
  const entries = Object.entries(en);

  it('tüm karşılıklar boş olmayan metin', () => {
    const bad = entries.filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('yer tutucular korunur', () => {
    const missing = entries
      .filter(([k, v]) => (k.match(/\{\w+\}/g) || []).some((ph) => !v.includes(ph)))
      .map(([k]) => k);
    expect(missing).toEqual([]);
  });
});
