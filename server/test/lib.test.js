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
