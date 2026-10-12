// kampüs· service worker
// - Sayfalar her zaman önce ağdan gelir (yeni sürüm hemen görünür); internet
//   yoksa çevrimdışı ekranı gösterilir.
// - /assets/ altındaki derlenmiş dosyaların adları içerikle değiştiği için
//   önbellekten verilir (ikinci açılış anında).
// - API, dosyalar ve gerçek zamanlı bağlantı hiç önbelleğe alınmaz.
// - Anlık bildirimleri gösterir, tıklanınca ilgili sayfayı açar.
const VERSION = 'kp-v4';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL = ['/offline.html', '/offline.js', '/icon-192.png?v=2', '/favicon.svg?v=2'];
const MAX_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(`${VERSION}-`)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(api|uploads|socket\.io)\//.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches
                .open(ASSET_CACHE)
                .then((c) => c.put(request, copy))
                .then(trimAssets);
            }
            return res;
          })
      )
    );
  }
});

// ---------------- Anlık bildirimler ----------------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'kampüs·';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png?v=2',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/notifications' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  // Duyurudaki dış bağlantı yeni pencerede açılır
  if (new URL(target).origin !== self.location.origin) {
    event.waitUntil(self.clients.openWindow(target));
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Uygulama zaten açıksa o pencere öne gelir ve ilgili sayfaya gider
      const client = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        return client.focus().then((c) => (c && 'navigate' in c ? c.navigate(target) : c));
      }
      return self.clients.openWindow(target);
    })
  );
});

// Tarayıcı aboneliği kendiliğinden yenilerse (anahtar süresi vb.) sunucuya
// bildirmek için uygulama bir sonraki açılışta aboneliği yeniden eşitler
// (bkz. src/lib/push.js resyncPush).
