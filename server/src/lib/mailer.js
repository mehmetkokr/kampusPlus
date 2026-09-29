// E-posta gönderim yardımcı modülü.
//
// SMTP_HOST/SMTP_USER/SMTP_PASS .env'de tanımlıysa nodemailer üzerinden
// gerçek e-posta gönderir. Tanımlı değilse (geliştirme ortamı varsayılanı),
// e-postanın içeriğini sunucu konsoluna yazar - böylece SMTP kurulmadan da
// akış uçtan uca test edilebilir.

const nodemailer = require('nodemailer');

let transporter = null;
let usingRealSmtp = false;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    usingRealSmtp = true;
  }

  return transporter;
}

/**
 * @param {{ to: string, subject: string, html: string, text?: string }} params
 */
async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  const from = process.env.MAIL_FROM || 'kampüs+ <no-reply@kampusplus.app>';

  if (!t) {
    // Geliştirme modu: SMTP tanımlı değil, konsola yaz.
    console.log('\n[mailer] SMTP tanımlı değil, e-posta konsola yazdırılıyor:');
    console.log(`[mailer] Kime: ${to}`);
    console.log(`[mailer] Konu: ${subject}`);
    console.log(`[mailer] İçerik:\n${text || html}\n`);
    return { delivered: false, mode: 'console' };
  }

  await t.sendMail({ from, to, subject, html, text });
  return { delivered: true, mode: 'smtp' };
}

module.exports = { sendMail, isRealSmtpConfigured: () => usingRealSmtp || !!getTransporter() };
