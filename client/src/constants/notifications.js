// Bildirim türüne göre görüntülenecek metni ve tıklanınca gidilecek linki üretir.
// Hem NotificationBell (açılır liste) hem de NotificationsPage (tam liste) kullanır.

export function formatNotification(n) {
  const actorName = n.actor?.fullName || 'Biri';

  switch (n.type) {
    case 'follow':
      return {
        text: `${actorName} seni takip etmeye başladı.`,
        link: n.actor ? `/users/${n.actor.id}` : null,
      };
    case 'message':
      return {
        text: `${actorName} sana bir mesaj gönderdi.`,
        link: n.targetId ? `/chat/${n.targetId}` : null,
      };
    case 'match':
      return {
        text: `${actorName} ile eşleştin! 🎉`,
        link: n.targetId ? `/chat/${n.targetId}` : '/matches',
      };
    case 'club_join':
      return {
        text: `${n.message || 'Bir kulübe'} katıldın.`,
        link: n.targetId ? `/clubs/${n.targetId}` : '/clubs',
      };
    case 'profile_view':
      return {
        text: `${actorName} profilini görüntüledi.`,
        link: n.actor ? `/users/${n.actor.id}` : null,
      };
    case 'like':
      return {
        text: `${actorName} gönderini beğendi.`,
        link: n.targetId ? `/feed?post=${n.targetId}` : '/feed',
      };
    case 'comment':
      return {
        text: `${actorName} gönderine yorum yaptı.`,
        link: n.targetId ? `/feed?post=${n.targetId}` : '/feed',
      };
    case 'comment_like':
      return {
        text: `${actorName} yorumunu beğendi.`,
        link: n.targetId ? `/feed?post=${n.targetId}` : '/feed',
      };
    case 'streak_milestone':
      return {
        text: `🔥 ${n.message || ''} günlük giriş serisine ulaştın! Devam et.`,
        link: '/profile',
      };
    case 'birthday':
      return {
        text: `🎉 İyi ki doğdun! kampüs+ ailesi olarak seni kutluyoruz.`,
        link: '/profile',
      };
    case 'weekly_summary':
      return {
        text: `📊 Haftalık özetin hazır: ${n.message || ''}`,
        link: '/feed',
      };
    default:
      return { text: n.message || 'Yeni bildirim', link: null };
  }
}
