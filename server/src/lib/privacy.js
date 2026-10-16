// Gizlilik ayarlarının tek merkezi. Ayarlar sayfasındaki tercihler burada
// tanımlanan kurallarla tüm keşif/listeleme uçlarına uygulanır.
//
//  profileVisibility
//    everyone   : herkes (Premium aramada diğer üniversiteler dahil) görebilir
//    university : yalnızca kendi üniversitesindekiler görebilir
//    nobody     : keşif listelerinde (öneriler, arama, Kart Modu, aktif
//                 kullanıcılar) hiç görünmez; profil sayfası kapalıdır
//  showActivityStatus
//    false      : çevrimiçi / son görülme bilgisi kimseye gösterilmez
//  isFrozen / isBanned
//    dondurulmuş veya askıya alınmış hesaplar hiçbir listede görünmez
//  isAdmin
//    yönetici hesapları öğrenci listelerinde (keşif, arama, Kart Modu) görünmez
//  department
//    başlangıç adımını (bölüm, sınıf, doğum tarihi) bitirmemiş yeni hesaplar
//    yarım profille listelerde görünmez
//  schoolEmailVerifiedAt
//    yıllık öğrencilik doğrulaması ek süresi de geçmişse görünmez (lib/reverify.js)
const { recentlyVerifiedWhere } = require('./reverify');
const prisma = require('./prisma');
const { isPremiumActive } = require('./premium');

// Prisma "where" koşulu: izleyicinin keşif listelerinde görebileceği kullanıcılar
function discoverableUserWhere(viewerUniversityId) {
  return {
    isFrozen: false,
    isBanned: false,
    isAdmin: false,
    department: { not: null },
    profileVisibility: { not: 'nobody' },
    OR: [{ profileVisibility: 'everyone' }, { universityId: viewerUniversityId }],
    AND: [recentlyVerifiedWhere()],
  };
}

// Çevrimiçi / son görülme bilgisini paylaşıyor mu? (alan yoksa varsayılan: evet)
function sharesActivity(user) {
  return user?.showActivityStatus !== false;
}

// İki kişi arasında zaten bir bağ var mı: eşleşme ya da karşı taraf beni
// takip ediyor / beğenmiş. Bağ varsa kampüs ve görünürlük sınırı aşılabilir
// (ör. Premium bir öğrenci başka üniversiteden biriyle eşleşince karşı taraf
// da onun profilini görebilmeli).
async function hasConnection(viewerId, targetId) {
  const [a, b] = viewerId < targetId ? [viewerId, targetId] : [targetId, viewerId];
  const [match, follows, liked] = await Promise.all([
    prisma.match.findUnique({ where: { userAId_userBId: { userAId: a, userBId: b } }, select: { id: true } }),
    prisma.follow.findUnique({ where: { followerId_followingId: { followerId: targetId, followingId: viewerId } }, select: { id: true } }),
    prisma.like.findUnique({ where: { fromUserId_toUserId: { fromUserId: targetId, toUserId: viewerId } }, select: { id: true } }),
  ]);
  return Boolean(match || follows || liked);
}

// Bir kişiye ulaşma (profilini görme, takip etme, beğenme) kuralı.
//   viewer: { id, universityId, isPremium, premiumUntil }
//   target: { id, universityId, profileVisibility, isAdmin, isFrozen, isBanned }
// Dönüş: { ok: true } ya da { ok: false, status, error, code? }
//   - Yönetici, dondurulmuş, askıya alınmış hesap: yok sayılır (404)
//   - Profilini gizleyen (nobody) ya da yalnızca kendi üniversitesine açan
//     başka üniversiteden: 403 (aralarında bağ yoksa)
//   - Başka üniversite ve Premium yok: 403 (aralarında bağ yoksa) — kapalı
//     kampüs sözü ve Premium sınırı adresi tahmin ederek aşılamasın
async function reachCheck(viewer, target) {
  const gone = { ok: false, status: 404, error: 'Kullanıcı bulunamadı.' };
  if (!target || !viewer) return gone;
  if (target.id === viewer.id) return { ok: true };
  if (target.isAdmin || target.isFrozen || target.isBanned) return gone;

  const sameCampus = target.universityId === viewer.universityId;
  const visible = target.profileVisibility === 'everyone' || (target.profileVisibility === 'university' && sameCampus);
  const premiumOk = sameCampus || isPremiumActive(viewer);
  if (visible && premiumOk) return { ok: true };
  if (await hasConnection(viewer.id, target.id)) return { ok: true };

  if (!visible) {
    return target.profileVisibility === 'nobody'
      ? { ok: false, status: 403, error: 'Bu kullanıcı profilini gizli tutuyor.' }
      : { ok: false, status: 403, error: 'Bu profil yalnızca kendi üniversitesindekilere açık.' };
  }
  return { ok: false, status: 403, error: 'Diğer üniversitelerdeki öğrencilere ulaşmak Premium\'a özel.', code: 'PREMIUM_REQUIRED' };
}

module.exports = { discoverableUserWhere, sharesActivity, reachCheck, hasConnection };
