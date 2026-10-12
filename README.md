# kampüs· (KampüsPlus)

Üniversite öğrencileri için kapalı kampüs ağı: eşleşme, sohbet, sosyal akış ve kulüpler.
Kayıt yalnızca seçilen üniversitenin okul e-postasıyla yapılır; öğrenciler kendi
kampüslerindeki kişileri görür (Premium ile tüm üniversiteler).

## Teknoloji Yığını

- **Arayüz:** React 18 + Vite 5, React Router, Tailwind CSS 4, Framer Motion, three.js (açılış sayfasındaki 3D sahneler)
- **Sunucu:** Node.js 20+ ve Express 4
- **Veritabanı:** SQLite (Prisma ORM)
- **Gerçek zamanlı:** Socket.io (birebir ve kulüp sohbeti, çevrimiçi durumu)
- **Kimlik doğrulama:** JWT (7 gün; şifre sıfırlama ve "tüm cihazlardan çıkış" eski oturumları geçersiz kılar)
- **Diğer:** nodemailer (e-posta), tesseract.js (öğrenci belgesi OCR ipucu), node-cron (zamanlanmış görevler), web-push (anlık bildirim)
- **Kalite:** node:test (sunucu), Vitest + Testing Library ve ESLint (arayüz), Playwright (uçtan uca, gerçek tarayıcı), GitHub Actions

## Kurulum (Kendi Bilgisayarında)

`server/.env.example` dosyasını `server/.env` olarak kopyala ve en az
`JWT_SECRET` değerini doldur (sunucu bu değer olmadan açılmaz):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Ana klasörde:

```bash
npm run setup   # bağımlılıkları kurar, veritabanını oluşturur, üniversiteleri ekler
npm run dev     # sunucu (4000) + arayüz (5173) birlikte başlar
```

Tarayıcıda **http://localhost:5173** adresini aç. 4000 portu yalnızca API'dir.

SMTP bilgileri boşsa doğrulama kodları ve şifre sıfırlama bağlantıları e-posta
yerine sunucu konsoluna yazılır; yerelde kayıt olmak için bu yeterlidir.

Yönetici hesabı için: `npm run admin:create --prefix server`

### Güncellemeleri çektikten sonra

```bash
cd server
npm install
npx prisma migrate deploy
```

### Testler

```bash
npm test           # sunucu + arayüz testleri
npm run lint       # arayüz kod denetimi (uyarı da kabul edilmez)
npm run test:e2e   # uçtan uca testler (gerçek tarayıcıda kayıt, eşleşme, sohbet, ayarlar, erişilebilirlik)
npm run load-test --prefix server   # yük testi (geçici veritabanında)
```

Uçtan uca testler için bir kez `npx playwright install chromium` (client
klasöründe) gerekir; Windows'ta yüklü Edge ile de çalışır:
`E2E_CHANNEL=msedge npm run test:e2e --prefix client`. Testler kendi geçici
veritabanını ve deneme hesaplarını kurar.

Sunucu testleri geçici bir veritabanı ve klasör kullanır, mevcut verine dokunmaz.
GitHub'a gönderilen her değişiklikte testler, kod denetimi ve arayüz derlemesi
otomatik çalışır (`.github/workflows/ci.yml`).

## Özellikler

- **Hesap:** okul e-postasına 6 haneli kodla kayıt, yılda bir okul e-postasıyla yeniden doğrulama (mezunlar listelerden gizlenir), okul e-postasını değiştirme (aynı üniversite, kodla), şifre değiştirme, şifremi unuttum, verilerimi indir (KVKK), hesabı dondurma/silme, öğrenci belgesiyle onaylı rozet
- **Keşfet:** liste ve Kart Modu (swipe), karşılıklı beğenide eşleşme, "Seni beğenenler", ilgi alanı ve "ne arıyorsun" etiketleri; "geç" denen kişi 30 gün gelmez, Premium'da son karar geri alınır
- **Sohbet:** fotoğraf, sesli mesaj ve dosya eki, okundu bilgisi, yanıtlama (alıntı), emoji tepkileri, mesaj geri alma, mesaj şikâyeti, eşleşmeyi kaldırma, engelleme; sohbet listesinde son mesaj, saat ve okunmamış sayısı, menüde okunmamış rozeti
- **Akış:** gönderi, yorum, beğeni, kaydetme, 12 saatlik hikâyeler, takip
- **Kulüpler:** roller (başkan/yönetici), atma/yasaklama/susturma, kulüp sohbeti, sabitleme, anketler, etkinlikler ve katılım, etkinlikten önce katılımcılara hatırlatma
- **Bildirimler:** uygulama içinde anlık; bildirim izni verilen cihazlara uygulama kapalıyken de (Web Push). iPhone'da uygulama ana ekrana eklenince çalışır
- **Telefona yükleme (PWA):** ana ekrana eklenir, tam ekran açılır, internet yokken bilgi ekranı gösterir
- **Şikâyet sistemi, gizlilik ayarları, açık/koyu tema, Türkçe/İngilizce**
- **Premium:** tüm üniversitelerdeki kişilere erişim (aylık/yıllık)

## Yönetim Paneli (`/admin`)

- **Genel bakış:** DAU/MAU, kayıt grafikleri, premium dönüşüm oranı, en aktif kampüsler
- **Kullanıcılar:** filtreleme, CSV dışa aktarma, askıya alma, silme
- **Onay kuyruğu:** öğrenci belgelerini önizleme, OCR ipucu, tek tıkla onay/red (red gerekçesi öğrenciye e-postayla gider)
- **İçerik ve şikâyetler:** gönderi/hikâye/mesaj silme, şikâyetten içerik silme veya kullanıcıyı askıya alma
- **Kampüsler:** üniversite ve e-posta alan adı yönetimi
- **Kampanyalar:** hedef kitle seçerek bildirim (uygulama kapalıysa telefona da), e-posta ve duyuru bandı
- **Analitik:** tekil ziyaretçi, en çok açılan sayfalar, ziyaretten ilk beğeniye kayıt hunisi, Premium dönüşümü
- **Onay kuyruğu:** toplu seçim, toplu onay/red
- **Sistem:** veritabanı yedekleri (alma/indirme, dış depo durumu), hata kayıtları, yönetici işlem kaydı, bildirim alan cihaz sayısı
- **Ayarlar:** yöneticiler, iki adımlı doğrulama (TOTP), yasaklı kelimeler

OCR sonucu yalnızca admin'e ipucudur; hiçbir hesabı tek başına doğrulamaz.

## Premium ve Ödeme

Gerçek ödeme sağlayıcısı (iyzico) henüz bağlı değil. `POST /api/premium/activate`
ödeme almadan premium açtığı için **yayında varsayılan olarak kapalıdır**
(`NODE_ENV=production` veya Railway ortamı); arayüzde "Çok Yakında" görünür.
Yerelde açıktır. `MOCK_PAYMENTS` değişkeniyle bu davranış değiştirilebilir
(bkz. `server/.env.example`).

Otomatik yenilemeyi kapatmak erişimi hemen kesmez; premium `premiumUntil`
tarihine kadar sürer.

Ödeme bağlanırken değişecek yer: `server/src/routes/premium.js` (ödeme
başlatma + imzalı webhook) ve `PaymentLog` tablosu.

## Dosyalar ve Temizlik

- Herkese açık dosyalar (profil, gönderi, hikâye görselleri): `uploads/`
- Özel dosyalar (öğrenci belgesi, sohbet ekleri): `private-uploads/`. Yalnızca
  `/api/files/...` üzerinden, yetki kontrolüyle açılır.
- Hesap silinince veya şikâyet sonucu içerik kaldırılınca dosyalar diskten hemen silinir.
- Her gece 04:00'te (`server/src/lib/uploads.js`): süresi 7 günden uzun süre önce
  dolmuş hikâyeler (bekleyen şikâyeti olanlar hariç) ve hiçbir kayda bağlı olmayan
  dosyalar silinir.

## Yedek, Hata Takibi, Bildirim ve Analitik

- **Yedek** (`server/src/lib/backup.js`): her gece 03:30'da veritabanının tutarlı
  bir kopyası sıkıştırılıp `STORAGE_DIR/backups` altına yazılır; son 14 tanesi
  (`BACKUP_KEEP`) saklanır. Yönetim paneli > Sistem'den elle alınıp indirilebilir.
  Yedekler sunucuyla aynı diskte durduğu için ara sıra indirip ayrıca saklayın.
  Geri yükleme: dosyayı açın (`gunzip`), sunucuyu durdurun, `DATABASE_URL`'deki
  dosyanın yerine koyun, sunucuyu başlatın.
- **Hata takibi** (`server/src/lib/errorLog.js`, `client/src/lib/telemetry.js`):
  sunucu ve tarayıcı hataları `ErrorLog` tablosuna yazılır, aynı hata tek satırda
  sayılır; panelde Sistem sayfasında görünür. `SENTRY_DSN` / `VITE_SENTRY_DSN`
  tanımlanırsa ayrıca Sentry'ye gider.
- **Anlık bildirim** (`server/src/lib/push.js`, `client/public/sw.js`): her
  bildirim kaydı, kullanıcı o an uygulamada değilse kayıtlı cihazlarına da
  gönderilir. Kilit ekranında mesaj içeriği gösterilmez. Anahtarlar ilk açılışta
  `STORAGE_DIR/vapid-keys.json` dosyasına üretilir; **bu dosyayı silmeyin**.
- **Analitik** (`server/src/lib/analytics.js`): sayfa görüntüleme ve kayıt
  adımları kendi veritabanımızda tutulur; IP, konum, cihaz bilgisi tutulmaz.
  Olaylar 180 gün, hata kayıtları 90 gün saklanır.

## Güvenlik ve Moderasyon

- **Metin kuralları** (`server/src/lib/textSafety.js`): mesaj 2000, hakkımda 300,
  gönderi/yorum 280 karakter; sınırlar sunucuda da uygulanır. Yaygın küfürler
  (ve panelden eklenen kelimeler) ilk harfi kalacak şekilde yıldızlanır.
- **Oturumlar:** askıya alma, tüm cihazlardan çıkış, şifre değişikliği ya da
  hesap silmede açık gerçek zamanlı bağlantılar hemen kapanır.
- **Özel dosyalar** adreste oturum anahtarıyla değil, yalnızca dosya açmaya
  yarayan 24 saatlik anahtarla (`?ft=`) açılır.
- **Sosyal bağlantılar** yalnızca geçerli Instagram/X kullanıcı adı olarak
  kaydedilir ve gösterilir.
- **Yönetici işlem kaydı** (`server/src/lib/audit.js`): panelden geçen her
  başarılı değişiklik otomatik kaydedilir; şifre/kod gibi alanlar yazılmaz.
- **Yüklemeler** (`server/src/lib/fileValidation.js`, `safeServe.js`): her alan
  yalnızca kendi türünü kabul eder (fotoğraf alanına PDF gönderilemez), içerik
  dosya imzasıyla doğrulanır; ad rastgele, uzantı doğrulanmış türden üretilir
  (içi PNG olan `x.html` sayfa olarak açılamaz). Dosyalar `nosniff` ve betik
  çalıştırmayan güvenlik politikasıyla sunulur; görsel, ses ve PDF dışındaki
  ekler indirilir. Herkese açık klasörden yalnızca görseller verilir.
- **Konum gizliliği** (`server/src/lib/stripMetadata.js`): yüklenen JPEG/PNG/WebP
  görsellerden GPS, cihaz modeli, tarih ve yorumlar silinir (görüntü değişmez;
  JPEG'de yalnızca yön bilgisi kalır).
- **Hesap varlığı gizli:** kayıt kodu, giriş ve şifremi unuttum yanıtları bir
  adresin kayıtlı olup olmadığını ne mesajla ne süreyle belli eder. Kayıtlı
  adrese kod yerine "zaten hesabın var" e-postası gider. E-postalardaki ad ve
  bağlantılar HTML olarak kaçışlanır.
- **Güvenlik politikası (CSP):** satır içi betik yok (`script-src 'self'`); tema
  `public/theme-init.js` dosyasından yüklenir.
- **Gerçek zamanlı bağlantı:** eksik ya da bozuk olay yükleri sunucuyu düşürmez.
- **Kapalı kampüs ve gizlilik** (`server/src/lib/privacy.js` → `reachCheck`): profil
  görüntüleme, takip ve beğenme aynı kurala bağlı. Yönetici, dondurulmuş ve askıya
  alınmış hesaplar yok sayılır; profilini gizleyen ya da yalnızca kendi
  üniversitesine açan kişiye ve (Premium olmadan) başka üniversiteden birine
  numarayla ulaşılamaz. Aralarında eşleşme, takip ya da beğeni varsa ulaşılabilir.
- **Çevrimiçi durumu** yalnızca eşleşilen kişilere gider (herkese yayınlanmaz).
- **Şikâyet** yalnızca şikâyet edenin görebildiği içerik için açılabilir.
- **Hesap bazlı giriş koruması** (`server/src/lib/loginGuard.js`): aynı e-postaya
  15 dakikada 8 hatalı deneme (`ACCOUNT_LOGIN_LIMIT`) o adresi 15 dakika kilitler;
  çok sayıda IP'den tek hesaba şifre tahminini durdurur. Kayıtsız adreste de aynı
  çalışır; şifre sıfırlama kilidi kaldırır.
- **Demo hesaplar:** yayında `SEED_DEMO_USERS` açık değilse ve demo hesapların
  şifresi hâlâ `12345678` ise sunucu açılışta onları askıya alır.
- **Yayın ayarları kartı:** yönetim paneli > Sistem, eksik yayın ayarlarını
  (SMTP, kalıcı disk, `JWT_SECRET`, site adresi) listeler.
- **İki adımlı doğrulama:** yöneticiler panel > Ayarlar'dan açar.
  `ADMIN_REQUIRE_2FA=true` ile zorunlu olur. Telefon kaybında:
  `npm run admin:reset-2fa --prefix server -- e-posta`.

## Arama Motorları (SEO)

- Sunucu her sayfayı kendi başlığı, açıklaması, canonical adresi ve
  og:/twitter: etiketleriyle verir (`server/src/lib/seo.js`); paylaşım botları
  JavaScript çalıştırmasa da doğru önizlemeyi görür.
- Oturum gerektiren sayfalar `noindex` (ve `X-Robots-Tag`), bilinmeyen adresler
  gerçek **404** durum koduyla döner.
- `robots.txt` ve `sitemap.xml` yayındaki gerçek adresle üretilir (`SITE_URL`
  ya da Railway alan adı); derlemedeki varsayılan adres kullanılmaz.
- Arama botları siteyi her zaman Türkçe görür (Googlebot kendini İngilizce
  tanıtsa da).
- Ana sayfada SSS yapılandırılmış verisi (FAQPage), tüm sayfalarda kuruluş ve
  site bilgisi (Organization, WebSite) bulunur.
- Yayından sonra Google Search Console'a siteyi ekleyip `/sitemap.xml`
  adresini gönderin.

## İzleme ve Uyarılar

- **Yönetici uyarıları** (`server/src/lib/alerts.js`): ilk kez görülen ya da
  çok tekrarlayan sunucu hatası, başarısız yedek/dış depo yüklemesi ve yeni
  şikâyette yöneticilere e-posta ve anlık bildirim gider (aynı tür en fazla
  30–60 dakikada bir). Alıcılar: `ADMIN_ALERT_EMAILS` ya da tüm yöneticiler.
- **Ayakta mı takibi** (`.github/workflows/uptime.yml`): GitHub, 15 dakikada bir
  `/api/health` adresini yoklar; site ya da veritabanı yanıt vermezse iş
  başarısız olur ve depo sahibine e-posta gider. Açmak için GitHub > Settings >
  Secrets and variables > Actions > Variables > `SITE_URL`.
- **Sağlık kontrolü** veritabanına da sorgu atar; Railway erişilemeyen sunucuyu
  yeniden başlatır.

## Felaketten Kurtarma

Sunucuyu durdurup yedekten geri yükle (yedek adı panel > Sistem'de görünür ya da
indirilen dosyanın yolu verilir):

```bash
npm run backup:restore --prefix server -- kampus-20261011-033000.db.gz --yes
```

Komut yedeği doğrular, mevcut veritabanını yanına
`.geri-yukleme-oncesi-<zaman>` adıyla saklar, yedeği yerine koyar ve eksik
veritabanı değişikliklerini uygular. Bu akış her test çalıştırmasında
`server/test/restore.test.js` ile prova edilir.

## Performans ve Erişilebilirlik

- **Yük testi** (`npm run load-test --prefix server`): 300 öğrenci, 40 eşleşme ×
  30 mesaj ve 500 gönderilik geçici veritabanında, 50 eşzamanlı kullanıcıyla.
  Son ölçüm (geliştirici dizüstü, tek süreç, SQLite):

  | Uç | İstek/sn | p50 | p95 |
  |---|---|---|---|
  | Sağlık kontrolü | 2053 | 23 ms | 35 ms |
  | Profilim | 598 | 82 ms | 102 ms |
  | Keşfet ana sayfa | 204 | 242 ms | 278 ms |
  | Kart Modu destesi | 362 | 135 ms | 168 ms |
  | Akış | 446 | 106 ms | 151 ms |
  | Sohbet listesi | 296 | 167 ms | 193 ms |
  | Sohbet geçmişi | 607 | 81 ms | 98 ms |

  Tek kampüs için fazlasıyla yeterli. Birden çok sunucuya geçilecekse
  çevrimiçi durumu, hız sınırları ve kulüp yavaş modu bellekte tutulduğu için
  Redis'e, veritabanı PostgreSQL'e taşınmalı.
- **Telefon performansı:** sunucu metin yanıtları sıkıştırır (ana JavaScript
  270 KB yerine ~94 KB). Telefonda ve zayıf cihazda ana sayfadaki 3D renk
  geçişi ve 3D harita yüklenmez (yerine CSS geçişi ve düz harita); yönetim
  panelinin kodu ve yazı tipi yalnızca `/admin` açılınca iner. Lighthouse
  (telefon): ana sayfa 75, giriş/kayıt 97–98; SEO ve erişilebilirlik 100.
- **Erişilebilirlik** (`client/e2e/a11y.spec.js`): açık ve koyu temada tüm ana
  sayfalar axe-core ile WCAG 2.1 A/AA'ya göre taranır; ihlal varsa CI durur.
  Renk sistemi buna göre ayarlıdır: `--amber-soft` yazı mavisi, `--accent-fill`
  beyaz yazılı dolu zemin mavisi (tek bir mavi iki kontrast sınırını aynı anda
  geçemez).

## Yayın (Railway)

Tek servis: sunucu, derlenmiş arayüzü (`client/dist`) de verir. `railway.json`
derleme ve başlatma komutlarını içerir; açılışta migration'lar otomatik uygulanır.

Railway > Variables:

| Değişken | Açıklama |
|---|---|
| `JWT_SECRET` | Zorunlu, uzun rastgele değer |
| `DATABASE_URL` | `file:/data/kampus.db` (kalıcı disk) |
| `STORAGE_DIR` | `/data` (yüklenen dosyalar kalıcı diskte kalsın) |
| `SITE_URL` | Sitenin adresi (ör. `https://kampusplus.app`). Boşsa Railway alan adı kullanılır; e-posta bağlantıları, sitemap ve canonical buna göre yazılır |
| `TRUST_PROXY` | Railway'de boş bırakılabilir (kendiliğinden açık) |
| `BREVO_API_KEY` ya da `SMTP_*`, `MAIL_FROM` | Gerçek e-posta için zorunlu. Railway SMTP portlarını kapatıyorsa Brevo API (HTTPS) kullanın |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | İlk açılışta yönetici hesabı oluşturur |
| `SEED_DEMO_USERS` | `true` ise demo öğrenciler (gerçek kullanıcılar gelmeden kapatın) |
| `SENTRY_DSN`, `VITE_SENTRY_DSN` | İsteğe bağlı, Sentry hata takibi |
| `BACKUP_KEEP` | İsteğe bağlı, saklanacak yedek sayısı (varsayılan 14) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | İsteğe bağlı; boşsa anahtarlar otomatik üretilir |
| `BACKUP_S3_*` | İsteğe bağlı (önerilir): yedeklerin S3/R2'ye de gönderilmesi |
| `ADMIN_REQUIRE_2FA` | `true` ise yöneticiler için iki adımlı doğrulama zorunlu |
| `ADMIN_ALERT_EMAILS` | İsteğe bağlı; uyarıların gideceği adresler (boşsa tüm yöneticiler) |
| `VITE_SITE_URL`, `VITE_CONTACT_EMAIL` | Alan adı ve iletişim adresi; index.html, robots.txt ve sitemap.xml derlemede güncellenir |

## Bilinen Sınırlar ve Sıradaki Adımlar

- [ ] Gerçek ödeme sağlayıcısı (iyzico) entegrasyonu
- [ ] PostgreSQL'e geçiş; çevrimiçi durumu ve socket hız sınırı için Redis (şu an tek sunucu varsayılır)
- [x] Web Push bildirimleri ve telefona yükleme (PWA)
- [ ] Otomatik fotoğraf taraması (şimdilik şikâyet sistemi)
- [x] Veritabanı yedekleme ve hata izleme (isteğe bağlı Sentry)
- [x] Kendi analitiğimiz (kayıt hunisi, sayfa görüntüleme)
- [x] Arayüz testleri ve kod denetimi
- [x] Yedeklerin dış depoya (S3/R2) otomatik gönderilmesi (`BACKUP_S3_*` ayarlarıyla)
- [x] Uçtan uca testler, yönetici iki adımlı doğrulaması ve işlem kaydı
- [x] DAU/MAU için heartbeat (bağlı kullanıcıların son görülmesi 5 dakikada bir güncellenir)
- [x] Yasaklı kelime filtresi ve onay kuyruğunda toplu işlem
- [x] Yönetici uyarıları, ayakta mı takibi, geri yükleme komutu ve provası
- [x] Okul e-postası değiştirme, erişilebilirlik taraması (WCAG AA), yük testi

## Yayın Öncesi Kontrol Listesi

**Ödeme (iyzico ya da Stripe)** — işyeri hesabı açıldığında:

1. Sağlayıcının test (sandbox) anahtarlarını alın; bana iletmeyin, Railway >
   Variables'a kendiniz ekleyin.
2. `server/src/routes/premium.js`: `activate` yerine ödeme başlatma (sağlayıcının
   ödeme sayfasına yönlendirme) ve imzası doğrulanan bir webhook ucu eklenir.
   Premium yalnızca webhook "ödeme başarılı" dediğinde açılır; her ödeme
   `PaymentLog`'a yazılır.
3. Otomatik yenileme sağlayıcının abonelik özelliğiyle yapılır; `premiumAutoRenew`
   kapatılınca abonelik sağlayıcıda da iptal edilir.
4. Test kartlarıyla uçtan uca denenir, sonra `MOCK_PAYMENTS` kapalı kalacak
   şekilde canlı anahtarlara geçilir.
5. Mesafeli satış sözleşmesi, ön bilgilendirme formu ve iade/cayma koşulları
   ödeme sayfasından önce gösterilir (hukukçu metni).

**Hukuki metinler** (`client/src/pages/LegalPage.jsx`) — hukukçuya sorulacaklar:

- Veri sorumlusunun unvanı, adresi, iletişim bilgisi; gerekiyorsa VERBİS kaydı.
- Öğrenci belgesi ve doğum tarihi için açık rıza gerekip gerekmediği; gerekiyorsa
  kayıt ekranına ayrı onay kutusu.
- Yurt dışına aktarım: sunucu (Railway), e-posta sağlayıcısı, bildirim servisleri
  (Google/Apple/Mozilla) ve Sentry yurt dışında. KVKK m.9 kapsamında gereken
  dayanak ve aydınlatma.
- Yedeklerde silinen hesap verilerinin 14 gün kalması, analitik (180 gün) ve
  hata kayıtları (90 gün) saklama süreleri.
- Premium: mesafeli satış sözleşmesi, cayma hakkı, otomatik yenileme bildirimi.
- 18 yaş sınırı ve kullanıcılar arası buluşmalarda sorumluluk maddesi.
