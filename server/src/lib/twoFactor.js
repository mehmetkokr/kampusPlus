// Yönetici iki adımlı doğrulaması: kod kontrolü ve tekrar kullanım engeli
const { verifyTotp } = require('./totp');

const prisma = require('./prisma');

// Aynı kod iki kez geçmesin: en son kabul edilen pencere veritabanında tutulur
// (sunucu yeniden başlasa da geçerli). Koşullu güncelleme sayesinde aynı kod
// aynı anda iki istekte gelse de yalnızca biri kabul edilir.
async function checkTotp(user, code) {
  const step = verifyTotp(user.totpSecret, code, { lastStep: user.totpLastStep ?? -1 });
  if (step === null) return false;
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return count === 1;
}

// ADMIN_REQUIRE_2FA=true ise iki adımlı doğrulaması kapalı yöneticiler panelde
// yalnızca kurulum sayfasını kullanabilir
const twoFactorRequired = () => process.env.ADMIN_REQUIRE_2FA === 'true';

module.exports = { checkTotp, twoFactorRequired };
