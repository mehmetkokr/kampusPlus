// Özel dosyaları (öğrenci belgesi, sohbet ekleri) yetki kontrolüyle servis eder.
// /uploads klasörünün aksine bu dosyalar herkese açık değildir — her istek
// için ilgili kaydın (kullanıcı, eşleşme, grup, kulüp) gerçekten isteği yapan
// kişiye ait olup olmadığı veritabanından doğrulanır.

const express = require('express');
const path = require('path');
const { PRIVATE_UPLOADS } = require('../lib/paths');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const router = express.Router();
const privateDir = PRIVATE_UPLOADS;

// requireAuth ortak middleware'i yalnızca Authorization header'ına bakar.
// Ama bu dosyalar <img>/<audio>/<a> etiketleriyle doğrudan tarayıcı
// tarafından istenecek ve bu etiketler custom header gönderemez. Bu yüzden
// burada, yalnızca bu route için, token'ı sorgu parametresinden de kabul
// eden hafif bir doğrulama kullanıyoruz. isBanned kontrolü burada da yapılır.
async function authenticateFileRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const token = headerToken || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isBanned: true },
    });
    if (!user || user.isBanned) {
      return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
    }
    req.userId = user.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
  }
}

router.get('/:filename', authenticateFileRequest, async (req, res) => {
  try {
    // path.basename ile "../" gibi dizin gezinme denemelerini etkisiz kılıyoruz.
    const filename = path.basename(req.params.filename);
    const filePath = path.join(privateDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Dosya bulunamadı.' });
    }

    const url = `/api/files/${filename}`;
    const denied = () => res.status(403).json({ error: 'Bu dosyaya erişim yetkiniz yok.' });

    // 1) Öğrenci doğrulama belgesi mi? Yalnızca sahibi ya da admin görebilir.
    if (filename.startsWith('studentDoc-')) {
      const me = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isAdmin: true, studentDocUrl: true },
      });
      if (me?.isAdmin || me?.studentDocUrl === url) {
        return res.sendFile(filePath);
      }
      return denied();
    }

    // 2) Birebir sohbet eki mi? Yalnızca eşleşmenin iki tarafı görebilir.
    const dmMessage = await prisma.message.findFirst({
      where: { OR: [{ photoUrl: url }, { audioUrl: url }, { fileUrl: url }] },
      select: { matchId: true },
    });
    if (dmMessage) {
      const match = await prisma.match.findUnique({ where: { id: dmMessage.matchId } });
      if (match && (match.userAId === req.userId || match.userBId === req.userId)) {
        return res.sendFile(filePath);
      }
      return denied();
    }

    // 3) Kulüp sohbeti eki mi? Yalnızca aktif üyeler görebilir.
    const clubMessage = await prisma.clubMessage.findFirst({
      where: { OR: [{ photoUrl: url }, { audioUrl: url }, { fileUrl: url }] },
      select: { clubId: true },
    });
    if (clubMessage) {
      const membership = await prisma.clubMembership.findUnique({
        where: { clubId_userId: { clubId: clubMessage.clubId, userId: req.userId } },
      });
      if (membership && membership.status === 'active') return res.sendFile(filePath);
      return denied();
    }

    // Hiçbir kayıtla eşleşmedi (silinmiş mesaj, yetim dosya vb.)
    return res.status(404).json({ error: 'Dosya bulunamadı.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Dosya alınamadı.' });
  }
});

module.exports = router;
