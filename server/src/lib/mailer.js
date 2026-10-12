// E-posta gönderim yardımcı modülü. Üç yol vardır, ilk tanımlı olan kullanılır:
//
//  1. BREVO_API_KEY: Brevo'nun HTTPS API'si. SMTP portları kapalı olan
//     sunucularda (ör. Railway'in düşük paketleri) de çalışır.
//  2. SMTP_HOST/SMTP_USER/SMTP_PASS: nodemailer ile SMTP (Gmail, Brevo SMTP...).
//  3. Hiçbiri yoksa (geliştirme ortamı varsayılanı) e-postanın içeriği sunucu
//     konsoluna yazılır - böylece kurulum yapılmadan da akış test edilebilir.
//
// Son gönderimin sonucu (başarılı/hata) saklanır; yönetim paneli > Sistem
// sayfası bunu gösterir ki sorun sunucu kayıtlarına bakmadan anlaşılsın.

const nodemailer = require('nodemailer');

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 15000;

let transporter = null;
const status = { ok: null, error: null, at: null };

function mailMode(env = process.env) {
  if (env.BREVO_API_KEY) return 'brevo';
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return 'smtp';
  return 'console';
}

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Port kapalıysa iki dakika beklemek yerine kısa sürede hata versin
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS * 2,
  });
  return transporter;
}

// "kampüs+ <destek@ornek.com>" -> { name, email }
function parseFrom(from) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: from.trim() };
}

function record(ok, err) {
  Object.assign(status, { ok, error: ok ? null : String(err?.message || err).slice(0, 300), at: new Date().toISOString() });
}

async function sendViaBrevo({ from, to, subject, html, text }) {
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: parseFrom(from),
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Brevo ${res.status}: ${body.message || res.statusText}`);
  }
}

/**
 * @param {{ to: string, subject: string, html: string, text?: string }} params
 */
async function sendMail({ to, subject, html, text }) {
  const mode = mailMode();
  const from = process.env.MAIL_FROM || 'kampüs· <no-reply@kampusplus.app>';

  if (mode === 'console') {
    // Geliştirme modu: e-posta servisi tanımlı değil, konsola yaz.
    console.log('\n[mailer] E-posta servisi tanımlı değil, e-posta konsola yazdırılıyor:');
    console.log(`[mailer] Kime: ${to}`);
    console.log(`[mailer] Konu: ${subject}`);
    console.log(`[mailer] İçerik:\n${text || html}\n`);
    return { delivered: false, mode };
  }

  try {
    if (mode === 'brevo') await sendViaBrevo({ from, to, subject, html, text });
    else await getTransporter().sendMail({ from, to, subject, html, text });
    record(true);
  } catch (err) {
    record(false, err);
    console.error(`[mailer] E-posta gönderilemedi (${mode}):`, err.message);
    throw err;
  }
  return { delivered: true, mode };
}

// Sunucu açılışında e-posta durumunu bildirir: tanımlı değilse uyarı (kayıt
// kodları ve şifre sıfırlama bağlantıları gerçek kullanıcılara ulaşmaz),
// SMTP tanımlıysa bağlantıyı doğrular.
async function checkMailer() {
  const mode = mailMode();
  if (mode === 'console') {
    const level = process.env.NODE_ENV === 'production' ? 'UYARI' : 'bilgi';
    console.log(`[mailer] ${level}: e-posta servisi tanımlı değil; doğrulama kodları ve şifre sıfırlama e-postaları konsola yazılıyor.`);
    return false;
  }
  if (mode === 'brevo') {
    console.log('[mailer] Brevo API tanımlı, e-postalar gerçekten gönderilecek.');
    return true;
  }
  try {
    await getTransporter().verify();
    record(true);
    console.log('[mailer] SMTP bağlantısı doğrulandı, e-postalar gerçekten gönderilecek.');
    return true;
  } catch (err) {
    record(false, err);
    console.error('[mailer] SMTP bağlantısı kurulamadı:', err.message);
    return false;
  }
}

// Yönetim paneli için: hangi yol kullanılıyor, son deneme ne oldu
function mailStatus() {
  return { mode: mailMode(), ...status };
}

module.exports = {
  sendMail,
  checkMailer,
  mailStatus,
  mailMode,
  parseFrom,
  isRealSmtpConfigured: () => mailMode() !== 'console',
};
