// Bu middleware, isteği yapan kullanıcının admin yetkisine sahip olup
// olmadığını kontrol eder. requireAuth'un yaptığı her şeyi yapar (JWT
// doğrulama + req.userId), ek olarak kullanıcının isAdmin=true olmasını zorunlu kılar.

const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { twoFactorRequired } = require('../lib/twoFactor');

async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.purpose) {
      return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isAdmin: true, isBanned: true, tokenVersion: true, totpEnabled: true },
    });

    if (!user || user.isBanned) {
      return res.status(401).json({ error: 'Oturum geçersiz.' });
    }

    if (payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: 'Şifren değiştirildiği için oturumun sonlandı. Lütfen tekrar giriş yap.' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekiyor.' });
    }

    // Zorunlu iki adımlı doğrulama açıksa, kurmamış yönetici yalnızca kurulum
    // uçlarını kullanabilir (lib/twoFactor.js)
    if (twoFactorRequired() && !user.totpEnabled && !req.path.startsWith('/2fa')) {
      return res.status(403).json({ error: 'Panele devam etmek için iki adımlı doğrulamayı aç.', code: 'TWO_FACTOR_SETUP_REQUIRED' });
    }

    req.userId = user.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
  }
}

module.exports = { requireAdmin };
