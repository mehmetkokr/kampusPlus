import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/ui'nin sınıf birleştiricisi: koşullu sınıfları toplar, çakışan
// Tailwind sınıflarında sonuncuyu bırakır (ör. "p-2" + "p-0" → "p-0").
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
