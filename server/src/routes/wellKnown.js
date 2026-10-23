// Telefon uygulamalarının site bağlantılarını açabilmesi için doğrulama dosyaları.
// Apple ve Google bu dosyaları indirip kampusplus.com.tr bağlantılarının
// gerçekten bizim uygulamamızda açılabileceğini doğrular.
//   APPLE_TEAM_ID        Apple Developer ekip kimliği (10 karakter)
//   ANDROID_CERT_SHA256  Google Play uygulama imzalama sertifikasının SHA-256
//                        parmak izi (birden fazlaysa virgülle)
// Değer tanımlı değilse dosya 404 döner (uygulama yine çalışır, yalnızca
// bağlantılar tarayıcıda açılır).
const express = require('express');

const APP_ID = 'tr.com.kampusplus.app';
const router = express.Router();

function appleAssociation(teamId) {
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${APP_ID}`],
          components: [
            { '/': '/admin*', exclude: true },
            { '/': '/api/*', exclude: true },
            { '/': '/uploads/*', exclude: true },
            { '/': '/*' },
          ],
        },
      ],
    },
  };
}

function androidAssetLinks(fingerprints) {
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: APP_ID, sha256_cert_fingerprints: fingerprints },
    },
  ];
}

router.get(['/.well-known/apple-app-site-association', '/apple-app-site-association'], (req, res) => {
  const teamId = (process.env.APPLE_TEAM_ID || '').trim();
  if (!/^[A-Z0-9]{10}$/.test(teamId)) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(appleAssociation(teamId));
});

router.get('/.well-known/assetlinks.json', (req, res) => {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  if (!fingerprints.length) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(androidAssetLinks(fingerprints));
});

module.exports = router;
module.exports.appleAssociation = appleAssociation;
module.exports.androidAssetLinks = androidAssetLinks;
