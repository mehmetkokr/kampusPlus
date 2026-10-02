# Kampüs Eşleşme & Sohbet Uygulaması

Üniversite öğrencileri için kapalı kampüs eşleşme ve sohbet platformu.
Sadece aynı üniversitedeki doğrulanmış öğrenciler birbirini görebilir.

## Teknoloji Yığını

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Veritabanı:** SQLite (Prisma ORM ile)
- **Gerçek zamanlı mesajlaşma:** Socket.io
- **Kimlik doğrulama:** JWT

## Kurulum (Kendi Bilgisayarında)

### ⚡ Hızlı Yol (Tek Komutla)

Proje artık tek komutla kurulup çalıştırılabiliyor. Ana klasörde (`kampus-app/`) şunu çalıştır:

```bash
npm run setup   # bağımlılıkları kurar, veritabanını oluşturur, örnek üniversiteleri ekler
npm run dev     # backend + frontend'i aynı anda başlatır
```

Sonra tarayıcıda **http://localhost:5173** adresine git. (4000 değil, 3000 değil — **5173**.)

> `npm run dev` çalıştığında terminalde iki renkli satır göreceksin: mavi (SERVER, port 4000) ve yeşil (CLIENT, port 5173). Açman gereken adres her zaman **CLIENT** satırındaki adres, yani 5173.

### 🔧 Manuel Yol (İki Ayrı Terminal)

Tek komutu kullanmak istemezsen, eskisi gibi iki terminalle de çalıştırabilirsin:

#### 1. Backend'i kur

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
```

Bu adımlar:
- Bağımlılıkları kurar
- Prisma client'ı oluşturur
- Veritabanı tablolarını oluşturur (dev.db dosyası oluşur)
- Örnek üniversite listesini ekler
- Sunucuyu **http://localhost:4000** adresinde başlatır (bu adres bir API sunucusudur, tarayıcıda açılması beklenmez — sadece `/api/health` gibi yolları test edebilirsin)

#### 2. Frontend'i kur (yeni bir terminal penceresinde)

```bash
cd client
npm install
npm run dev
```

Bu, **http://localhost:5173** adresinde uygulamayı açar — siteyi görmek için tarayıcıda gitmen gereken adres budur.

### 3. Tarayıcıda aç

**http://localhost:5173** adresine git, kayıt ol ve dene.

⚠️ **Sık yapılan hata:** `localhost:3000` veya `localhost:4000` adresine gitmeye çalışmak. Bu projede 3000 portu hiç kullanılmıyor; 4000 sadece arka plandaki API'dir, site arayüzü değildir. Tarayıcıda görmen gereken tek adres **5173**'tür.

### Backend portunu değiştirmek istersen

`server/.env` içindeki `PORT` değerini değiştir, ve `client/.env` içindeki `VITE_API_URL` değerini de aynı porta güncelle (örn. her ikisi de `4001` olacak şekilde). İki taraf da senkron olmalı.

## Önemli Notlar

- **Üniversite e-posta domaini ile otomatik doğrulama:** `prisma/seed.js` dosyasındaki
  üniversite listesinde her üniversite için bir `emailDomain` tanımlı (örn. `itu.edu.tr`).
  Eğer kayıt olurken kullandığın e-posta bu domain ile bitiyorsa, hesap otomatik
  doğrulanır. Aksi halde öğrenci belgesi yüklemen ve manuel onay beklemen gerekir.

- **Manuel inceleme:** Şu an manuel onay mekanizması veritabanında var
  (`verificationStatus: manual_review`) ama onaylayan bir admin paneli henüz yok.
  Test ederken Prisma Studio ile (`npx prisma studio`) bir kullanıcının
  `verificationStatus` alanını elle `verified` yapabilirsin.

- **.env dosyası:** `server/.env` içindeki `JWT_SECRET` değerini gerçek bir
  projeye geçmeden önce değiştir. `client/.env` içindeki `VITE_API_URL` ise
  frontend'in backend'i hangi adresten bulacağını belirler (varsayılan: `http://localhost:4000`).

- **Dosya yüklemeleri:** Profil fotoğrafları ve öğrenci belgeleri
  `server/uploads/` klasörüne kaydedilir.

- **Güncellemeleri çektikten sonra:** Şema değişiklikleri `server/prisma/migrations`
  altında tutulur. Yeni kodu çektikten sonra şunları çalıştır:
  ```
  cd server
  npm install
  npx prisma migrate deploy
  ```
  `tesseract.js` ilk çalıştığında dil verilerini internetten indirir; OCR sadece
  resim (jpeg/png/webp) olarak yüklenen öğrenci belgelerinde çalışır, PDF'lerde
  atlanır ve her durumda sonucu **admin'e ipucu olarak** gösterir - hesabı asla
  tek başına otomatik doğrulamaz.

## Grup C — Ek Gelir Kanalları

Kulüp/etkinlik öne çıkarma, profil boost ve öncelikli doğrulama; hepsi aynı mock
ödeme altyapısını paylaşır (`PaymentLog` tablosu + `server/src/lib/monetization.js`).
Uçlar `server/src/routes/monetization.js` altında, `POST /api/monetization/...`.
Gerçek bir ödeme sağlayıcısı bağlanınca tek değişmesi gereken yer bu dosyadır.

- Kulübü öne çıkar: kulüp sayfası → Etkinlikler sekmesi (sadece kurucu/yönetici)
- Etkinliği öne çıkar: her etkinlik satırının altında (oluşturan veya kulüp yöneticisi)
- Profil boost: Profilim sayfası
- Öncelikli doğrulama: Profilim sayfası, sadece `manual_review` durumundaki hesaplarda görünür

## Grup D — Riskli/Hassas Özellikler

- **OCR doğrulama** (`server/src/lib/ocr.js`): öğrenci belgesi yüklenince arka
  planda OCR ile metin çıkarılır ve üniversite adıyla kabaca örtüşüp örtüşmediği
  kontrol edilir. Bu sonuç admin kullanıcı listesinde bir rozet olarak gösterilir,
  fakat karar her zaman admin tarafından verilir.

## Onay/Red Kuyruğu (Belge Doğrulama)

`/admin/verification-queue` — manuel incelemeye düşen (`manual_review`) her
kullanıcı, yüklediği belge büyük önizlemeyle, OCR ön kontrol ipucuyla ve
tek tık Onayla/Reddet aksiyonlarıyla burada listelenir. Öncelikli doğrulama
satın alanlar (Grup C) listenin başında çıkar (✨ rozetiyle işaretli).

- **Onayla:** `verificationStatus` → `verified`, kullanıcıya bilgilendirme e-postası gider.
- **Reddet:** kısa bir gerekçe zorunludur (`rejectionReason`), bu gerekçe hem
  öğrenciye e-posta ile gider hem de Profilim sayfasında gösterilir.
- Reddedilen (ya da hiç belge yüklememiş "pending") kullanıcılar Profilim
  sayfasından yeni bir belge yükleyip kuyruğa geri girebilir
  (`POST /api/profile/verification-document`) — OCR ön kontrolü bu yeni
  belge için de otomatik tekrar çalışır.

## Dashboard Analitikleri

`/admin` ana sayfasında, temel sayaçların (kullanıcı/ilan/mesaj) yanında:

- **DAU / MAU** (`GET /api/admin/stats/engagement`): son 24 saat / 30 gün
  içinde aktif olan (socket üzerinden anlık bağlı ya da `lastSeenAt` bu
  aralıkta güncellenmiş) benzersiz kullanıcı sayısı.
- **Premium Dönüşüm Oranı:** hiç premium satın almış (`premiumSince` dolu)
  kullanıcıların toplam kullanıcıya oranı, ayrıca şu an aktif premium oranı
  ayrı gösterilir.
- **En Aktif Kampüsler** (`GET /api/admin/stats/campuses`): üniversite
  başına kullanıcı ve eşleşme sayısı, basit bir "etkinlik skoruna" göre
  sıralı ilk 10.

## Sıradaki Adımlar (Henüz Yapılmadı)

- [ ] Eşleşmeyi geri alma / engelleme
- [ ] Mobil uygulamaya taşıma
- [ ] PostgreSQL'e geçiş (büyüme aşamasında)
- [ ] Gerçek ödeme sağlayıcısı entegrasyonu (Grup C şu an mock/simülasyon)
- [ ] İtiraf kutusunda yasaklı kelime filtresi / otomatik içerik taraması
- [ ] Onay/Red kuyruğunda toplu (bulk) aksiyon
- [ ] DAU/MAU için gerçek "heartbeat" (şu an yalnızca socket disconnect anında güncelleniyor)
