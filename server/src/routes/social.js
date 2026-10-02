// Instagram tarzı sosyal akış: gönderi, beğeni, yorum, hikaye, takip sistemi.
// Güvenlik için takip yalnızca aynı üniversiteden kişilerle kurulabilir.
const express = require('express');
const { visibleIntentFor } = require('../lib/intents');
const fsp = require('fs/promises');
const path = require('path');
const { PUBLIC_UPLOADS } = require('../lib/paths');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { createNotification } = require('../lib/notifications');
const { isBlockedEitherWay } = require('../lib/block');
const { isPremiumActive } = require('../lib/premium');
const { withLiveAge } = require('../lib/age');
const { discoverableUserWhere } = require('../lib/privacy');

const router = express.Router();

const AUTHOR_SELECT = {
  id: true,
  fullName: true,
  photoUrl: true,
  verificationStatus: true,
  studentDocStatus: true,
  university: { select: { id: true, name: true } },
};

// Yeşil tik yalnızca öğrenci belgesi admin tarafından onaylanan hesaplara verilir
function isVerified(u) {
  return u?.studentDocStatus === 'approved';
}

function serializeAuthor(author) {
  return {
    id: author.id,
    fullName: author.fullName,
    photoUrl: author.photoUrl,
    isVerified: isVerified(author),
    university: author.university ? author.university.name : null,
  };
}

async function getFollowingIds(userId) {
  const rows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  return rows.map((r) => r.followingId);
}

async function getBlockExclusionIds(userId) {
  const [blockedByMe, blockingMe] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
  ]);
  return [...blockedByMe.map((b) => b.blockedId), ...blockingMe.map((b) => b.blockerId)];
}

// ---------------------------------------------------------
// GÖRÜNÜRLÜK KURALLARI (tek merkez)
//  - campus    : gönderi sahibiyle aynı üniversitedeki herkes görür
//  - followers : yalnızca gönderi sahibini takip edenler görür
//  - mutual    : yalnızca karşılıklı takipleşilenler görür
//  Görebilen herkes beğenebilir; yalnızca karşılıklı takipleşenler (ve
//  gönderi sahibi) yorum yapabilir. Hikayeleri yalnızca karşılıklı
//  takipleşenler görür. Engellenen/engelleyen kullanıcılar hiçbir şeyi görmez.
// ---------------------------------------------------------
const VISIBILITIES = ['campus', 'followers', 'mutual'];
const CAPTION_MAX = 280;

async function getViewerContext(userId) {
  const [me, followingRows, followerRows, excludeIds] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { universityId: true } }),
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: userId }, select: { followerId: true } }),
    getBlockExclusionIds(userId),
  ]);
  const followingIds = new Set(followingRows.map((r) => r.followingId));
  const followerIds = new Set(followerRows.map((r) => r.followerId));
  const mutualIds = new Set([...followingIds].filter((id) => followerIds.has(id)));
  return { userId, universityId: me?.universityId, followingIds, mutualIds, excludeIds: new Set(excludeIds) };
}

// Prisma "where" koşulu: izleyicinin görebileceği gönderiler
function visiblePostsWhere(ctx) {
  return {
    AND: [
      { authorId: { notIn: [...ctx.excludeIds] } },
      { OR: [{ authorId: ctx.userId }, { author: { isFrozen: false, isBanned: false } }] },
      {
        OR: [
          { authorId: ctx.userId },
          { visibility: 'campus', author: { universityId: ctx.universityId } },
          { visibility: 'followers', authorId: { in: [...ctx.followingIds] } },
          { visibility: 'mutual', authorId: { in: [...ctx.mutualIds] } },
        ],
      },
    ],
  };
}

function canViewPost(post, ctx) {
  if (!post || ctx.excludeIds.has(post.authorId)) return false;
  if (post.authorId === ctx.userId) return true;
  if (post.visibility === 'followers') return ctx.followingIds.has(post.authorId);
  if (post.visibility === 'mutual') return ctx.mutualIds.has(post.authorId);
  return post.author?.universityId === ctx.universityId;
}

function canCommentOn(post, ctx) {
  return post.authorId === ctx.userId || ctx.mutualIds.has(post.authorId);
}

// Gönderiyi yalnızca izleyici görebiliyorsa döndürür (yoksa null → 404)
async function loadVisiblePost(postId, ctx) {
  if (!Number.isInteger(postId)) return null;
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { author: { select: { universityId: true } } },
  });
  return canViewPost(post, ctx) ? post : null;
}

const POST_INCLUDE = (userId) => ({
  author: { select: AUTHOR_SELECT },
  likes: { select: { userId: true } },
  savedBy: { where: { userId }, select: { id: true } },
  _count: { select: { comments: true } },
});

function serializePost(p, ctx) {
  return {
    id: p.id,
    imageUrl: p.imageUrl,
    caption: p.caption,
    visibility: p.visibility,
    createdAt: p.createdAt,
    author: serializeAuthor(p.author),
    isOwn: p.authorId === ctx.userId,
    isMutual: ctx.mutualIds.has(p.authorId),
    canComment: canCommentOn(p, ctx),
    likeCount: p.likes.length,
    commentCount: p._count.comments,
    likedByMe: p.likes.some((l) => l.userId === ctx.userId),
    savedByMe: p.savedBy.length > 0,
  };
}

// ---------------------------------------------------------
// GÖNDERİLER
// ---------------------------------------------------------

// GET /api/posts/feed
// Query: filter (campus|following|mine), skip, take
//  campus    : kampüsteki herkesin görünür gönderileri (varsayılan)
//  following : yalnızca takip ettiklerim
//  mine      : yalnızca benim gönderilerim
router.get('/posts/feed', requireAuth, async (req, res) => {
  try {
    const filter = ['following', 'mine'].includes(req.query.filter) ? req.query.filter : 'campus';
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
    const take = Math.min(30, Math.max(1, parseInt(req.query.take, 10) || 10));

    const ctx = await getViewerContext(req.userId);
    if (!ctx.universityId) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const where = visiblePostsWhere(ctx);
    if (filter === 'mine') where.AND.push({ authorId: req.userId });
    if (filter === 'following') where.AND.push({ authorId: { in: [...ctx.followingIds] } });

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: take + 1, // bir fazlasını isteyip "daha fazla var mı" bilgisini anlıyoruz
      include: POST_INCLUDE(req.userId),
    });

    const hasMore = posts.length > take;
    res.json({ posts: posts.slice(0, take).map((p) => serializePost(p, ctx)), hasMore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Akış yüklenemedi.' });
  }
});

// GET /api/feed/sidebar — masaüstü sağ panel: bugünkü yeni kullanıcı sayısı,
// aktif kullanıcılar ve önerilen kişiler (kendi üniversitemden, takip etmediğim).
router.get('/feed/sidebar', requireAuth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { universityId: true } });
    if (!me) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const [followingIds, excludeIds] = await Promise.all([
      getFollowingIds(req.userId),
      getBlockExclusionIds(req.userId),
    ]);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const suggestExcludeIds = [...excludeIds, ...followingIds, req.userId];

    const [newTodayCount, activeUsers, suggested] = await Promise.all([
      prisma.user.count({
        where: { universityId: me.universityId, createdAt: { gte: startOfToday } },
      }),
      prisma.user.findMany({
        where: {
          ...discoverableUserWhere(me.universityId),
          universityId: me.universityId,
          id: { notIn: [...excludeIds, req.userId] },
          showActivityStatus: true,
          lastSeenAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
        },
        orderBy: { lastSeenAt: 'desc' },
        take: 5,
        select: { id: true, fullName: true, photoUrl: true },
      }),
      prisma.user.findMany({
        where: { ...discoverableUserWhere(me.universityId), universityId: me.universityId, id: { notIn: suggestExcludeIds } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, fullName: true, photoUrl: true },
      }),
    ]);

    res.json({ newTodayCount, activeUsers, suggested });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Panel bilgileri alınamadı.' });
  }
});

// GET /api/posts/user/:userId — bir kullanıcının gönderileri (profil ızgarası için)
router.get('/posts/user/:userId', requireAuth, async (req, res) => {
  try {
    const ctx = await getViewerContext(req.userId);
    const where = visiblePostsWhere(ctx);
    where.AND.push({ authorId: Number(req.params.userId) });
    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { likes: true, comments: true } } },
    });
    res.json(
      posts.map((p) => ({
        id: p.id,
        imageUrl: p.imageUrl,
        caption: p.caption,
        createdAt: p.createdAt,
        likeCount: p._count.likes,
        commentCount: p._count.comments,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gönderiler alınamadı.' });
  }
});

// POST /api/posts — yeni gönderi paylaş (fotoğraflı ya da yalnızca metin)
router.post('/posts', requireAuth, upload.single('photo'), verifyFileSignature, async (req, res) => {
  try {
    const caption = req.body.caption?.trim() || null;
    if (!req.file && !caption) {
      return res.status(400).json({ error: 'Bir fotoğraf ekle ya da bir şeyler yaz.' });
    }
    if (caption && caption.length > CAPTION_MAX) {
      return res.status(400).json({ error: `Gönderi en fazla ${CAPTION_MAX} karakter olabilir.` });
    }
    const visibility = VISIBILITIES.includes(req.body.visibility) ? req.body.visibility : 'campus';

    const post = await prisma.post.create({
      data: {
        authorId: req.userId,
        imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
        caption,
        visibility,
      },
      include: POST_INCLUDE(req.userId),
    });

    const ctx = await getViewerContext(req.userId);
    res.status(201).json(serializePost(post, ctx));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gönderi paylaşılamadı.' });
  }
});

// DELETE /api/posts/:id — kendi gönderini sil
router.delete('/posts/:id', requireAuth, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: Number(req.params.id) } });
    if (!post) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
    if (post.authorId !== req.userId) return res.status(403).json({ error: 'Bu gönderiyi silemezsin.' });

    await prisma.comment.deleteMany({ where: { postId: post.id } });
    await prisma.postLike.deleteMany({ where: { postId: post.id } });
    await prisma.post.delete({ where: { id: post.id } });
    await removeUploadedFile(post.imageUrl);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gönderi silinemedi.' });
  }
});

// Silinen gönderi/hikayenin fotoğrafını diskten de kaldır: aksi halde dosya
// /uploads altında bağlantıyı bilen herkese açık kalmaya devam ederdi.
async function removeUploadedFile(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const filePath = path.join(PUBLIC_UPLOADS, path.basename(url));
  await fsp.unlink(filePath).catch(() => {});
}

// POST /api/posts/:id/like — beğen / beğeniyi geri al (toggle)
router.post('/posts/:id/like', requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const ctx = await getViewerContext(req.userId);
    if (!(await loadVisiblePost(postId, ctx))) return res.status(404).json({ error: 'Gönderi bulunamadı.' });

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId: req.userId } },
    });

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
      return res.json({ liked: false });
    }

    await prisma.postLike.create({ data: { postId, userId: req.userId } });

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
    if (post) {
      await createNotification(req.app.get('io'), {
        userId: post.authorId,
        type: 'like',
        actorId: req.userId,
        targetType: 'post',
        targetId: postId,
      });
    }

    res.json({ liked: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İşlem başarısız.' });
  }
});

// POST /api/posts/:id/save — kaydet / kaydı geri al (toggle)
router.post('/posts/:id/save', requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const existing = await prisma.savedPost.findUnique({
      where: { userId_postId: { userId: req.userId, postId } },
    });

    if (existing) {
      await prisma.savedPost.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }

    const ctx = await getViewerContext(req.userId);
    if (!(await loadVisiblePost(postId, ctx))) return res.status(404).json({ error: 'Gönderi bulunamadı.' });

    await prisma.savedPost.create({ data: { postId, userId: req.userId } });
    res.json({ saved: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İşlem başarısız.' });
  }
});

// GET /api/posts/saved — kaydettiğim gönderiler
router.get('/posts/saved', requireAuth, async (req, res) => {
  try {
    const ctx = await getViewerContext(req.userId);
    const saved = await prisma.savedPost.findMany({
      where: { userId: req.userId, post: visiblePostsWhere(ctx) },
      orderBy: { createdAt: 'desc' },
      include: {
        post: {
          include: {
            author: { select: AUTHOR_SELECT },
            likes: { select: { userId: true } },
            _count: { select: { comments: true } },
          },
        },
      },
    });

    const result = saved
      .filter((s) => s.post)
      .map((s) => ({
        id: s.post.id,
        imageUrl: s.post.imageUrl,
        caption: s.post.caption,
        createdAt: s.post.createdAt,
        author: serializeAuthor(s.post.author),
        isOwn: s.post.authorId === req.userId,
        likeCount: s.post.likes.length,
        commentCount: s.post._count.comments,
        likedByMe: s.post.likes.some((l) => l.userId === req.userId),
        savedByMe: true,
      }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kaydedilenler alınamadı.' });
  }
});

// GET /api/posts/:id — tekil gönderi (bildirimlerden gelen deep-link için;
// feed listesi henüz yüklenmemiş olsa bile gönderiyi doğrudan gösterebilmek içindir).
// NOT: Bu rota, yukarıdaki daha özel /posts/feed, /posts/user/:userId ve
// /posts/saved rotalarından SONRA tanımlanmalı - aksi halde Express bunları
// ":id" olarak eşleştirip asıl handler'lara hiç ulaştırmaz.
router.get('/posts/:id', requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) return res.status(404).json({ error: 'Gönderi bulunamadı.' });

    const ctx = await getViewerContext(req.userId);
    if (!(await loadVisiblePost(postId, ctx))) return res.status(404).json({ error: 'Gönderi bulunamadı.' });

    const p = await prisma.post.findUnique({ where: { id: postId }, include: POST_INCLUDE(req.userId) });
    res.json(serializePost(p, ctx));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gönderi alınamadı.' });
  }
});

// GET /api/posts/:id/comments — üst yorumlar + her birinin yanıtları (tek seviye)
router.get('/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const ctx = await getViewerContext(req.userId);
    const post = await loadVisiblePost(Number(req.params.id), ctx);
    if (!post) return res.status(404).json({ error: 'Gönderi bulunamadı.' });

    const comments = await prisma.comment.findMany({
      where: { postId: post.id, parentId: null, authorId: { notIn: [...ctx.excludeIds] } },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: AUTHOR_SELECT },
        likes: { select: { userId: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: AUTHOR_SELECT },
            likes: { select: { userId: true } },
          },
        },
      },
    });

    const formatComment = (c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      author: serializeAuthor(c.author),
      likeCount: c.likes.length,
      likedByMe: c.likes.some((l) => l.userId === req.userId),
    });

    res.json({
      canComment: canCommentOn(post, ctx),
      comments: comments.map((c) => ({
        ...formatComment(c),
        replies: c.replies.filter((r) => !ctx.excludeIds.has(r.authorId)).map((r) => formatComment(r)),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Yorumlar alınamadı.' });
  }
});

// POST /api/posts/:id/comments — yorum ekle (parentId verilirse bir yoruma yanıt olur)
router.post('/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const { content, parentId } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Yorum boş olamaz.' });
    if (content.trim().length > CAPTION_MAX) {
      return res.status(400).json({ error: `Yorum en fazla ${CAPTION_MAX} karakter olabilir.` });
    }

    const ctx = await getViewerContext(req.userId);
    const target = await loadVisiblePost(Number(req.params.id), ctx);
    if (!target) return res.status(404).json({ error: 'Gönderi bulunamadı.' });
    if (!canCommentOn(target, ctx)) {
      return res.status(403).json({ error: 'Yorum yapabilmek için karşılıklı takipleşmeniz gerekiyor.' });
    }

    let resolvedParentId = null;
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: Number(parentId) } });
      if (!parent || parent.postId !== Number(req.params.id)) {
        return res.status(400).json({ error: 'Geçersiz yanıt hedefi.' });
      }
      // Yanıta yanıt verilirse kök yoruma bağlanır, böylece tek seviye korunur.
      resolvedParentId = parent.parentId || parent.id;
    }

    const comment = await prisma.comment.create({
      data: {
        postId: Number(req.params.id),
        authorId: req.userId,
        content: content.trim(),
        parentId: resolvedParentId,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    // Gönderi sahibine "yorum yapıldı" bildirimi gönder.
    const post = await prisma.post.findUnique({ where: { id: Number(req.params.id) }, select: { authorId: true } });
    if (post) {
      await createNotification(req.app.get('io'), {
        userId: post.authorId,
        type: 'comment',
        actorId: req.userId,
        targetType: 'post',
        targetId: Number(req.params.id),
      });
    }

    // Bir yoruma yanıt verildiyse, yanıtlanan yorumun sahibine de ayrıca bildirim gönder
    // (kendi gönderisine kendi yorumuna yanıt gelmişse yukarıdaki bildirimle karışmasın diye
    // createNotification zaten aktör == alıcı ise otomatik olarak atlıyor).
    if (resolvedParentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: resolvedParentId },
        select: { authorId: true },
      });
      if (parentComment && (!post || parentComment.authorId !== post.authorId)) {
        await createNotification(req.app.get('io'), {
          userId: parentComment.authorId,
          type: 'comment',
          actorId: req.userId,
          targetType: 'post',
          targetId: Number(req.params.id),
        });
      }
    }

    res.status(201).json({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: serializeAuthor(comment.author),
      parentId: comment.parentId,
      likeCount: 0,
      likedByMe: false,
      replies: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Yorum eklenemedi.' });
  }
});

// POST /api/comments/:id/like — yorumu beğen / beğeniyi geri al (toggle, kalıcı)
router.post('/comments/:id/like', requireAuth, async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId: req.userId } },
    });

    let comment = null;
    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
    } else {
      comment = await prisma.comment.findUnique({ where: { id: commentId } });
      if (!comment) return res.status(404).json({ error: 'Yorum bulunamadı.' });
      const ctx = await getViewerContext(req.userId);
      if (!(await loadVisiblePost(comment.postId, ctx))) return res.status(404).json({ error: 'Yorum bulunamadı.' });
      await prisma.commentLike.create({ data: { commentId, userId: req.userId } });

      await createNotification(req.app.get('io'), {
        userId: comment.authorId,
        type: 'comment_like',
        actorId: req.userId,
        targetType: 'post',
        targetId: comment.postId,
      });
    }

    const likeCount = await prisma.commentLike.count({ where: { commentId } });
    res.json({ liked: !existing, likeCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İşlem başarısız.' });
  }
});

// ---------------------------------------------------------
// HİKAYELER (24 saat)
// ---------------------------------------------------------

const STORY_LIFETIME_MS = 12 * 60 * 60 * 1000;

// GET /api/stories — karşılıklı takipleştiklerim + kendim, süresi dolmamış, yazara göre gruplu
router.get('/stories', requireAuth, async (req, res) => {
  try {
    const ctx = await getViewerContext(req.userId);
    const authorIds = [...ctx.mutualIds].filter((id) => !ctx.excludeIds.has(id)).concat(req.userId);

    const stories = await prisma.story.findMany({
      where: { authorId: { in: authorIds }, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: AUTHOR_SELECT },
        views: { where: { viewerId: req.userId }, select: { id: true } },
      },
    });

    const grouped = {};
    for (const s of stories) {
      if (!grouped[s.authorId]) {
        grouped[s.authorId] = { author: s.author, stories: [] };
      }
      grouped[s.authorId].stories.push({
        id: s.id,
        imageUrl: s.imageUrl,
        createdAt: s.createdAt,
        viewedByMe: s.views.length > 0,
        expiresAt: s.expiresAt,
      });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hikayeler alınamadı.' });
  }
});

// POST /api/stories — yeni hikaye paylaş (12 saat sonra otomatik süresi dolar)
router.post('/stories', requireAuth, upload.single('photo'), verifyFileSignature, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fotoğraf gerekli.' });

    const expiresAt = new Date(Date.now() + STORY_LIFETIME_MS);
    const story = await prisma.story.create({
      data: { authorId: req.userId, imageUrl: `/uploads/${req.file.filename}`, expiresAt },
    });

    res.status(201).json(story);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hikaye paylaşılamadı.' });
  }
});

// DELETE /api/stories/:id — kendi hikayeni sil (görüntülenmeler cascade silinir)
router.delete('/stories/:id', requireAuth, async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: Number(req.params.id) } });
    if (!story) return res.status(404).json({ error: 'Hikaye bulunamadı.' });
    if (story.authorId !== req.userId) return res.status(403).json({ error: 'Bu hikayeyi silemezsin.' });

    await prisma.story.delete({ where: { id: story.id } });
    await removeUploadedFile(story.imageUrl);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hikaye silinemedi.' });
  }
});

// GET /api/stories/:id/viewers — hikayeni kimler gördü (yalnızca hikayenin sahibi)
router.get('/stories/:id/viewers', requireAuth, async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: Number(req.params.id) } });
    if (!story) return res.status(404).json({ error: 'Hikaye bulunamadı.' });
    if (story.authorId !== req.userId) return res.status(403).json({ error: 'Bu bilgiyi yalnızca hikayenin sahibi görebilir.' });

    const views = await prisma.storyView.findMany({
      where: { storyId: story.id, viewerId: { not: req.userId } },
      orderBy: { viewedAt: 'desc' },
      include: { viewer: { select: { id: true, fullName: true, photoUrl: true } } },
    });
    res.json(views.map((v) => ({ ...v.viewer, viewedAt: v.viewedAt })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Görüntüleyenler alınamadı.' });
  }
});

// POST /api/stories/:id/view — görüntülendi olarak işaretle
router.post('/stories/:id/view', requireAuth, async (req, res) => {
  try {
    const storyId = Number(req.params.id);
    const story = await prisma.story.findUnique({ where: { id: storyId }, select: { authorId: true, expiresAt: true } });
    if (!story || story.expiresAt < new Date()) return res.status(404).json({ error: 'Hikaye bulunamadı.' });
    if (story.authorId !== req.userId) {
      const ctx = await getViewerContext(req.userId);
      if (!ctx.mutualIds.has(story.authorId) || ctx.excludeIds.has(story.authorId)) {
        return res.status(403).json({ error: 'Hikayeleri yalnızca karşılıklı takipleşenler görebilir.' });
      }
    }
    await prisma.storyView.upsert({
      where: { storyId_viewerId: { storyId, viewerId: req.userId } },
      update: {},
      create: { storyId, viewerId: req.userId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İşlem başarısız.' });
  }
});

// ---------------------------------------------------------
// TAKİP SİSTEMİ (yalnızca aynı üniversiteden kişiler)
// ---------------------------------------------------------

// POST /api/users/:id/follow
router.post('/users/:id/follow', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.userId) return res.status(400).json({ error: 'Kendini takip edemezsin.' });

    const [me, target] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId } }),
      prisma.user.findUnique({ where: { id: targetId } }),
    ]);
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (me.universityId !== target.universityId && !isPremiumActive(me)) {
      return res.status(403).json({ error: 'Yalnızca kendi üniversitenden kişileri takip edebilirsin. Farklı üniversiteler için Premium gerekir.' });
    }
    if (await isBlockedEitherWay(req.userId, targetId)) {
      return res.status(403).json({ error: 'Bu kullanıcıyla etkileşime giremezsin.' });
    }

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.userId, followingId: targetId } },
      update: {},
      create: { followerId: req.userId, followingId: targetId },
    });

    await createNotification(req.app.get('io'), {
      userId: targetId,
      type: 'follow',
      actorId: req.userId,
      targetType: 'user',
      targetId: req.userId,
    });

    res.json({ following: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Takip edilemedi.' });
  }
});

// POST /api/users/:id/unfollow
router.post('/users/:id/unfollow', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    await prisma.follow.deleteMany({ where: { followerId: req.userId, followingId: targetId } });
    res.json({ following: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Takipten çıkılamadı.' });
  }
});

// GET /api/users/:id/follow-status — bu kullanıcıyı takip ediyor muyum
router.get('/users/:id/follow-status', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId, followingId: targetId } },
    });
    res.json({ following: !!existing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Durum alınamadı.' });
  }
});

// ---------------------------------------------------------
// ENGELLEME
// ---------------------------------------------------------

// GET /api/users/me/blocked — engellediğim kullanıcılar (Ayarlar sayfası)
router.get('/users/me/blocked', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.block.findMany({
      where: { blockerId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { select: AUTHOR_SELECT } },
    });
    res.json(rows.map((r) => ({ blockId: r.id, user: r.blocked, blockedAt: r.createdAt })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Engellenen kullanıcılar alınamadı.' });
  }
});

// POST /api/users/:id/block
router.post('/users/:id/block', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.userId) return res.status(400).json({ error: 'Kendini engelleyemezsin.' });

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: req.userId, blockedId: targetId } },
      update: {},
      create: { blockerId: req.userId, blockedId: targetId },
    });

    // Engellenince karşılıklı takip ilişkisi de sonlansın
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: req.userId, followingId: targetId },
          { followerId: targetId, followingId: req.userId },
        ],
      },
    });

    res.json({ blocked: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kullanıcı engellenemedi.' });
  }
});

// POST /api/users/:id/unblock
router.post('/users/:id/unblock', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    await prisma.block.deleteMany({ where: { blockerId: req.userId, blockedId: targetId } });
    res.json({ blocked: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Engel kaldırılamadı.' });
  }
});

// ---------------------------------------------------------
// PROFİL GÖRÜNTÜLEME (başka bir kullanıcının herkese açık profili)
// ---------------------------------------------------------

const PUBLIC_PROFILE_SELECT = {
  id: true,
  fullName: true,
  age: true,
  department: true,
  classYear: true,
  bio: true,
  photoUrl: true,
  interests: true,
  hobbies: true,
  intent: true,
  instagramUrl: true,
  twitterUrl: true,
  birthDate: true,
  studentDocStatus: true,
  isFrozen: true,
  isBanned: true,
  photos: { orderBy: { position: 'asc' }, select: { id: true, url: true, position: true } },
  profileVisibility: true,
  universityId: true,
  university: { select: { id: true, name: true } },
};

// Not: bu route "/:id" şeklinde olduğu için dosyanın en sonunda tanımlanır,
// aksi halde "/users/me/blocked" gibi daha spesifik rotaları gölgeleyebilirdi.
router.get('/users/:id', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (Number.isNaN(targetId)) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const [me, target] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId } }),
      prisma.user.findUnique({ where: { id: targetId }, select: PUBLIC_PROFILE_SELECT }),
    ]);
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    if (await isBlockedEitherWay(req.userId, targetId)) {
      return res.status(403).json({ error: 'Bu profili görüntüleyemezsin.' });
    }

    if (targetId !== req.userId && (target.isFrozen || target.isBanned)) {
      return res.status(404).json({ error: 'Bu hesap şu anda kullanılmıyor.' });
    }

    if (targetId !== req.userId) {
      if (target.profileVisibility === 'nobody') {
        return res.status(403).json({ error: 'Bu kullanıcı profilini gizli tutuyor.' });
      }
      if (target.profileVisibility === 'university' && me.universityId !== target.universityId) {
        return res.status(403).json({ error: 'Bu profil yalnızca kendi üniversitesindekilere açık.' });
      }
    }

    const [followerCount, followingCount, isFollowing] = await Promise.all([
      prisma.follow.count({ where: { followingId: targetId } }),
      prisma.follow.count({ where: { followerId: targetId } }),
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: req.userId, followingId: targetId } },
      }),
    ]);

    // Doğum tarihinin kendisi başkalarına gösterilmez; yalnızca güncel yaş döner.
    const { profileVisibility, universityId, birthDate: _birth, isFrozen: _f, isBanned: _b, studentDocStatus, ...publicFields } = withLiveAge(target);
    publicFields.isStudentVerified = studentDocStatus === 'approved';
    // Flört tercihleri yalnızca flört modundaki öğrencilere görünür
    if (targetId !== req.userId) publicFields.intent = visibleIntentFor(publicFields.intent, me.intent);
    res.json({ ...publicFields, followerCount, followingCount, isFollowing: !!isFollowing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Profil alınamadı.' });
  }
});

module.exports = router;
