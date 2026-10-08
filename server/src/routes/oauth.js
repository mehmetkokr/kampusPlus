// Apple / Google ile giriş uçları (bkz. lib/oauth.js)
//
// Sıra:
//  1. Sağlayıcı kimliği bir hesaba bağlıysa → giriş
//  2. Sağlayıcının doğruladığı e-posta mevcut bir hesabınsa → bağla ve giriş
//  3. O e-posta bir üniversitenin okul adresiyse → hesap aç (e-postayı
//     sağlayıcı doğruladığı için ayrıca kod istenmez), başlangıç adımına geç
//  4. Aksi halde okul e-postası gerekir → kısa ömürlü bilet döner; istemci
//     kayıt sayfasına gider, kayıt ya da şifreli giriş sonunda hesap bağlanır
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');
const { toTitleCaseTR } = require('../lib/text');
const { findUniversityForEmail } = require('../lib/schoolEmail');
const { PROVIDER_FIELD, providerConfig, verifyGoogle, verifyApple, signTicket } = require('../lib/oauth');

const router = express.Router();

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.' },
});

// İstemci kimlikleri herkese açıktır; düğmeler buna göre gösterilir
router.get('/config', (req, res) => {
  res.json(providerConfig());
});

function sessionPayload(user, extra = {}) {
  const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return {
    token,
    ...extra,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      verificationStatus: user.verificationStatus,
      isAdmin: user.isAdmin,
    },
  };
}

async function signIn(res, user, extra) {
  if (user.isBanned) {
    return res.status(403).json({ error: 'Hesabın askıya alındı. Detaylar için destek ekibiyle iletişime geç.' });
  }
  let reactivated = false;
  if (user.isFrozen) {
    await prisma.user.update({ where: { id: user.id }, data: { isFrozen: false } });
    reactivated = true;
  }
  return res.json(sessionPayload(user, { reactivated, ...extra }));
}

async function handleIdentity(res, provider, identity, nameHint) {
  const field = PROVIDER_FIELD[provider];

  const linked = await prisma.user.findUnique({ where: { [field]: identity.sub } });
  if (linked) return signIn(res, linked);

  if (identity.email) {
    const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
    if (byEmail) {
      // Hesapta bu sağlayıcıdan başka bir kimlik varsa üzerine yazılmaz
      if (!byEmail[field]) await prisma.user.update({ where: { id: byEmail.id }, data: { [field]: identity.sub } });
      return signIn(res, byEmail);
    }

    const university = await findUniversityForEmail(identity.email);
    if (university) {
      const fullName = toTitleCaseTR(String(identity.name || nameHint || '').trim()).slice(0, 80) || identity.email.split('@')[0];
      // Şifresiz hesap: rastgele, kimsenin bilmediği bir özet. İstenirse
      // "Şifremi unuttum" ile okul e-postasından şifre belirlenebilir.
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const user = await prisma.user.create({
        data: {
          email: identity.email,
          passwordHash,
          fullName,
          universityId: university.id,
          intent: 'friendship',
          verificationStatus: 'auto_verified',
          [field]: identity.sub,
        },
      });
      return res.status(201).json(sessionPayload(user, { isNew: true }));
    }
  }

  return res.json({
    needsSchoolEmail: true,
    ticket: signTicket({ provider, sub: identity.sub, name: identity.name || nameHint }),
    name: identity.name || nameHint || null,
  });
}

function fail(res, err, provider) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(`${provider} girişi:`, err.code || err.message);
  return res.status(401).json({ error: 'Giriş doğrulanamadı. Lütfen tekrar dene.' });
}

// POST /api/auth/oauth/google { credential }
router.post('/google', oauthLimiter, async (req, res) => {
  try {
    const identity = await verifyGoogle(String(req.body.credential || ''));
    return await handleIdentity(res, 'google', identity);
  } catch (err) {
    return fail(res, err, 'Google');
  }
});

// POST /api/auth/oauth/apple { idToken, name? }
// Apple adı yalnızca ilk girişte ve belirtecin dışında verir; yalnızca
// görünen ad için kullanılır, kimlik her zaman belirteçteki "sub"dur.
router.post('/apple', oauthLimiter, async (req, res) => {
  try {
    const identity = await verifyApple(String(req.body.idToken || ''));
    const nameHint = typeof req.body.name === 'string' ? req.body.name.slice(0, 80) : null;
    return await handleIdentity(res, 'apple', identity, nameHint);
  } catch (err) {
    return fail(res, err, 'Apple');
  }
});

module.exports = router;
