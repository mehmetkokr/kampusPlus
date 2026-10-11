import { describe, expect, it } from 'vitest';
import { formatNotification } from './notifications';

describe('formatNotification', () => {
  it('mesaj ve eşleşme bildirimi sohbete götürür', () => {
    expect(formatNotification({ type: 'message', targetId: 7, actor: { id: 2, fullName: 'Ece' } })).toEqual({
      text: 'Ece sana bir mesaj gönderdi.',
      link: '/chat/7',
    });
    expect(formatNotification({ type: 'match', actor: { id: 2, fullName: 'Can' } }).link).toBe('/matches');
  });

  it('bozuk duyuru içeriğinde çökmez', () => {
    const n = formatNotification({ type: 'announcement', message: 'düz metin' });
    expect(n.text).toBe('düz metin');
  });

  it('bilinmeyen türde mesajı ya da varsayılan metni gösterir', () => {
    expect(formatNotification({ type: 'yeni_tur' }).text).toBe('Yeni bildirim');
  });
});
