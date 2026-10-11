import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MultiSelectBox from './MultiSelectBox';

afterEach(cleanup);

// Gerçek kullanımdaki gibi değeri dışarıda tutan küçük sarmalayıcı
function Harness({ initial = [], max, options = ['Müzik', 'Spor', 'Kahve', 'Satranç'] }) {
  const [value, setValue] = useState(initial);
  return <MultiSelectBox id="t" label="İlgi Alanları" options={options} value={value} onChange={setValue} max={max} />;
}

const box = () => screen.getByRole('button', { name: 'İlgi Alanları' });

describe('MultiSelectBox', () => {
  it('kapalı başlar, dokununca seçenek listesi açılır', () => {
    render(<Harness />);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(box());
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(box().getAttribute('aria-expanded')).toBe('true');
  });

  it('seçilen seçenek kutuda çip olur, çipteki × ile kaldırılır', () => {
    render(<Harness />);
    fireEvent.click(box());
    fireEvent.click(screen.getByRole('button', { name: 'Kahve' }));
    expect(screen.getByRole('option', { name: 'Kahve' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Kahve etiketini kaldır' }));
    expect(screen.queryByRole('button', { name: 'Kahve etiketini kaldır' })).toBeNull();
  });

  it('sınıra ulaşınca seçilmemiş seçenekler kapanır ve uyarı görünür', () => {
    render(<Harness initial={['Müzik', 'Spor']} max={2} />);
    expect(screen.getByText('2/2')).toBeTruthy();
    fireEvent.click(box());
    expect(screen.getByRole('button', { name: 'Kahve' }).disabled).toBe(true);
    expect(screen.getByText(/En fazla 2 tane seçebilirsin/)).toBeTruthy();
  });

  it('Esc ile kapanır', () => {
    render(<Harness />);
    fireEvent.click(box());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('uzun listede arama kutusu çıkar ve Türkçe karakterden bağımsız süzer', () => {
    const many = ['Müzik', 'Şiir', 'İngilizce', 'Dans', 'Yoga', 'Koşu', 'Kamp', 'Oyun', 'Film', 'Dizi', 'Resim', 'Tiyatro', 'Fotoğraf'];
    render(<Harness options={many} />);
    fireEvent.click(box());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'siir' } });
    expect(screen.getByRole('button', { name: 'Şiir' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Müzik' })).toBeNull();
  });
});
