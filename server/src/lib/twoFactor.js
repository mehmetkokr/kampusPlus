// Yönetici iki adımlı doğrulaması: kod kontrolü ve tekrar kullanım engeli
const { verifyTotp } = require('./totp');

// Kullanıcı başına en son kabul edilen 30 sn'lik pencere (aynı kod iki kez geçmesin)
const lastStepByUser = new Map();

function checkTotp(user, code) {
  const step = verifyTotp(user.totpSecret, code, { lastStep: lastStepByUser.get(user.id) ?? -1 });
  if (step === null) return false;
  lastStepByUser.set(user.id, step);
  return true;
}

// ADMIN_REQUIRE_2FA=true ise iki adımlı doğrulaması kapalı yöneticiler panelde
// yalnızca kurulum sayfasını kullanabilir
const twoFactorRequired = () => process.env.ADMIN_REQUIRE_2FA === 'true';

module.exports = { checkTotp, twoFactorRequired };
