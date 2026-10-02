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

// Prisma "where" koşulu: izleyicinin keşif listelerinde görebileceği kullanıcılar
function discoverableUserWhere(viewerUniversityId) {
  return {
    isFrozen: false,
    isBanned: false,
    profileVisibility: { not: 'nobody' },
    OR: [{ profileVisibility: 'everyone' }, { universityId: viewerUniversityId }],
  };
}

// Tek bir kullanıcı nesnesi için aynı kural (profileVisibility, universityId gerekli)
function isDiscoverableBy(user, viewerUniversityId) {
  if (!user || user.isFrozen || user.isBanned) return false;
  if (user.profileVisibility === 'nobody') return false;
  if (user.profileVisibility === 'university') return user.universityId === viewerUniversityId;
  return true;
}

// Çevrimiçi / son görülme bilgisini paylaşıyor mu? (alan yoksa varsayılan: evet)
function sharesActivity(user) {
  return user?.showActivityStatus !== false;
}

module.exports = { discoverableUserWhere, isDiscoverableBy, sharesActivity };
