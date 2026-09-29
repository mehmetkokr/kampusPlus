// İki kullanıcıdan biri diğerini engellemiş mi kontrol eder (yön farketmez).
// Takip, beğeni, mesajlaşma ve profil görüntüleme gibi etkileşimlerden önce kullanılır.
const prisma = require('./prisma');

async function isBlockedEitherWay(userIdA, userIdB) {
  if (!userIdA || !userIdB || userIdA === userIdB) return false;
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA },
      ],
    },
  });
  return !!block;
}

// Bir kullanıcının hem engellediği hem de kendisini engelleyen tüm kullanıcı
// id'lerini tek sorguda döner. Grup/kulüp sohbeti gibi çok üyeli listelerde
// mesajları filtrelerken her mesaj için ayrı ayrı sorgu atmamak için kullanılır.
async function getBlockedUserIds(userId) {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });

  const ids = new Set();
  for (const b of blocks) {
    ids.add(b.blockerId === userId ? b.blockedId : b.blockerId);
  }
  return ids;
}

module.exports = { isBlockedEitherWay, getBlockedUserIds };
