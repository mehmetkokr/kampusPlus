// Bildirim türüne göre görüntülenecek metni ve tıklanınca gidilecek linki üretir.
// Hem NotificationBell (açılır liste) hem de NotificationsPage (tam liste) kullanır.

// t: useI18n().t — verilmezse metin Türkçe kalır.
const plain = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? String(vars[k]) : m));

export function formatNotification(n, t = plain) {
  const name = n.actor?.fullName || t('Biri');

  switch (n.type) {
    case 'follow':
      return {
        text: t('{name} seni takip etmeye başladı.', { name }),
        link: n.actor ? `/users/${n.actor.id}` : null,
      };
    case 'message':
      return {
        text: t('{name} sana bir mesaj gönderdi.', { name }),
        link: n.targetId ? `/chat/${n.targetId}` : null,
      };
    case 'match':
      return {
        text: t('{name} ile eşleştin!', { name }),
        link: n.targetId ? `/chat/${n.targetId}` : '/matches',
      };
    case 'club_join':
      return {
        text: t('{club} katıldın.', { club: n.message || t('Bir kulübe') }),
        link: n.targetId ? `/clubs/${n.targetId}` : '/clubs',
      };
    case 'like':
      return {
        text: t('{name} gönderini beğendi.', { name }),
        link: n.targetId ? `/feed?post=${n.targetId}` : '/feed',
      };
    case 'comment':
      return {
        text: t('{name} gönderine yorum yaptı.', { name }),
        link: n.targetId ? `/feed?post=${n.targetId}` : '/feed',
      };
    case 'comment_like':
      return {
        text: t('{name} yorumunu beğendi.', { name }),
        link: n.targetId ? `/feed?post=${n.targetId}` : '/feed',
      };
    case 'birthday':
      return {
        text: t('İyi ki doğdun! kampüs· ailesi olarak seni kutluyoruz.'),
        link: '/profile',
      };
    case 'weekly_summary':
      return {
        text: t('Haftalık özetin hazır: {summary}', { summary: n.message || '' }),
        link: '/feed',
      };
    case 'club_event': {
      // message: { club, title, startsAt } (JSON)
      let info = {};
      try {
        info = JSON.parse(n.message || '{}');
      } catch {
        info = { title: n.message };
      }
      return {
        text: t('{club} kulübünde yeni etkinlik: {title}', { club: info.club || t('Kulüp'), title: info.title || '' }),
        link: n.targetId ? `/clubs/${n.targetId}` : '/clubs',
      };
    }
    case 'badge_approved':
      return {
        text: t('Öğrenci belgen onaylandı. Artık isminin yanında yeşil tik var.'),
        link: '/profile',
      };
    case 'badge_rejected':
      return {
        text: n.message
          ? t('Öğrenci belgen onaylanmadı: {reason} Profilinden yeni belge yükleyebilirsin.', { reason: n.message })
          : t('Öğrenci belgen onaylanmadı. Profilinden yeni belge yükleyebilirsin.'),
        link: '/profile',
      };
    case 'announcement': {
      // Yönetim panelinden gelen duyuru / kampanya. message: { title, body, link } (JSON)
      let info = {};
      try {
        info = JSON.parse(n.message || '{}');
      } catch {
        info = { title: n.message };
      }
      return { text: info.title || t('Duyuru'), detail: info.body || '', link: info.link || null };
    }
    default:
      return { text: n.message || t('Yeni bildirim'), link: null };
  }
}
