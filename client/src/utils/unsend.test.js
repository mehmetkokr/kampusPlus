import { describe, expect, it } from 'vitest';
import { UNSEND_WINDOW_MS, unsendSecondsLeft } from './unsend';

describe('unsendSecondsLeft', () => {
  const sent = new Date('2026-10-11T10:00:00Z');
  it('gönderimden hemen sonra tam süre kalır', () => {
    expect(unsendSecondsLeft(sent, sent.getTime())).toBe(UNSEND_WINDOW_MS / 1000);
  });
  it('kalan süreyi yukarı yuvarlar', () => {
    expect(unsendSecondsLeft(sent, sent.getTime() + 59_100)).toBe(1);
  });
  it('süre dolunca 0 döner', () => {
    expect(unsendSecondsLeft(sent, sent.getTime() + 60_000)).toBe(0);
    expect(unsendSecondsLeft(sent, sent.getTime() + 5 * 60_000)).toBe(0);
  });
});
