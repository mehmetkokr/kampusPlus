// Profildeki sosyal medya bağlantıları. Kullanıcı "@ad", "ad" ya da sitenin
// tam adresini yazabilir; yalnızca geçerli bir kullanıcı adı çıkarılabilirse
// kabul edilir ve standart https adresine çevrilir. Böylece profilde
// "javascript:" gibi tehlikeli bağlantılar asla gösterilemez.
const NETWORKS = {
  instagram: { hosts: ['instagram.com', 'www.instagram.com', 'm.instagram.com'], re: /^[A-Za-z0-9._]{1,30}$/, base: 'https://instagram.com/', label: 'Instagram' },
  x: { hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'], re: /^[A-Za-z0-9_]{1,15}$/, base: 'https://x.com/', label: 'X' },
};

function usernameFrom(network, raw) {
  const n = NETWORKS[network];
  let v = String(raw).trim();
  if (/^https?:\/\//i.test(v) || n.hosts.some((h) => v.toLowerCase().startsWith(h))) {
    try {
      const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      if (!n.hosts.includes(url.hostname.toLowerCase())) return null;
      v = url.pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return null;
    }
  }
  v = v.replace(/^@/, '');
  return n.re.test(v) ? v : null;
}

// { value: string|null } | { error }
function normalizeSocial(network, raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return { value: null };
  if (typeof raw !== 'string' || raw.length > 200) return { error: `${NETWORKS[network].label} hesabı geçersiz.` };
  const user = usernameFrom(network, raw);
  if (!user) return { error: `${NETWORKS[network].label} için kullanıcı adını ya da profil adresini yaz.` };
  return { value: NETWORKS[network].base + user };
}

module.exports = { normalizeSocial };
