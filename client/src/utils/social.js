// Profildeki Instagram / X bağlantıları. Sunucu yalnızca geçerli kullanıcı
// adlarını https://instagram.com/<ad> ya da https://x.com/<ad> biçiminde
// saklar (server/src/lib/social.js). Eski kayıtlar için burada da doğrulanır:
// gösterilen bağlantı her zaman bu iki sitenin güvenli adresidir.
const RULES = {
  instagram: { hosts: ['instagram.com', 'www.instagram.com', 'm.instagram.com'], re: /^[A-Za-z0-9._]{1,30}$/, base: 'https://instagram.com/' },
  x: { hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'], re: /^[A-Za-z0-9_]{1,15}$/, base: 'https://x.com/' },
};

// Kayıtlı değerden kullanıcı adı ("ece" ya da null)
export function socialHandle(network, value) {
  const rule = RULES[network];
  if (!rule || !value) return null;
  let v = String(value).trim();
  if (/^https?:\/\//i.test(v) || rule.hosts.some((h) => v.toLowerCase().startsWith(h))) {
    try {
      const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      if (!rule.hosts.includes(url.hostname.toLowerCase())) return null;
      v = url.pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return null;
    }
  }
  v = v.replace(/^@/, '');
  return rule.re.test(v) ? v : null;
}

// Gösterilebilecek güvenli bağlantı ya da null
export function socialUrl(network, value) {
  const handle = socialHandle(network, value);
  return handle ? RULES[network].base + handle : null;
}
