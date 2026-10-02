// SMTP ayarlarını dener: npm run mail:test -- ornek@adres.com
require('dotenv').config();
const { sendMail, checkMailer } = require('../src/lib/mailer');

(async () => {
  const to = process.argv[2];
  if (!to) {
    console.error('Kullanım: npm run mail:test -- ornek@adres.com');
    process.exit(1);
  }
  const ok = await checkMailer();
  const result = await sendMail({
    to,
    subject: 'kampüs· test e-postası',
    text: 'SMTP ayarların çalışıyor. Bu e-posta kampüs· sunucusundan gönderildi.',
    html: '<p>SMTP ayarların çalışıyor. Bu e-posta <b>kampüs·</b> sunucusundan gönderildi.</p>',
  });
  console.log(ok && result.delivered ? 'Gönderildi: ' + to : 'Gerçek e-posta gönderilmedi (SMTP ayarlarını kontrol et).');
})();
