// Apple ve Google ile giriş. Tarayıcı sağlayıcıdan bir kimlik belirteci (ID
// token) alır; burada sağlayıcının açık anahtarlarıyla imzası, yayıncısı ve
// hedef kitlesi (bizim istemci kimliğimiz) doğrulanır. Sırlar gerekmez:
//
//   GOOGLE_CLIENT_ID  Google Cloud > Kimlik bilgileri > OAuth istemci kimliği (Web)
//   APPLE_CLIENT_ID   Apple Developer > Identifiers > Services ID (ör. app.kampus.web)
//
// Değişken tanımlı değilse o düğme istemcide hiç gösterilmez.
const jwt = require('jsonwebtoken');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

const PROVIDER_FIELD = { google: 'googleId', apple: 'appleId' };
const TICKET_TTL = '15m';

function providerConfig() {
  return {
    google: process.env.GOOGLE_CLIENT_ID || null,
    apple: process.env.APPLE_CLIENT_ID || null,
  };
}

// Apple ve Google "email_verified" alanını bazen metin olarak gönderir
const isTrue = (v) => v === true || v === 'true';

async function verifyGoogle(credential) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) throw Object.assign(new Error('Google ile giriş etkin değil.'), { status: 503 });
  const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience,
  });
  return {
    sub: String(payload.sub),
    email: isTrue(payload.email_verified) ? String(payload.email || '').toLowerCase() : null,
    name: payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(' ') || null,
  };
}

async function verifyApple(idToken) {
  const audience = process.env.APPLE_CLIENT_ID;
  if (!audience) throw Object.assign(new Error('Apple ile giriş etkin değil.'), { status: 503 });
  const { payload } = await jwtVerify(idToken, APPLE_JWKS, { issuer: 'https://appleid.apple.com', audience });
  return {
    sub: String(payload.sub),
    email: isTrue(payload.email_verified) ? String(payload.email || '').toLowerCase() : null,
    name: null, // Apple adı yalnızca ilk girişte, belirtecin dışında gönderir
  };
}

// Okul e-postasıyla eşleşmeyen sağlayıcı hesabı için kısa ömürlü bilet:
// kullanıcı okul e-postasıyla kaydolunca ya da şifresiyle girince hesaba bağlanır.
function signTicket({ provider, sub, name }) {
  return jwt.sign({ kind: 'oauth', provider, sub, name: name || null }, process.env.JWT_SECRET, { expiresIn: TICKET_TTL });
}

function readTicket(ticket) {
  if (!ticket) return null;
  try {
    const data = jwt.verify(ticket, process.env.JWT_SECRET);
    return data.kind === 'oauth' && PROVIDER_FIELD[data.provider] ? data : null;
  } catch {
    return null;
  }
}

// Bilet geçerliyse sağlayıcı kimliğini hesaba bağlar. Kimlik başka bir hesaba
// bağlıysa ya da hesapta bu sağlayıcı zaten varsa dokunulmaz.
async function linkFromTicket(prisma, userId, ticket) {
  const data = readTicket(ticket);
  if (!data) return false;
  const field = PROVIDER_FIELD[data.provider];
  const [owner, user] = await Promise.all([
    prisma.user.findUnique({ where: { [field]: data.sub }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { [field]: true } }),
  ]);
  if (owner || !user || user[field]) return false;
  await prisma.user.update({ where: { id: userId }, data: { [field]: data.sub } });
  return true;
}

module.exports = { PROVIDER_FIELD, providerConfig, verifyGoogle, verifyApple, signTicket, readTicket, linkFromTicket };
