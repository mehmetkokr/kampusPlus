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
- **Diğer:** nodemailer (e-posta), tesseract.js (öğrenci belgesi OCR ipucu), node-cron (zamanlanmış görevler)

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
npm test
```

Sunucu testleri geçici bir veritabanı ve klasör kullanır, mevcut verine dokunmaz.
GitHub'a gönderilen her değişiklikte testler ve arayüz derlemesi otomatik çalışır
(`.github/workflows/ci.yml`).

## Özellikler

- **Hesap:** okul e-postasına 6 haneli kodla kayıt, şifremi unuttum, hesabı dondurma/silme, öğrenci belgesiyle onaylı rozet
- **Keşfet:** liste ve Kart Modu (swipe), karşılıklı beğenide eşleşme, "Seni beğenenler", ilgi alanı ve "ne arıyorsun" etiketleri
- **Sohbet:** fotoğraf, sesli mesaj ve dosya eki, okundu bilgisi, mesaj geri alma, eşleşmeyi kaldırma, engelleme
- **Akış:** gönderi, yorum, beğeni, kaydetme, 12 saatlik hikâyeler, takip
- **Kulüpler:** roller (başkan/yönetici), atma/yasaklama/susturma, kulüp sohbeti, sabitleme, anketler, etkinlikler ve katılım
- **Bildirimler, şikâyet sistemi, gizlilik ayarları, açık/koyu tema, Türkçe/İngilizce**
- **Premium:** tüm üniversitelerdeki kişilere erişim (aylık/yıllık)

## Yönetim Paneli (`/admin`)

- **Genel bakış:** DAU/MAU, kayıt grafikleri, premium dönüşüm oranı, en aktif kampüsler
- **Kullanıcılar:** filtreleme, CSV dışa aktarma, askıya alma, silme
- **Onay kuyruğu:** öğrenci belgelerini önizleme, OCR ipucu, tek tıkla onay/red (red gerekçesi öğrenciye e-postayla gider)
- **İçerik ve şikâyetler:** gönderi/hikâye/mesaj silme, şikâyetten içerik silme veya kullanıcıyı askıya alma
- **Kampüsler:** üniversite ve e-posta alan adı yönetimi
- **Kampanyalar:** hedef kitle seçerek bildirim, e-posta ve duyuru bandı

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

## Yayın (Railway)

Tek servis: sunucu, derlenmiş arayüzü (`client/dist`) de verir. `railway.json`
derleme ve başlatma komutlarını içerir; açılışta migration'lar otomatik uygulanır.

Railway > Variables:

| Değişken | Açıklama |
|---|---|
| `JWT_SECRET` | Zorunlu, uzun rastgele değer |
| `DATABASE_URL` | `file:/data/kampus.db` (kalıcı disk) |
| `STORAGE_DIR` | `/data` (yüklenen dosyalar kalıcı diskte kalsın) |
| `CLIENT_URL` | Sitenin adresi |
| `TRUST_PROXY` | `true` |
| `SMTP_*`, `MAIL_FROM` | Gerçek e-posta için zorunlu |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | İlk açılışta yönetici hesabı oluşturur |
| `SEED_DEMO_USERS` | `true` ise demo öğrenciler (gerçek kullanıcılar gelmeden kapatın) |

## Bilinen Sınırlar ve Sıradaki Adımlar

- [ ] Gerçek ödeme sağlayıcısı (iyzico) entegrasyonu
- [ ] PostgreSQL'e geçiş; çevrimiçi durumu ve socket hız sınırı için Redis (şu an tek sunucu varsayılır)
- [ ] Web Push bildirimleri (bildirimler şu an yalnızca uygulama açıkken gelir)
- [ ] DAU/MAU için gerçek "heartbeat" (`lastSeenAt` yalnızca bağlantı kopunca güncelleniyor)
- [ ] Otomatik içerik taraması / yasaklı kelime filtresi
- [ ] Onay kuyruğunda toplu işlem
- [ ] Veritabanı yedekleme ve hata izleme (ör. Sentry)
