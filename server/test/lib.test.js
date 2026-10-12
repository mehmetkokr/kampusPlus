// Saf yardımcı fonksiyonların birim testleri (veritabanı gerekmez)
const test = require('node:test');
const assert = require('node:assert/strict');

const { isPremiumActive, mockPaymentsEnabled } = require('../src/lib/premium');
const { isSchoolEmail } = require('../src/lib/schoolEmail');
const { toTitleCaseTR, normalizeEmail } = require('../src/lib/text');
const { ageFromBirthDate, parseBirthDate } = require('../src/lib/age');

const DAY = 24 * 60 * 60 * 1000;

test('isPremiumActive: süre, süresiz ve kapalı premium', () => {
  assert.equal(isPremiumActive(null), false);
  assert.equal(isPremiumActive({ isPremium: false, premiumUntil: new Date(Date.now() + DAY) }), false);
  assert.equal(isPremiumActive({ isPremium: true, premiumUntil: null }), true);
  assert.equal(isPremiumActive({ isPremium: true, premiumUntil: new Date(Date.now() + DAY) }), true);
  assert.equal(isPremiumActive({ isPremium: true, premiumUntil: new Date(Date.now() - DAY) }), false);
});

test('mockPaymentsEnabled: yayında varsayılan kapalı, yerelde açık', () => {
  assert.equal(mockPaymentsEnabled({}), true);
  assert.equal(mockPaymentsEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(mockPaymentsEnabled({ RAILWAY_ENVIRONMENT_NAME: 'production' }), false);
  assert.equal(mockPaymentsEnabled({ NODE_ENV: 'production', MOCK_PAYMENTS: 'true' }), true);
  assert.equal(mockPaymentsEnabled({ MOCK_PAYMENTS: 'false' }), false);
  assert.equal(mockPaymentsEnabled({ MOCK_PAYMENTS: '' , NODE_ENV: 'production' }), false);
});

test('isSchoolEmail: alan adı ve alt alan adları', () => {
  const uni = { emailDomain: 'mku.edu.tr' };
  assert.equal(isSchoolEmail('ali@mku.edu.tr', uni), true);
  assert.equal(isSchoolEmail('ali@ogr.mku.edu.tr', uni), true);
  assert.equal(isSchoolEmail('ali@OGR.MKU.EDU.TR', uni), true);
  assert.equal(isSchoolEmail('ali@fakemku.edu.tr', uni), false);
  assert.equal(isSchoolEmail('ali@gmail.com', uni), false);
  assert.equal(isSchoolEmail('ali@mku.edu.tr', { emailDomain: null }), false);
});

test('toTitleCaseTR ve normalizeEmail', () => {
  assert.equal(toTitleCaseTR('yönetim bilişim sistemleri'), 'Yönetim Bilişim Sistemleri');
  assert.equal(toTitleCaseTR('MEHMET ali'), 'Mehmet Ali');
  assert.equal(toTitleCaseTR('işletme ve iktisat'), 'İşletme ve İktisat');
  assert.equal(toTitleCaseTR('  ali-rıza   yılmaz '), 'Ali-Rıza Yılmaz');
  assert.equal(normalizeEmail('  Ali@MKU.edu.tr '), 'ali@mku.edu.tr');
});

test('yaş hesaplama ve doğum tarihi doğrulama', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  assert.equal(ageFromBirthDate('2000-06-15', now), 26);
  assert.equal(ageFromBirthDate('2000-06-16', now), 25);
  assert.equal(ageFromBirthDate(null, now), null);
  assert.ok(parseBirthDate('').error);
  assert.ok(parseBirthDate('geçersiz').error);
  const tooYoung = new Date(Date.now() - 10 * 365 * DAY).toISOString().slice(0, 10);
  assert.ok(parseBirthDate(tooYoung).error);
  const ok = parseBirthDate('2000-01-01');
  assert.equal(ok.error, undefined);
  assert.ok(ok.age >= 18);
});

test('analitik: sayfa yolu sadeleşir, kişisel veri kalmaz', () => {
  const { normalizePath } = require('../src/lib/analytics');
  assert.equal(normalizePath('/chat/42?tab=x#son'), '/chat/:id');
  assert.equal(normalizePath('/users/17/photos'), '/users/:id/photos');
  assert.equal(normalizePath('/reset-password/3f2a9c1d4e5b6a7c8d9e'), '/reset-password/:id');
  assert.equal(normalizePath('https://kotu.site/x'), null);
});

test('hata takibi: sayılar farklı olsa da aynı hata aynı parmak izini alır', () => {
  const { fingerprintOf } = require('../src/lib/errorLog');
  const a = fingerprintOf('server', 'Kullanıcı 12 bulunamadı', 'Error\n    at f (a.js:10:5)');
  const b = fingerprintOf('server', 'Kullanıcı 37 bulunamadı', 'Error\n    at f (a.js:11:9)');
  const c = fingerprintOf('client', 'Kullanıcı 12 bulunamadı', 'Error\n    at f (a.js:10:5)');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('anlık bildirim içeriği: mesaj içeriği gösterilmez, bazı türler gönderilmez', () => {
  const { buildPayload } = require('../src/lib/push');
  const msg = buildPayload({ id: 1, type: 'message', targetId: 9, actor: { fullName: 'Ece' }, message: 'gizli metin' });
  assert.deepEqual(msg, { title: 'Ece', body: 'sana bir mesaj gönderdi.', url: '/chat/9', tag: 'message-9' });
  assert.equal(buildPayload({ id: 2, type: 'match', targetId: 3, actor: { fullName: 'Can' } }, 'en').title, "It's a match!");
  const ann = buildPayload({ id: 5, type: 'announcement', message: JSON.stringify({ title: 'Bahar şenliği', body: 'Cuma', link: '/clubs' }) });
  assert.equal(ann.url, '/clubs');
  assert.equal(buildPayload({ id: 3, type: 'club_join' }), null);
  assert.equal(buildPayload({ id: 4, type: 'weekly_summary' }), null);
});

test('TOTP: RFC 6238 test değerleri ve tekrar kullanım engeli', () => {
  const t = require('../src/lib/totp');
  const secret = t.base32Encode(Buffer.from('12345678901234567890'));
  assert.equal(t.codeAt(secret, Math.floor(59 / 30)), '287082');
  assert.equal(t.codeAt(secret, Math.floor(1111111109 / 30)), '081804');
  const now = Date.now();
  const step = Math.floor(now / 30000);
  assert.equal(t.verifyTotp(secret, t.codeAt(secret, step), { now }), step);
  assert.equal(t.verifyTotp(secret, t.codeAt(secret, step), { now, lastStep: step }), null);
});

test('S3 imzası: AWS belge örnekleriyle aynı', () => {
  const { signingKey, signRequest } = require('../src/lib/offsiteBackup');
  assert.equal(
    signingKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20120215', 'us-east-1', 'iam').toString('hex'),
    'f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d'
  );
  const h = signRequest({
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/test.txt',
    headers: { range: 'bytes=0-9' },
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    cfg: { region: 'us-east-1', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
    now: new Date('2013-05-24T00:00:00Z'),
  });
  assert.match(h.Authorization, /Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/);
});

test('kelime filtresi: küfürler gizlenir, masum kelimeler kalır', async () => {
  const { maskBannedWords } = require('../src/lib/textSafety');
  assert.equal(await maskBannedWords('S1KT1R git'), 'S***** git');
  assert.equal(await maskBannedWords('Piçler'), 'P*****');
  assert.equal(await maskBannedWords('yarın götürür müsün, sikke koleksiyonu'), 'yarın götürür müsün, sikke koleksiyonu');
});

test('sosyal bağlantı: yalnızca geçerli kullanıcı adı kabul edilir', () => {
  const { normalizeSocial } = require('../src/lib/social');
  assert.deepEqual(normalizeSocial('instagram', 'https://www.instagram.com/ece_1/?hl=tr'), { value: 'https://instagram.com/ece_1' });
  assert.ok(normalizeSocial('instagram', 'javascript:alert(1)').error);
  assert.ok(normalizeSocial('x', 'https://evil.com/jack').error);
  assert.deepEqual(normalizeSocial('x', ''), { value: null });
});

test('yıllık doğrulama durumu', () => {
  const { reverifyStatus } = require('../src/lib/reverify');
  const D = 24 * 60 * 60 * 1000;
  const now = Date.now();
  assert.equal(reverifyStatus({ schoolEmailVerifiedAt: new Date(now - 100 * D) }, now), 'ok');
  assert.equal(reverifyStatus({ schoolEmailVerifiedAt: new Date(now - 370 * D) }, now), 'due');
  assert.equal(reverifyStatus({ schoolEmailVerifiedAt: null, createdAt: new Date(now - 400 * D) }, now), 'expired');
});

test('mailer: Brevo API ile gönderim ve hata durumu panele yansır', async () => {
  const mailer = require('../src/lib/mailer');
  const saved = { key: process.env.BREVO_API_KEY, from: process.env.MAIL_FROM, fetch: global.fetch };
  process.env.BREVO_API_KEY = 'test-key';
  process.env.MAIL_FROM = 'kampüs+ <destek@ornek.com>';
  const calls = [];
  try {
    global.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, json: async () => ({}) };
    };
    const out = await mailer.sendMail({ to: 'ali@ogr.mku.edu.tr', subject: 'Kod', html: '<b>1</b>', text: '1' });
    assert.deepEqual(out, { delivered: true, mode: 'brevo' });
    assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(calls[0].opts.headers['api-key'], 'test-key');
    const body = JSON.parse(calls[0].opts.body);
    assert.deepEqual(body.sender, { name: 'kampüs+', email: 'destek@ornek.com' });
    assert.deepEqual(body.to, [{ email: 'ali@ogr.mku.edu.tr' }]);
    assert.equal(mailer.mailStatus().ok, true);

    global.fetch = async () => ({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ message: 'Key not found' }) });
    await assert.rejects(mailer.sendMail({ to: 'a@b.com', subject: 's', html: 'h' }), /Brevo 401: Key not found/);
    const st = mailer.mailStatus();
    assert.equal(st.mode, 'brevo');
    assert.equal(st.ok, false);
    assert.match(st.error, /Key not found/);
  } finally {
    global.fetch = saved.fetch;
    if (saved.key === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = saved.key;
    if (saved.from === undefined) delete process.env.MAIL_FROM;
    else process.env.MAIL_FROM = saved.from;
  }
});
