// Kulüp sohbeti kuralları ve anket yardımcıları.
// Hem REST uçları (routes/clubs.js) hem socket (socket.js) aynı kuralları
// buradan kullanır; böylece "kim yazabilir" kararı tek yerde verilir.
const prisma = require('./prisma');

const canManage = (role) => role === 'owner' || role === 'admin';

const SENDER_SELECT = { id: true, fullName: true, photoUrl: true };

// Yavaş mod: kulüp+kullanıcı başına son mesaj zamanı (bellekte)
const lastMessageAt = new Map();

/**
 * Bu üye şu an kulüp sohbetine yazabilir mi?
 * @returns {{ ok: true } | { ok: false, error: string, retryAfter?: number }}
 */
async function checkCanPost(clubId, userId) {
  const [club, membership] = await Promise.all([
    prisma.club.findUnique({ where: { id: clubId }, select: { chatMode: true, slowModeSeconds: true } }),
    prisma.clubMembership.findUnique({ where: { clubId_userId: { clubId, userId } } }),
  ]);
  if (!club || !membership || membership.status !== 'active') {
    return { ok: false, error: 'Bu sohbete mesaj göndermek için kulübe üye olmalısın.' };
  }
  const manager = canManage(membership.role);
  if (!manager && club.chatMode === 'admins') {
    return { ok: false, error: 'Bu kulüpte şu an yalnızca başkan ve yöneticiler yazabiliyor.' };
  }
  if (!manager && membership.mutedUntil && new Date(membership.mutedUntil) > new Date()) {
    const until = new Date(membership.mutedUntil).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    return { ok: false, error: `Kulüp yönetimi seni ${until} tarihine kadar susturdu.` };
  }
  if (!manager && club.slowModeSeconds > 0) {
    const key = `${clubId}:${userId}`;
    const last = lastMessageAt.get(key) || 0;
    const wait = Math.ceil((last + club.slowModeSeconds * 1000 - Date.now()) / 1000);
    if (wait > 0) return { ok: false, error: `Yavaş mod açık: ${wait} saniye sonra tekrar yazabilirsin.`, retryAfter: wait };
  }
  return { ok: true, manager };
}

function markPosted(clubId, userId) {
  lastMessageAt.set(`${clubId}:${userId}`, Date.now());
}

const POLL_INCLUDE = {
  options: { orderBy: { position: 'asc' }, include: { _count: { select: { votes: true } } } },
  votes: { select: { userId: true, optionId: true } },
};

// Anketi istemciye uygun hâle getirir (oy verenlerin kimliği gönderilmez)
function serializePoll(poll, viewerId) {
  if (!poll) return null;
  const voters = new Set(poll.votes.map((v) => v.userId));
  return {
    id: poll.id,
    messageId: poll.messageId,
    question: poll.question,
    multiple: poll.multiple,
    closed: poll.closed,
    totalVoters: voters.size,
    options: poll.options.map((o) => ({ id: o.id, text: o.text, votes: o._count.votes })),
    myVotes: poll.votes.filter((v) => v.userId === viewerId).map((v) => v.optionId),
  };
}

async function loadPoll(pollId) {
  return prisma.clubPoll.findUnique({ where: { id: pollId }, include: POLL_INCLUDE });
}

// Anket güncellemesini odaya yayınla: her bağlı kullanıcıya kendi oyuyla birlikte
async function broadcastPoll(io, clubId, pollId) {
  if (!io) return;
  const poll = await loadPoll(pollId);
  if (!poll) return;
  // fetchSockets() özel alanları (userId) taşımaz; yerel soket listesini kullan
  const ids = io.sockets.adapter.rooms.get(`club_${clubId}`) || new Set();
  for (const id of ids) {
    const s = io.sockets.sockets.get(id);
    if (s) s.emit('club_poll_updated', { clubId, poll: serializePoll(poll, s.userId) });
  }
}

module.exports = { canManage, checkCanPost, markPosted, serializePoll, loadPoll, broadcastPoll, POLL_INCLUDE, SENDER_SELECT };
