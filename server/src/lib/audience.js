// Pazarlama hedef kitlesi: admin panelindeki kampanya formunun filtresini
// Prisma "where" koşuluna çevirir. Aynı kurallar duyuru bandının bir
// kullanıcıya gösterilip gösterilmeyeceğini de belirler (userMatchesAudience).
//
// Filtre alanları (hepsi isteğe bağlı):
//   universityIds      [Int]     yalnızca bu üniversiteler
//   classYears         [Int]     1-5 (5 = yüksek lisans / diğer)
//   intents            [String]  "ne arıyorsun" seçimlerinden en az biri
//   premium            'any' | 'yes' | 'no'
//   badge              'any' | 'yes' | 'no'   onaylı öğrenci rozeti
//   inactiveDays       Int       en az bu kadar gündür uygulamaya girmemiş
//   joinedWithinDays   Int       son bu kadar gün içinde kayıt olmuş
//   incompleteProfile  Boolean   fotoğrafı ya da ilgi alanı eksik
//
// Askıya alınmış, dondurulmuş ve yönetici hesapları hiçbir zaman hedeflenmez.

const DAY = 24 * 60 * 60 * 1000;

function toIntList(v) {
  return Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
}

function normalizeAudience(raw = {}) {
  const a = typeof raw === 'string' ? safeParse(raw) : raw || {};
  const pick = (v, allowed) => (allowed.includes(v) ? v : 'any');
  const posInt = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
  return {
    universityIds: toIntList(a.universityIds),
    classYears: toIntList(a.classYears).filter((n) => n <= 5),
    intents: Array.isArray(a.intents) ? a.intents.filter((s) => typeof s === 'string' && s.length < 40) : [],
    premium: pick(a.premium, ['yes', 'no']),
    badge: pick(a.badge, ['yes', 'no']),
    inactiveDays: posInt(a.inactiveDays),
    joinedWithinDays: posInt(a.joinedWithinDays),
    incompleteProfile: a.incompleteProfile === true,
  };
}

function safeParse(s) {
  try {
    return JSON.parse(s) || {};
  } catch {
    return {};
  }
}

function audienceWhere(raw, now = new Date()) {
  const a = normalizeAudience(raw);
  const and = [{ isBanned: false }, { isFrozen: false }, { isAdmin: false }];

  if (a.universityIds.length) and.push({ universityId: { in: a.universityIds } });
  if (a.classYears.length) and.push({ classYear: { in: a.classYears } });
  if (a.intents.length) and.push({ OR: a.intents.map((i) => ({ intent: { contains: i } })) });
  if (a.premium === 'yes') and.push({ isPremium: true, OR: [{ premiumUntil: null }, { premiumUntil: { gt: now } }] });
  if (a.premium === 'no') and.push({ OR: [{ isPremium: false }, { premiumUntil: { lte: now } }] });
  if (a.badge === 'yes') and.push({ studentDocStatus: 'approved' });
  if (a.badge === 'no') and.push({ studentDocStatus: { not: 'approved' } });
  if (a.inactiveDays) {
    const before = new Date(now.getTime() - a.inactiveDays * DAY);
    and.push({ OR: [{ lastSeenAt: { lt: before } }, { lastSeenAt: null, createdAt: { lt: before } }] });
  }
  if (a.joinedWithinDays) and.push({ createdAt: { gte: new Date(now.getTime() - a.joinedWithinDays * DAY) } });
  if (a.incompleteProfile) and.push({ OR: [{ photoUrl: null }, { interests: null }, { interests: '' }] });

  return { AND: and };
}

// Tek bir kullanıcı nesnesi için aynı kurallar (duyuru bandı)
function userMatchesAudience(user, raw, now = new Date()) {
  if (!user || user.isBanned || user.isFrozen || user.isAdmin) return false;
  const a = normalizeAudience(raw);
  if (a.universityIds.length && !a.universityIds.includes(user.universityId)) return false;
  if (a.classYears.length && !a.classYears.includes(user.classYear)) return false;
  if (a.intents.length && !a.intents.some((i) => (user.intent || '').includes(i))) return false;
  const premiumActive = user.isPremium && (!user.premiumUntil || new Date(user.premiumUntil) > now);
  if (a.premium === 'yes' && !premiumActive) return false;
  if (a.premium === 'no' && premiumActive) return false;
  if (a.badge === 'yes' && user.studentDocStatus !== 'approved') return false;
  if (a.badge === 'no' && user.studentDocStatus === 'approved') return false;
  if (a.joinedWithinDays && new Date(user.createdAt) < new Date(now.getTime() - a.joinedWithinDays * DAY)) return false;
  if (a.incompleteProfile && user.photoUrl && user.interests) return false;
  // inactiveDays bant için anlamsız (bandı gören kişi zaten şu an aktif)
  return true;
}

module.exports = { normalizeAudience, audienceWhere, userMatchesAudience };
