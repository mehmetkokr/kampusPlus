// KVKK m.11 "verilerime erişim" hakkı: kullanıcının kendisiyle ilgili tuttuğumuz
// tüm kayıtları tek bir JSON dosyasında verir. Başka kullanıcıların kişisel
// verisi (ör. karşı tarafın mesajları) dahil edilmez; yalnızca adları ve
// kullanıcının kendi gönderdikleri yer alır.
const prisma = require('./prisma');

const NAME = { select: { id: true, fullName: true } };

async function buildUserExport(userId) {
  const [
    user,
    photos,
    posts,
    comments,
    stories,
    likesSent,
    likesReceivedCount,
    passes,
    matches,
    messagesSent,
    reactions,
    follows,
    followersCount,
    memberships,
    clubMessages,
    rsvps,
    notifications,
    reportsFiled,
    blocks,
    payments,
    pushDevices,
    events,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, university: { select: { name: true } }, department: true, classYear: true,
        birthDate: true, bio: true, photoUrl: true, interests: true, hobbies: true, intent: true, instagramUrl: true, twitterUrl: true,
        notifyMatches: true, notifyMessages: true, notifyPostActivity: true, weeklySummaryEnabled: true,
        profileVisibility: true, showActivityStatus: true, swipeEnabled: true, theme: true, language: true,
        verificationStatus: true, studentDocStatus: true, studentDocUrl: true, ocrExtractedText: true,
        isPremium: true, premiumUntil: true, premiumSince: true, premiumAutoRenew: true,
        schoolEmailVerifiedAt: true, lastSeenAt: true, createdAt: true,
      },
    }),
    prisma.userPhoto.findMany({ where: { userId }, select: { url: true, position: true, createdAt: true } }),
    prisma.post.findMany({ where: { authorId: userId }, select: { id: true, caption: true, imageUrl: true, visibility: true, createdAt: true } }),
    prisma.comment.findMany({ where: { authorId: userId }, select: { id: true, postId: true, content: true, createdAt: true } }),
    prisma.story.findMany({ where: { authorId: userId }, select: { imageUrl: true, createdAt: true, expiresAt: true } }),
    prisma.like.findMany({ where: { fromUserId: userId }, select: { createdAt: true, toUser: NAME } }),
    prisma.like.count({ where: { toUserId: userId } }),
    prisma.pass.findMany({ where: { fromUserId: userId }, select: { createdAt: true, toUser: NAME } }),
    prisma.match.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { id: true, createdAt: true, userA: NAME, userB: NAME },
    }),
    prisma.message.findMany({
      where: { senderId: userId },
      select: { matchId: true, content: true, photoUrl: true, audioUrl: true, fileUrl: true, fileName: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.messageReaction.findMany({ where: { userId }, select: { messageId: true, emoji: true, createdAt: true } }),
    prisma.follow.findMany({ where: { followerId: userId }, select: { createdAt: true, following: NAME } }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.clubMembership.findMany({ where: { userId }, select: { role: true, status: true, joinedAt: true, club: { select: { name: true } } } }),
    prisma.clubMessage.findMany({
      where: { senderId: userId },
      select: { content: true, photoUrl: true, fileUrl: true, createdAt: true, club: { select: { name: true } } },
    }),
    prisma.eventRSVP.findMany({ where: { userId }, select: { createdAt: true, event: { select: { title: true, startsAt: true } } } }),
    prisma.notification.findMany({ where: { userId }, select: { type: true, message: true, isRead: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.report.findMany({ where: { reporterId: userId }, select: { targetType: true, targetId: true, reason: true, description: true, status: true, createdAt: true } }),
    prisma.block.findMany({ where: { blockerId: userId }, select: { createdAt: true, blocked: NAME } }),
    prisma.paymentLog.findMany({ where: { userId }, select: { plan: true, amount: true, provider: true, status: true, createdAt: true } }),
    prisma.pushSubscription.findMany({ where: { userId }, select: { userAgent: true, createdAt: true, lastUsedAt: true } }),
    prisma.analyticsEvent.findMany({ where: { userId }, select: { name: true, path: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1000 }),
  ]);

  const other = (m) => (m.userA.id === userId ? m.userB : m.userA);
  return {
    generatedAt: new Date().toISOString(),
    note: 'Bu dosya kampüs· hesabınla ilgili tuttuğumuz verileri içerir (KVKK m.11). Dosya adresleri yalnızca giriş yapmışken açılır.',
    account: user,
    photos,
    posts,
    comments,
    stories,
    swipes: {
      likesSent: likesSent.map((l) => ({ to: l.toUser.fullName, at: l.createdAt })),
      likesReceivedCount,
      passes: passes.map((p) => ({ to: p.toUser.fullName, at: p.createdAt })),
    },
    matches: matches.map((m) => ({ id: m.id, with: other(m).fullName, at: m.createdAt })),
    messagesSent,
    messageReactions: reactions,
    following: follows.map((f) => ({ user: f.following.fullName, at: f.createdAt })),
    followersCount,
    clubs: memberships.map((m) => ({ club: m.club.name, role: m.role, status: m.status, joinedAt: m.joinedAt })),
    clubMessagesSent: clubMessages.map((m) => ({ club: m.club.name, content: m.content, photoUrl: m.photoUrl, fileUrl: m.fileUrl, at: m.createdAt })),
    eventRsvps: rsvps.map((r) => ({ event: r.event.title, startsAt: r.event.startsAt, at: r.createdAt })),
    notifications,
    reportsFiled,
    blockedUsers: blocks.map((b) => ({ user: b.blocked.fullName, at: b.createdAt })),
    payments,
    pushDevices,
    usageEvents: events,
  };
}

module.exports = { buildUserExport };
