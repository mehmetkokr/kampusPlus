// Ders/Bölüm arkadaşı bulma özelliği: aynı üniversite + bölüm + sınıftaki
// kullanıcıları, içinde bulunulan döneme özel tek bir gruba otomatik toplar.
const prisma = require('./prisma');
const { getCurrentSemesterKey, formatSemesterLabel, semesterKeyToSortValue } = require('./semester');

// Bir üniversite/bölüm/sınıf/dönem kombinasyonu için grubu bulur, yoksa oluşturur.
async function ensureClassmateGroup(universityId, department, classYear) {
  const semesterKey = getCurrentSemesterKey();
  const dept = department.trim();

  const existing = await prisma.classmateGroup.findUnique({
    where: {
      universityId_department_classYear_semesterKey: {
        universityId,
        department: dept,
        classYear,
        semesterKey,
      },
    },
  });
  if (existing) return existing;

  return prisma.classmateGroup.create({
    data: {
      universityId,
      department: dept,
      classYear,
      semesterKey,
      name: `${dept} - ${classYear}. Sınıf (${formatSemesterLabel(semesterKey)})`,
    },
  });
}

/**
 * Kullanıcının bölüm/sınıf bilgisine göre içinde bulunduğu dönemin ders
 * arkadaşı grubuna otomatik üye eder. Kayıt sırasında ve profil
 * güncellemesinde (bölüm/sınıf değiştiğinde) çağrılır.
 * Kullanıcı bu dönemde başka/eski bir bölüm-sınıf grubundaysa oradan çıkarılır,
 * böylece aynı dönemde en fazla bir otomatik gruba üye olur.
 */
async function syncUserClassmateGroup(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, universityId: true, department: true, classYear: true },
  });
  if (!user) return null;

  const semesterKey = getCurrentSemesterKey();

  const currentMemberships = await prisma.classmateGroupMember.findMany({
    where: { userId, group: { semesterKey } },
    include: { group: true },
  });

  const dept = (user.department || '').trim();
  const hasValidProfile = !!dept && !!user.classYear;

  // Bölüm/sınıf bilgisi eksikse otomatik gruplama yapılamaz - varsa bu
  // dönemdeki eski üyelikten çıkar.
  if (!hasValidProfile) {
    if (currentMemberships.length > 0) {
      await prisma.classmateGroupMember.deleteMany({ where: { userId, group: { semesterKey } } });
    }
    return null;
  }

  const alreadyCorrect = currentMemberships.find(
    (m) => m.group.department === dept && m.group.classYear === user.classYear
  );
  if (alreadyCorrect) return alreadyCorrect.group;

  const staleIds = currentMemberships.map((m) => m.id);
  if (staleIds.length > 0) {
    await prisma.classmateGroupMember.deleteMany({ where: { id: { in: staleIds } } });
  }

  const group = await ensureClassmateGroup(user.universityId, dept, user.classYear);
  await prisma.classmateGroupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    update: {},
    create: { groupId: group.id, userId },
  });

  return group;
}

// Boş (hiç mesajı/üyesi olmayan) çok eski gruplar tamamen silinmeden önce
// beklenecek minimum dönem farkı.
const EMPTY_GROUP_DELETE_AFTER_TERMS = 4; // ~1 yıl

/**
 * Dönemlik temizlik: geçerli dönemden farklı olan tüm gruplar salt-okunur
 * arşive alınır (isArchived=true) - sohbet geçmişi korunur, sadece yeni mesaj/
 * otomatik üye eklenmesi durur (üyelik zaten sadece güncel dönem için
 * kuruluyor). Hiç kullanılmamış (üyesiz/mesajsız) ve yeterince eski gruplar
 * ise veritabanını şişirmemesi için tamamen silinir.
 */
async function runSemesterCleanup() {
  try {
    const currentKey = getCurrentSemesterKey();
    const currentSort = semesterKeyToSortValue(currentKey);

    const groups = await prisma.classmateGroup.findMany({
      where: { semesterKey: { not: currentKey } },
      select: {
        id: true,
        semesterKey: true,
        isArchived: true,
        _count: { select: { messages: true, members: true } },
      },
    });

    let archivedCount = 0;
    let deletedCount = 0;

    for (const g of groups) {
      const termsAgo = currentSort - semesterKeyToSortValue(g.semesterKey);

      if (g._count.messages === 0 && g._count.members === 0 && termsAgo >= EMPTY_GROUP_DELETE_AFTER_TERMS) {
        await prisma.classmateGroup.delete({ where: { id: g.id } });
        deletedCount += 1;
        continue;
      }

      if (!g.isArchived) {
        await prisma.classmateGroup.update({ where: { id: g.id }, data: { isArchived: true } });
        archivedCount += 1;
      }
    }

    console.log(`[classmateGroups] Dönemlik temizlik tamamlandı: ${archivedCount} grup arşivlendi, ${deletedCount} boş grup silindi.`);
  } catch (err) {
    console.error('Dönemlik temizlik başarısız:', err);
  }
}

module.exports = { ensureClassmateGroup, syncUserClassmateGroup, runSemesterCleanup };
