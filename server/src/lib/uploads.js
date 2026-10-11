// Yüklenen dosyaların diskten temizlenmesi tek yerden yönetilir.
// Veritabanı kayıtları cascade ile silinir ama diskteki dosyalar silinmez;
// bu yüzden hem hesap silmede hemen, hem de gece çalışan süpürücüyle
// (yetim dosyalar, süresi dolmuş hikayeler) temizlik yapılır.
const fsp = require('fs/promises');
const path = require('path');
const prisma = require('./prisma');
const { PUBLIC_UPLOADS, PRIVATE_UPLOADS } = require('./paths');

const HOUR = 60 * 60 * 1000;
// Yeni yüklenen bir dosya, kaydı veritabanına yazılmadan süpürücüye
// yakalanmasın diye bu süreden genç dosyalara dokunulmaz.
const ORPHAN_MIN_AGE_MS = 24 * HOUR;
// Süresi dolan hikayeler bir süre daha tutulur ki şikâyet edilenler
// incelenebilsin; bekleyen şikâyeti olan hikaye hiç silinmez.
const STORY_RETENTION_MS = 7 * 24 * HOUR;

// /uploads/... herkese açık klasör; /api/files/... kimlik belgesi ve sohbet ekleri gibi özel dosyalar
function resolveUploadPath(url) {
  if (!url) return null;
  const dir = url.startsWith('/uploads/') ? PUBLIC_UPLOADS : url.startsWith('/api/files/') ? PRIVATE_UPLOADS : null;
  return dir ? path.join(dir, path.basename(url)) : null;
}

async function removeUploadedFile(url) {
  const filePath = resolveUploadPath(url);
  if (filePath) await fsp.unlink(filePath).catch(() => {});
}

const ATTACHMENT = { OR: [{ photoUrl: { not: null } }, { audioUrl: { not: null } }, { fileUrl: { not: null } }] };
const ATTACHMENT_FIELDS = { photoUrl: true, audioUrl: true, fileUrl: true };

// Silinecek hesabın dosyaları: profil, galeri, gönderi ve hikaye fotoğrafları,
// öğrenci belgesi. Eşleşmeler silinince içindeki tüm sohbet mesajları da
// silindiği için iki tarafın da gönderdiği sohbet ekleri dahildir. Kulüp
// sohbetinde yalnızca bu hesabın kendi mesajları silinir.
async function collectUserFileUrls(userId) {
  const [user, photos, posts, stories, chatFiles, clubChatFiles] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { photoUrl: true, studentDocUrl: true } }),
    prisma.userPhoto.findMany({ where: { userId }, select: { url: true } }),
    prisma.post.findMany({ where: { authorId: userId, imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.story.findMany({ where: { authorId: userId }, select: { imageUrl: true } }),
    prisma.message.findMany({
      where: { ...ATTACHMENT, match: { OR: [{ userAId: userId }, { userBId: userId }] } },
      select: ATTACHMENT_FIELDS,
    }),
    prisma.clubMessage.findMany({ where: { ...ATTACHMENT, senderId: userId }, select: ATTACHMENT_FIELDS }),
  ]);
  return new Set(
    [
      user?.photoUrl,
      user?.studentDocUrl,
      ...photos.map((p) => p.url),
      ...posts.map((p) => p.imageUrl),
      ...stories.map((s) => s.imageUrl),
      ...[...chatFiles, ...clubChatFiles].flatMap((m) => [m.photoUrl, m.audioUrl, m.fileUrl]),
    ].filter(Boolean)
  );
}

// Kullanıcıyı siler, ardından dosyalarını diskten kaldırır
async function deleteUserWithFiles(userId) {
  const fileUrls = await collectUserFileUrls(userId);
  await prisma.user.delete({ where: { id: userId } });
  await Promise.all([...fileUrls].map(removeUploadedFile));
}

// Süresi dolmuş ve saklama süresini de aşmış hikayeleri (görselleriyle) siler
async function cleanupExpiredStories(now = new Date()) {
  const cutoff = new Date(now.getTime() - STORY_RETENTION_MS);
  const reported = await prisma.report.findMany({
    where: { targetType: 'story', status: 'pending' },
    select: { targetId: true },
  });
  const stories = await prisma.story.findMany({
    where: { expiresAt: { lt: cutoff }, id: { notIn: reported.map((r) => r.targetId) } },
    select: { id: true, imageUrl: true },
  });
  if (stories.length === 0) return 0;
  await prisma.story.deleteMany({ where: { id: { in: stories.map((s) => s.id) } } });
  await Promise.all(stories.map((s) => removeUploadedFile(s.imageUrl)));
  return stories.length;
}

// Veritabanında hiçbir kayda bağlı olmayan dosyalar (silinen gönderi, mesaj,
// eşleşme, kulüp vb. sonrası kalanlar)
async function referencedFileNames() {
  const [users, photos, posts, stories, messages, clubMessages] = await Promise.all([
    prisma.user.findMany({ select: { photoUrl: true, studentDocUrl: true } }),
    prisma.userPhoto.findMany({ select: { url: true } }),
    prisma.post.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.story.findMany({ select: { imageUrl: true } }),
    prisma.message.findMany({ where: ATTACHMENT, select: ATTACHMENT_FIELDS }),
    prisma.clubMessage.findMany({ where: ATTACHMENT, select: ATTACHMENT_FIELDS }),
  ]);
  const urls = [
    ...users.flatMap((u) => [u.photoUrl, u.studentDocUrl]),
    ...photos.map((p) => p.url),
    ...posts.map((p) => p.imageUrl),
    ...stories.map((s) => s.imageUrl),
    ...[...messages, ...clubMessages].flatMap((m) => [m.photoUrl, m.audioUrl, m.fileUrl]),
  ];
  return new Set(urls.map(resolveUploadPath).filter(Boolean));
}

async function sweepOrphanUploads(now = Date.now()) {
  const referenced = await referencedFileNames();
  let removed = 0;
  for (const dir of [PUBLIC_UPLOADS, PRIVATE_UPLOADS]) {
    const names = await fsp.readdir(dir).catch(() => []);
    for (const name of names) {
      if (name.startsWith('.')) continue; // .gitkeep vb.
      const filePath = path.join(dir, name);
      if (referenced.has(filePath)) continue;
      const stat = await fsp.stat(filePath).catch(() => null);
      if (!stat || !stat.isFile() || now - stat.mtimeMs < ORPHAN_MIN_AGE_MS) continue;
      await fsp.unlink(filePath).catch(() => {});
      removed += 1;
    }
  }
  return removed;
}

async function runUploadCleanup() {
  try {
    const stories = await cleanupExpiredStories();
    const orphans = await sweepOrphanUploads();
    // Hata kayıtları ve analitik olayları da süresi dolunca silinir
    const { pruneErrorLogs } = require('./errorLog');
    const { pruneAnalytics } = require('./analytics');
    const [errors, events] = await Promise.all([pruneErrorLogs(), pruneAnalytics()]);
    if (stories || orphans || errors || events) {
      console.log(`[temizlik] ${stories} eski hikaye, ${orphans} yetim dosya, ${errors} eski hata kaydı, ${events} eski analitik olayı silindi.`);
    }
  } catch (err) {
    console.error('[temizlik] Dosya temizliği başarısız:', err);
  }
}

module.exports = {
  removeUploadedFile,
  collectUserFileUrls,
  deleteUserWithFiles,
  cleanupExpiredStories,
  sweepOrphanUploads,
  runUploadCleanup,
};
