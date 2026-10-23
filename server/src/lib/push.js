// Anlık bildirim (Web Push). Uygulama kapalıyken yeni eşleşme, mesaj,
// beğeni gibi bildirimler telefona/bilgisayara düşer.
//
// Anahtarlar (VAPID): VAPID_PUBLIC_KEY ve VAPID_PRIVATE_KEY tanımlıysa onlar
// kullanılır; yoksa ilk açılışta üretilip STORAGE_DIR/vapid-keys.json içine
// yazılır (Railway'de kalıcı diskte durur). Anahtar değişirse tüm cihazların
// yeniden izin vermesi gerekir; bu yüzden dosya silinmemeli.
//
// Kullanıcı o an uygulamada (socket bağlı) ise anlık bildirim gönderilmez;
// bildirim zaten ekranda görünür.
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const prisma = require('./prisma');
const { sendToDevices } = require('./nativePush');
const { STORAGE_DIR } = require('./paths');

const KEY_FILE = path.join(STORAGE_DIR, 'vapid-keys.json');
let configured = null;

function loadKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  try {
    const saved = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
    if (saved.publicKey && saved.privateKey) return saved;
  } catch {
    // dosya yok: aşağıda üretilir
  }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEY_FILE, JSON.stringify(keys), { mode: 0o600 });
  console.log('[bildirim] Anlık bildirim anahtarları üretildi:', KEY_FILE);
  return keys;
}

function ensureConfigured() {
  if (configured) return configured;
  const keys = loadKeys();
  const subject = process.env.VAPID_SUBJECT || 'mailto:destek@kampusplus.com.tr';
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  configured = keys;
  return keys;
}

const publicKey = () => ensureConfigured().publicKey;

// Bildirim metinleri (kilit ekranında görünür: mesaj içeriği gösterilmez)
const TEXT = {
  tr: {
    message: (n) => [n, 'sana bir mesaj gönderdi.'],
    match: (n) => ['Yeni eşleşme!', `${n} ile eşleştin. Merhaba de!`],
    super_like: (n) => ['Süper Beğeni!', `${n} seni Süper Beğendi. Kart Modu'nda ilk o çıkacak.`],
    follow: (n) => [n, 'seni takip etmeye başladı.'],
    like: (n) => [n, 'gönderini beğendi.'],
    comment: (n) => [n, 'gönderine yorum yaptı.'],
    comment_like: (n) => [n, 'yorumunu beğendi.'],
    repost: (n) => [n, 'gönderini yeniden paylaştı.'],
    club_event: () => ['Yeni kulüp etkinliği', 'Kulübünde yeni bir etkinlik var.'],
    event_reminder: () => ['Etkinlik yaklaşıyor', 'Katılacağın etkinlik birazdan başlıyor.'],
    badge_approved: () => ['Belgen onaylandı', 'Artık isminin yanında onay rozeti var.'],
    badge_rejected: () => ['Belgen onaylanmadı', 'Profilinden yeni belge yükleyebilirsin.'],
    birthday: () => ['İyi ki doğdun!', 'kampüs+ ailesi olarak seni kutluyoruz.'],
    someone: 'Biri',
  },
  en: {
    message: (n) => [n, 'sent you a message.'],
    match: (n) => ["It's a match!", `You matched with ${n}. Say hi!`],
    super_like: (n) => ['Super Like!', `${n} Super Liked you. They will be first in Card Mode.`],
    follow: (n) => [n, 'started following you.'],
    like: (n) => [n, 'liked your post.'],
    comment: (n) => [n, 'commented on your post.'],
    comment_like: (n) => [n, 'liked your comment.'],
    repost: (n) => [n, 'reposted your post.'],
    club_event: () => ['New club event', 'There is a new event in your club.'],
    event_reminder: () => ['Event starting soon', 'An event you are attending starts soon.'],
    badge_approved: () => ['Document approved', 'You now have a verified badge.'],
    badge_rejected: () => ['Document not approved', 'You can upload a new document from your profile.'],
    birthday: () => ['Happy birthday!', 'Everyone at kampüs+ is celebrating you.'],
    someone: 'Someone',
  },
};

function linkFor(n) {
  switch (n.type) {
    case 'message':
    case 'match':
      return n.targetId ? `/chat/${n.targetId}` : '/matches';
    case 'follow':
      return n.actorId ? `/users/${n.actorId}` : '/notifications';
    case 'super_like':
      return '/discover/swipe';
    case 'like':
    case 'comment':
    case 'comment_like':
    case 'repost':
      return n.targetId ? `/feed?post=${n.targetId}` : '/feed';
    case 'club_event':
    case 'event_reminder':
      return n.targetId ? `/clubs/${n.targetId}` : '/clubs';
    case 'badge_approved':
    case 'badge_rejected':
    case 'birthday':
      return '/profile';
    default:
      return '/notifications';
  }
}

// Bildirim kaydından anlık bildirim içeriği; gönderilmeyecek türler için null
function buildPayload(notification, lang = 'tr') {
  const dict = TEXT[lang] || TEXT.tr;
  const name = notification.actor?.fullName || dict.someone;
  let title;
  let body;
  if (notification.type === 'announcement') {
    let info = {};
    try {
      info = JSON.parse(notification.message || '{}');
    } catch {
      info = { title: notification.message };
    }
    title = info.title || 'kampüs+';
    body = info.body || '';
    return { title, body, url: info.link || '/notifications', tag: `announcement-${notification.id}` };
  }
  if (notification.type === 'event_reminder') {
    // Başlık ve saat bildirimde görünsün: "Kodlama gecesi · 19:30"
    let info = {};
    try {
      info = JSON.parse(notification.message || '{}');
    } catch {
      info = {};
    }
    const [t1, fallback] = dict.event_reminder();
    const time = info.startsAt
      ? new Date(info.startsAt).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
      : '';
    const body = info.title ? [info.title, time, info.location].filter(Boolean).join(' · ') : fallback;
    return { title: info.club ? `${t1} · ${info.club}` : t1, body, url: linkFor(notification), tag: `event_reminder-${notification.id}` };
  }
  const make = dict[notification.type];
  if (!make) return null; // ör. club_join, weekly_summary: kullanıcının kendi eylemi ya da e-postayla gider
  [title, body] = make(name);
  // Aynı sohbetten gelen mesajlar tek bildirimde birleşir
  const tag = notification.targetId ? `${notification.type}-${notification.targetId}` : `${notification.type}-${notification.id}`;
  return { title, body, url: linkFor(notification), tag };
}

// Kullanıcının tüm cihazlarına: web tarayıcıları (Web Push) ve telefon
// uygulamaları (iOS APNs / Android FCM, bkz. lib/nativePush.js)
async function sendToUser(userId, payload) {
  if (!payload) return 0;
  const [web, native] = await Promise.all([
    sendToWeb(userId, payload),
    sendToDevices(userId, payload).catch((err) => {
      console.warn('[bildirim] Telefon bildirimi gönderilemedi:', err?.message || err);
      return 0;
    }),
  ]);
  return web + native;
}

async function sendToWeb(userId, payload) {
  ensureConfigured();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return 0;
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 24 * 60 * 60, urgency: 'high' }
        );
        sent += 1;
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      } catch (err) {
        // Abonelik iptal edilmiş ya da süresi dolmuş: kaydı sil
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.warn('[bildirim] Anlık bildirim gönderilemedi:', err.statusCode || err.message);
        }
      }
    })
  );
  return sent;
}

// createNotification'dan çağrılır: kullanıcı uygulamada değilse anlık bildirim gönderir
async function pushNotification(notification) {
  try {
    const { getOnlineUserIds } = require('../socket');
    if (getOnlineUserIds().map(Number).includes(Number(notification.userId))) return 0;
    const user = await prisma.user.findUnique({ where: { id: notification.userId }, select: { language: true } });
    return await sendToUser(notification.userId, buildPayload(notification, user?.language));
  } catch (err) {
    console.warn('[bildirim] Anlık bildirim hazırlanamadı:', err?.message || err);
    return 0;
  }
}

// Toplu duyuru (kampanya): aynı içerik, uygulamada olmayan ve bildirim açmış
// tüm alıcılara. Sırayla gönderilir ki büyük listelerde sunucu boğulmasın.
async function pushToUsers(userIds, payload) {
  try {
    const { getOnlineUserIds } = require('../socket');
    const online = new Set(getOnlineUserIds().map(Number));
    const offline = userIds.filter((id) => !online.has(Number(id)));
    const [web, devices] = await Promise.all([
      prisma.pushSubscription.findMany({ where: { userId: { in: offline } }, select: { userId: true }, distinct: ['userId'] }),
      prisma.pushDevice.findMany({ where: { userId: { in: offline } }, select: { userId: true }, distinct: ['userId'] }),
    ]);
    const targets = [...new Set([...web, ...devices].map((r) => r.userId))];
    let sent = 0;
    for (const userId of targets) sent += await sendToUser(userId, payload);
    return sent;
  } catch (err) {
    console.warn('[bildirim] Toplu anlık bildirim gönderilemedi:', err?.message || err);
    return 0;
  }
}

module.exports = { publicKey, buildPayload, sendToUser, pushNotification, pushToUsers };
