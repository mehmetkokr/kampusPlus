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
const { setUploadHeaders } = require('../lib/uploadNames');

const router = express.Router();
const privateDir = PRIVATE_UPLOADS;

// Bu dosyalar <img>/<audio>/<a> etiketleriyle doğrudan tarayıcı tarafından
// istenir ve bu etiketler başlık gönderemez. Bu yüzden iki yol kabul edilir:
//  - Authorization başlığında oturum anahtarı (indirme gibi fetch istekleri)
//  - ?ft= sorgusunda yalnızca dosya açmaya yarayan kısa ömürlü anahtar
//    (lib/fileToken.js). Oturum anahtarı adreste asla kabul edilmez.
async function authenticateFileRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const fileToken = typeof req.query.ft === 'string' ? req.query.ft : null;
  const token = headerToken || fileToken;

  if (!token) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isBanned: true, tokenVersion: true },
    });
    if (!user || user.isBanned) {
      return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
    }
    // Şifre sıfırlama/tüm oturumlardan çıkış sonrası eski token'lar özel dosyaları da açamaz
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
    }
    // Başlıkta yalnızca oturum anahtarı, adreste yalnızca dosya anahtarı geçer
    // (şifre sıfırlama anahtarı hiçbirinde geçmez)
    const expected = headerToken ? undefined : 'file';
    if (payload.purpose !== expected) {
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
    // Özel dosyalar hiçbir durumda sitenin kendi adresinden sayfa gibi çalışamaz
    setUploadHeaders(res, filePath);
    res.setHeader('Cache-Control', 'private, no-store');

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
