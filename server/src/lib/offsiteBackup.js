// Yedeklerin sunucu dışına (S3 uyumlu depo: Amazon S3, Cloudflare R2,
// Backblaze B2 vb.) gönderilmesi. Sunucunun diski tümden kaybolsa bile
// veriler kurtarılabilsin diye her yedek ayrıca buraya yüklenir.
//
// Ayarlar (hepsi doluysa açılır):
//   BACKUP_S3_ENDPOINT          ör. https://<hesap>.r2.cloudflarestorage.com
//                               ya da https://s3.eu-central-1.amazonaws.com
//   BACKUP_S3_BUCKET            depo (bucket) adı
//   BACKUP_S3_REGION            R2 için "auto", S3 için ör. eu-central-1
//   BACKUP_S3_ACCESS_KEY_ID     yalnızca bu depoya yazma izni olan anahtar
//   BACKUP_S3_SECRET_ACCESS_KEY
//   BACKUP_S3_PREFIX            isteğe bağlı klasör öneki (varsayılan "kampus-backups/")
//
// İmzalama AWS Signature Version 4 ile, ek paket kullanmadan yapılır.
const crypto = require('crypto');
const fsp = require('fs/promises');

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

function offsiteConfig(env = process.env) {
  const cfg = {
    endpoint: (env.BACKUP_S3_ENDPOINT || '').replace(/\/+$/, ''),
    bucket: env.BACKUP_S3_BUCKET || '',
    region: env.BACKUP_S3_REGION || 'auto',
    accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID || '',
    secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY || '',
    prefix: env.BACKUP_S3_PREFIX ?? 'kampus-backups/',
  };
  return cfg.endpoint && cfg.bucket && cfg.accessKeyId && cfg.secretAccessKey ? cfg : null;
}

// SigV4 imzalama anahtarı (AWS belgesindeki örnek değerlerle test edilir)
function signingKey(secret, date, region, service) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), 'aws4_request');
}

// RFC 3986'ya göre yol bölümlerini kodla ("/" korunur)
const encodePath = (p) => p.split('/').map((seg) => encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');

function signRequest({ method, url, headers, payloadHash, cfg, now = new Date() }) {
  const u = new URL(url);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20261011T033000Z
  const date = amzDate.slice(0, 8);
  const all = { ...headers, host: u.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const names = Object.keys(all).map((k) => k.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonicalHeaders = names.map((n) => `${n}:${lower[n]}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [method, encodePath(u.pathname), '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${cfg.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const signature = crypto.createHmac('sha256', signingKey(cfg.secretAccessKey, date, cfg.region, 's3')).update(stringToSign).digest('hex');
  return {
    ...Object.fromEntries(Object.entries(all).filter(([k]) => k.toLowerCase() !== 'host')),
    Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

// Son yükleme durumu (yönetim paneli > Sistem'de gösterilir)
const status = { lastUploadAt: null, lastFile: null, lastError: null };

async function uploadBackup(filePath, name, cfg = offsiteConfig()) {
  if (!cfg) return { skipped: true };
  const body = await fsp.readFile(filePath);
  const url = `${cfg.endpoint}/${cfg.bucket}/${cfg.prefix}${name}`;
  const headers = signRequest({
    method: 'PUT',
    url,
    headers: { 'content-type': 'application/gzip', 'content-length': String(body.length) },
    payloadHash: sha256(body),
    cfg,
  });
  try {
    const res = await fetch(url, { method: 'PUT', headers, body });
    if (!res.ok) throw new Error(`Depo ${res.status} döndü: ${(await res.text()).slice(0, 300)}`);
    Object.assign(status, { lastUploadAt: new Date(), lastFile: name, lastError: null });
    return { uploaded: true };
  } catch (err) {
    status.lastError = err.message;
    throw err;
  }
}

const offsiteStatus = () => ({ configured: Boolean(offsiteConfig()), ...status });

module.exports = { offsiteConfig, uploadBackup, offsiteStatus, signingKey, signRequest };
