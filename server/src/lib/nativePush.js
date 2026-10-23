// Telefon uygulamasına (Capacitor) anlık bildirim: iOS'ta Apple Push Notification
// service (APNs), Android'de Firebase Cloud Messaging (FCM HTTP v1).
// Ek paket kullanılmaz: APNs HTTP/2 ile, FCM HTTPS ile; ikisinin de kimlik
// anahtarı jsonwebtoken ile imzalanır.
//
// Ortam değişkenleri (tanımlı değilse o platforma gönderim sessizce atlanır):
//   APNS_KEY        Apple Developer > Keys'ten indirilen .p8 dosyasının içeriği
//                   (satır sonları \n olarak da yazılabilir)
//   APNS_KEY_ID     anahtarın 10 karakterlik kimliği
//   APNS_TEAM_ID    Apple Developer ekip kimliği (10 karakter)
//   APNS_BUNDLE_ID  uygulama kimliği (varsayılan tr.com.kampusplus.app)
//   APNS_PRODUCTION "true" ise canlı sunucu, değilse geliştirme (sandbox)
//   FCM_SERVICE_ACCOUNT  Firebase hizmet hesabı JSON'u (tek satır)
const http2 = require('node:http2');
const jwt = require('jsonwebtoken');
const prisma = require('./prisma');

const pem = (v) => (v || '').replace(/\\n/g, '\n').trim();

// ---------------------------------------------------------------- APNs (iOS)
function apnsConfig(env = process.env) {
  if (!env.APNS_KEY || !env.APNS_KEY_ID || !env.APNS_TEAM_ID) return null;
  return {
    key: pem(env.APNS_KEY),
    keyId: env.APNS_KEY_ID,
    teamId: env.APNS_TEAM_ID,
    bundleId: env.APNS_BUNDLE_ID || 'tr.com.kampusplus.app',
    host: env.APNS_PRODUCTION === 'true' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com',
  };
}

// Apple kimlik anahtarı en fazla 1 saat geçerli; 50 dakikada bir yenilenir
let apnsToken = { value: null, at: 0 };
function apnsAuth(cfg) {
  if (apnsToken.value && Date.now() - apnsToken.at < 50 * 60 * 1000) return apnsToken.value;
  const value = jwt.sign({ iss: cfg.teamId }, cfg.key, { algorithm: 'ES256', header: { alg: 'ES256', kid: cfg.keyId } });
  apnsToken = { value, at: Date.now() };
  return value;
}

function apnsBody(payload) {
  return {
    aps: {
      alert: { title: payload.title, body: payload.body || '' },
      sound: 'default',
      ...(payload.tag ? { 'thread-id': payload.tag } : {}),
    },
    url: payload.url || '/notifications',
  };
}

// Tek cihaza gönderir: { ok } ya da { gone } (cihaz anahtarı artık geçersiz)
function sendApns(cfg, token, payload) {
  return new Promise((resolve) => {
    let client;
    try {
      client = http2.connect(cfg.host);
    } catch {
      resolve({ ok: false });
      return;
    }
    client.on('error', () => resolve({ ok: false }));
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${apnsAuth(cfg)}`,
      'apns-topic': cfg.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      ...(payload.tag ? { 'apns-collapse-id': String(payload.tag).slice(0, 64) } : {}),
      'content-type': 'application/json',
    });
    let status = 0;
    let data = '';
    req.setEncoding('utf8');
    req.on('response', (headers) => {
      status = headers[':status'];
    });
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      client.close();
      let reason = '';
      try {
        reason = JSON.parse(data || '{}').reason || '';
      } catch {
        // gövde boş olabilir
      }
      resolve({ ok: status === 200, gone: status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' });
    });
    req.on('error', () => {
      client.close();
      resolve({ ok: false });
    });
    req.setTimeout(10000, () => req.close());
    req.end(JSON.stringify(apnsBody(payload)));
  });
}

// ------------------------------------------------------------ FCM (Android)
function fcmConfig(env = process.env) {
  if (!env.FCM_SERVICE_ACCOUNT) return null;
  try {
    const acc = JSON.parse(env.FCM_SERVICE_ACCOUNT);
    if (!acc.project_id || !acc.client_email || !acc.private_key) return null;
    return { projectId: acc.project_id, email: acc.client_email, key: pem(acc.private_key) };
  } catch {
    return null;
  }
}

let fcmAccess = { value: null, until: 0 };
async function fcmAuth(cfg) {
  if (fcmAccess.value && Date.now() < fcmAccess.until) return fcmAccess.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: cfg.email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    cfg.key,
    { algorithm: 'RS256' }
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`FCM kimlik doğrulama: ${res.status}`);
  const json = await res.json();
  fcmAccess = { value: json.access_token, until: Date.now() + (json.expires_in - 120) * 1000 };
  return fcmAccess.value;
}

function fcmMessage(token, payload) {
  return {
    message: {
      token,
      notification: { title: payload.title, body: payload.body || '' },
      data: { url: payload.url || '/notifications', ...(payload.tag ? { tag: String(payload.tag) } : {}) },
      android: { priority: 'high', notification: { sound: 'default', ...(payload.tag ? { tag: String(payload.tag) } : {}) } },
    },
  };
}

async function sendFcm(cfg, token, payload) {
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await fcmAuth(cfg)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fcmMessage(token, payload)),
    });
    if (res.ok) return { ok: true };
    const text = await res.text();
    return { ok: false, gone: res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text) };
  } catch {
    return { ok: false };
  }
}

// ------------------------------------------------------------------ ortak
const nativePushStatus = (env = process.env) => ({ ios: Boolean(apnsConfig(env)), android: Boolean(fcmConfig(env)) });

// Kullanıcının telefon uygulamalarına gönderir; gönderilen cihaz sayısını döndürür.
// Geçersiz hale gelmiş cihaz anahtarları silinir.
async function sendToDevices(userId, payload) {
  if (!payload) return 0;
  const ios = apnsConfig();
  const android = fcmConfig();
  if (!ios && !android) return 0;
  const devices = await prisma.pushDevice.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    devices.map(async (d) => {
      const r = d.platform === 'ios' ? (ios ? await sendApns(ios, d.token, payload) : null) : android ? await sendFcm(android, d.token, payload) : null;
      if (!r) return;
      if (r.ok) {
        sent += 1;
        await prisma.pushDevice.update({ where: { id: d.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      } else if (r.gone) {
        await prisma.pushDevice.delete({ where: { id: d.id } }).catch(() => {});
      }
    })
  );
  return sent;
}

module.exports = { sendToDevices, nativePushStatus, apnsConfig, fcmConfig, apnsBody, fcmMessage };
