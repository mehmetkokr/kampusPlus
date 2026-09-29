// Bu middleware, isteğin geçerli bir JWT token içerip içermediğini kontrol eder.
// Token geçerliyse req.userId değişkenine kullanıcının ID'sini ekler.
//
// Not: JWT imzasının geçerli olması, kullanıcının hesabının hâlâ aktif olduğu
// anlamına gelmez. Bir admin kullanıcıyı yasakladığında, o kullanıcının elindeki
// token (7 gün geçerli) imza olarak geçerliliğini korur. Bu yüzden her istekte
// kullanıcının hâlâ var olduğunu ve yasaklı olmadığını veritabanından doğruluyoruz.
// Aynı şekilde, tokenVersion da kontrol edilir: kullanıcı şifresini
// sıfırladığında bu sayaç artar ve o ana kadar açılmış tüm oturumlar
// (eski token'lar) otomatik olarak geçersiz kalır.

const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { touchStreak } = require('../lib/streak');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isBanned: true, tokenVersion: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
    }

    // Eski (register/login sırasında tokenVersion içermeyen) token'larla geriye
    // dönük uyumluluk için payload.tokenVersion tanımsızsa kontrolü atla.
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: 'Şifren değiştirildiği için oturumun sonlandı. Lütfen tekrar giriş yap.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Hesabınız askıya alınmış.', code: 'ACCOUNT_BANNED' });
    }

    req.userId = user.id;
    // Günlük giriş serisini (streak) arka planda güncelle - isteği bekletmez,
    // hata verse bile isteğin akışını etkilemez (bkz. lib/streak.js).
    touchStreak(req.app.get('io'), user.id);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
  }
}

module.exports = { requireAuth };
