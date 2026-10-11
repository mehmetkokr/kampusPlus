import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NeonCheckbox } from './animated-check-box';

afterEach(cleanup);

describe('NeonCheckbox', () => {
  it('etiketiyle erişilebilir, tıklanınca işaretlenir ve efekt oynar', () => {
    const onChange = vi.fn();
    const { container } = render(<NeonCheckbox label="Beni hatırla" onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Beni hatırla' });
    expect(box.checked).toBe(false);
    // Sayfa açılışında efekt yok
    expect(container.querySelector('.neon-checkbox__effects')).toBeNull();

    fireEvent.click(box);
    expect(box.checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.neon-checkbox__effects')).not.toBeNull();
  });

  it('kontrollü kullanımda değeri dışarıdan alır', () => {
    const { rerender } = render(<NeonCheckbox label="Çoklu seçim" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('checkbox').checked).toBe(false);
    rerender(<NeonCheckbox label="Çoklu seçim" checked onChange={() => {}} />);
    expect(screen.getByRole('checkbox').checked).toBe(true);
  });
});
