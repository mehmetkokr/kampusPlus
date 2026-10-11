import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('koşullu sınıfları birleştirir, çakışan Tailwind sınıfında sonuncuyu bırakır', () => {
    const hidden = false;
    expect(cn('p-2', hidden && 'hidden', 'p-0')).toBe('p-0');
    expect(cn('text-sm', { 'font-bold': true, italic: false })).toBe('text-sm font-bold');
  });
});
