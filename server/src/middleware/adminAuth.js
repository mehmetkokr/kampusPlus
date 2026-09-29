// Bu middleware, isteği yapan kullanıcının admin yetkisine sahip olup
// olmadığını kontrol eder. requireAuth'un yaptığı her şeyi yapar (JWT
// doğrulama + req.userId), ek olarak kullanıcının isAdmin=true olmasını zorunlu kılar.

const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isAdmin: true, isBanned: true, tokenVersion: true },
    });

    if (!user || user.isBanned) {
      return res.status(401).json({ error: 'Oturum geçersiz.' });
    }

    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: 'Şifren değiştirildiği için oturumun sonlandı. Lütfen tekrar giriş yap.' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekiyor.' });
    }

    req.userId = user.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
  }
}

module.exports = { requireAdmin };
