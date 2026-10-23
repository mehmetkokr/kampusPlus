# kampüs+ telefon uygulaması (iOS ve Android)

Uygulama, sitenin aynı React kodunu [Capacitor](https://capacitorjs.com) ile
telefona sarar. Sitede yapılan her değişiklik bir sonraki uygulama
derlemesine kendiliğinden girer.

| | |
|---|---|
| Uygulama kimliği | `tr.com.kampusplus.app` |
| Görünen ad | kampüs+ |
| iOS projesi | `client/ios/App` (Swift Package Manager, CocoaPods yok) |
| Android projesi | `client/android` |
| Bulutta derleme | `codemagic.yaml` (Mac gerekmez) |

## Hazır olanlar

- API, gerçek zamanlı bağlantı ve fotoğraflar canlı sunucudan (`https://kampusplus.com.tr`) gelir; sunucu uygulama adreslerine (CORS) izin verir.
- Bildirimler: iOS'ta Apple (APNs), Android'de Google (FCM). Cihaz kaydı `/api/push/device`; her bildirim web ve telefon cihazlarına birlikte gider.
- Bildirime ya da kampusplus.com.tr bağlantısına dokununca uygulamada ilgili sayfa açılır.
- Uygulama içi hikâye kamerası, sesli mesaj, galeri: izin metinleri `Info.plist` ve `AndroidManifest.xml` içinde.
- Durum çubuğu temaya uyar; Android geri tuşu çalışır; oturum hep hatırlanır; uygulama yalnızca dikey.
- Simgeler ve açılış ekranı: `npm run mobile:icons`.

## Komutlar (client klasöründe)

```bash
npm run mobile:sync      # web derlemesi + iOS/Android projelerine kopyala
npm run mobile:icons     # logo değişince simge ve açılış ekranlarını yeniden üret
npm run mobile:android   # Android Studio'da aç (bilgisayarda Android Studio varsa)
npm run mobile:ios       # Xcode'da aç (yalnızca Mac)
```

## Son adımlar (hesap gerektirir)

### 1. Apple (iOS)
1. [Apple Developer Program](https://developer.apple.com/programs/)'a katıl (99 $/yıl).
2. Identifiers > `tr.com.kampusplus.app` oluştur; **Push Notifications** ve **Associated Domains** yeteneklerini aç.
3. Keys > yeni anahtar (Apple Push Notifications service) > `.p8` dosyasını indir.
4. Railway'de değişkenler:
   - `APNS_KEY` = `.p8` dosyasının içeriği
   - `APNS_KEY_ID` = anahtar kimliği
   - `APNS_TEAM_ID` ve `APPLE_TEAM_ID` = ekip kimliği
   - `APNS_PRODUCTION` = `true` (TestFlight ve App Store sürümleri için)
5. App Store Connect'te uygulamayı oluştur, bir App Store Connect API anahtarı al.
6. [Codemagic](https://codemagic.io)'te depoyu bağla, API anahtarını `kampusplus-asc` adıyla ekle ve **iOS → TestFlight** iş akışını çalıştır. Derleme TestFlight'a düşer; iPhone'a TestFlight uygulamasıyla kurulur.

### 2. Google (Android)
1. [Google Play Console](https://play.google.com/console) hesabı aç (25 $, bir kez).
2. [Firebase](https://console.firebase.google.com)'te proje oluştur, Android uygulaması ekle (`tr.com.kampusplus.app`), `google-services.json` dosyasını `client/android/app/` içine koy.
3. Firebase > Proje ayarları > Hizmet hesapları > yeni özel anahtar; JSON'u tek satır olarak Railway'de `FCM_SERVICE_ACCOUNT` yap.
4. Play Console > Uygulama imzalama > SHA-256 parmak izini Railway'de `ANDROID_CERT_SHA256` yap.
5. Codemagic'e yükleme anahtarını (`kampusplus-upload`) ve Play hizmet hesabını ekleyip **Android → Google Play (iç test)** iş akışını çalıştır.

### 3. Ödeme
App Store ve Google Play, uygulama içinde satılan dijital üyeliklerde kendi ödeme
sistemlerini zorunlu tutar. Karar verildiğinde (uygulama içi satın alma ya da
yalnızca web'den satış) Plus/Premium satın alma akışı buna göre bağlanır.

### 4. Mağaza bilgileri
Ekran görüntüleri, açıklama, gizlilik bilgileri (toplanan veriler: e-posta, ad,
fotoğraflar, mesajlar), yaş sınırı (flört özelliği nedeniyle 17+/18+), destek
adresi `destek@kampusplus.com.tr`, gizlilik politikası `https://kampusplus.com.tr/gizlilik`.
