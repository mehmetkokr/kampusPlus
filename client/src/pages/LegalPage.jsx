import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from '../components/icons';
import { SITE } from '../constants/site';
import api from '../api';
import { formatTL } from '../lib/premium';

// Yasal sayfalar: Gizlilik Politikası (KVKK aydınlatma metni), Kullanım
// Şartları ve Topluluk Kuralları. Metinler taslaktır; yayına almadan önce bir
// hukukçuya kontrol ettirilmeli (veri sorumlusu unvanı, adres vb. eklenmeli).
const UPDATED = '16 Ekim 2026';

const DOCS = {
  gizlilik: {
    title: 'Gizlilik Politikası',
    lead: '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, kişisel verilerinin nasıl işlendiğini açıklar.',
    sections: [
      ['Hangi verileri topluyoruz?', [
        'Hesap bilgileri: ad soyad, üniversite e-posta adresi, üniversite, bölüm, sınıf, doğum tarihi ve şifrenin geri döndürülemez özeti.',
        'Profil bilgileri: fotoğraflar, hakkında yazısı, ilgi alanları, hobiler ve "ne arıyorsun" tercihleri.',
        'Doğrulama: yüklediğin e-Devlet öğrenci belgesi. Yalnızca inceleme ekibi görür, profilinde gösterilmez.',
        'Kullanım verileri: paylaşımlar, yorumlar, beğeniler, Kart Modu’ndaki “geç” kararların, takipler, kulüp üyelikleri, mesajlar, mesajlara bıraktığın tepkiler ve son görülme zamanı.',
        'Öğrencilik doğrulaması: okul e-postanın en son doğrulandığı tarih. Yılda bir aynı adrese gelen kodla yenilenir.',
        'Uygulama istatistikleri: hangi sayfaların açıldığı ve kayıt adımları. Giriş yapmadıysan bunlar tarayıcında üretilen rastgele bir kimlikle sayılır; IP adresi, konum veya cihaz bilgisi kaydedilmez.',
        'Hata raporları: uygulamada bir hata oluşursa hatanın teknik ayrıntısı, açık olan sayfa ve tarayıcı türü.',
        'Anlık bildirimleri açarsan, tarayıcının bu cihaz için verdiği bildirim adresi.',
        'Premium ve ödeme: seçtiğin plan, satın alma tarihi, tutar, Mesafeli Satış Sözleşmesi onayının zamanı ve otomatik yenileme tercihin. Kart bilgilerin ödeme kuruluşunda işlenir; bizde saklanmaz.',
        'Beğeni hakkı ve Boost: o gün kaç beğeni gönderdiğin, Boost hakkı sayın ve Boost’un başlayıp bittiği zaman.',
        'Onaylar: kullanım şartlarını, yurt dışına aktarım açık rızasını ve (verdiysen) ticari ileti iznini verdiğin tarih.',
      ]],
      ['Verileri ne için kullanıyoruz?', [
        'Öğrenci olduğunu doğrulamak ve kampüs topluluğunu yalnızca gerçek öğrencilere açık tutmak. Bu yüzden yılda bir okul e-postanla yeniden doğrulama isteriz; doğrulanmayan profil listelerden gizlenir (hesap silinmez).',
        'Seni kendi kampüsündeki öğrencilerle buluşturmak (öneriler, Kart Modu, kulüpler).',
        'Güvenliği sağlamak: şikayetleri incelemek, kötüye kullanımı engellemek.',
        'Sana bildirim ve hesabınla ilgili e-postalar göndermek.',
        'Hataları bulup düzeltmek ve uygulamanın hangi bölümlerinin işe yaradığını anlamak.',
        'Premium haklarını uygulamak: günlük beğeni sınırını saymak, Boost süresince profilini öne çıkarmak, üyeliği yenilemek ve ödeme kayıtlarını yasal süre boyunca saklamak.',
        'Yalnızca izin verdiysen: kampanya, etkinlik ve yenilikleri e-postayla duyurmak.',
      ]],
      ['Hukuki sebep', [
        'Kişisel verilerin KVKK m.5/2 (c) uyarınca üyelik ve Premium sözleşmesinin kurulması ve ifası, (ç) uyarınca hukuki yükümlülüklerimiz (ör. ödeme ve fatura kayıtlarının saklanması) ve (f) uyarınca platform güvenliği için meşru menfaat kapsamında işlenir.',
        'Verilerinin yurt dışındaki sunucularda saklanması KVKK m.9 kapsamında açık rızana dayanır. Ticari elektronik iletiler (kampanya e-postaları) 6563 sayılı Kanun uyarınca yalnızca ayrıca izin verirsen gönderilir.',
      ]],
      ['Yurt dışına aktarım', [
        'Hizmeti çalıştırdığımız altyapı sağlayıcılarının sunucuları yurt dışındadır: uygulama sunucusu ve veritabanı (ABD), e-posta gönderimi (Avrupa Birliği), alan adı, DNS ve destek e-postası yönlendirmesi (ABD ve dünya genelindeki sunucular).',
        'Bu sağlayıcılar verilerine yalnızca hizmeti sunmak için ve sözleşmeyle bağlı olarak erişir. Kayıt olurken bu aktarıma açık rıza verirsin; rızanı geri çekersen hizmet sunulamayacağından hesabını silmen gerekir.',
      ]],
      ['Kimlerle paylaşıyoruz?', [
        'Verilerini satmayız ve reklam amacıyla üçüncü taraflarla paylaşmayız.',
        'Hizmeti sunmak için çalıştığımız altyapı sağlayıcıları (sunucu, e-posta gönderimi, hata takibi) verilere yalnızca bu amaçla ve sözleşmeyle bağlı olarak erişebilir.',
        'Anlık bildirimler, tarayıcının bildirim servisi (ör. Google, Apple, Mozilla) üzerinden iletilir. Bildirimde yalnızca kısa bir başlık gider; mesaj içerikleri gönderilmez.',
        'Kanunen yetkili kurumların talebi halinde mevzuatın gerektirdiği ölçüde paylaşım yapılabilir.',
      ]],
      ['Profilini kimler görebilir?', [
        'Profilin varsayılan olarak yalnızca doğrulanmış öğrencilere görünür. Ayarlar > Gizlilik bölümünden "Yalnızca Üniversitem" ya da "Kimseye Gösterme" seçebilir, çevrimiçi durumunu ve Kart Modu\'nu kapatabilirsin.',
        'Doğum tarihin kimseye gösterilmez; profilinde yalnızca yaşın görünür.',
        'Birini beğendiğinde, o kişi Premium üyeyse seni "Seni beğenenler" listesinde görebilir. Beğenmediğin kişiye ne yaptığın (ör. "geç") söylenmez.',
        'Boost kullandığında profilin kısa süre kampüsündeki öğrencilere daha önce gösterilir. Kimin Boost ya da Premium aldığı başka kullanıcılara söylenmez.',
      ]],
      ['Saklama süresi', [
        'Hesabını sildiğinde profilin, fotoğrafların, paylaşımların, mesajların ve yüklediğin belge kalıcı olarak silinir. Kanunen saklanması zorunlu kayıtlar yasal süre boyunca tutulur.',
        'Veri kaybına karşı her gece veritabanının yalnızca yöneticilerin erişebildiği bir yedeği alınır. Silinen bir hesabın verileri yedeklerde en fazla 14 gün daha kalır, sonra yedeklerle birlikte silinir.',
        'Uygulama istatistikleri 180 gün, hata kayıtları son görülmelerinden itibaren 90 gün saklanır. Hesabını silersen istatistikler hesabından ayrılır ve anonim kalır.',
        'Anlık bildirim adresi, bildirimleri kapattığında ya da bu cihazda çıkış yaptığında silinir.',
        'Kart Modu’ndaki “geç” kararın 30 gün boyunca o kişiyi sana tekrar göstermemek için kullanılır.',
        'Ödeme ve fatura kayıtları vergi ve ticaret mevzuatı gereği 10 yıl saklanır; hesabını silsen de bu süre boyunca tutulur.',
        'Onay kayıtları (ne zaman neyi onayladığın), olası bir uyuşmazlıkta ispat için hesabın silindikten sonra en fazla 10 yıl saklanır.',
      ]],
      ['Haklarını nasıl kullanırsın? (KVKK m.11)', [
        'Verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme ve itiraz etme haklarına sahipsin.',
        `Taleplerini ${SITE.contactEmail} adresine yazabilirsin; en geç 30 gün içinde yanıtlanır. Hesabını Ayarlar > Hesabı Sil ile kendin de silebilirsin.`,
        'Hakkında tuttuğumuz verilerin bir kopyasını Ayarlar > Güvenlik ve Veriler > Verilerimi İndir ile hemen alabilirsin.',
        'Ticari ileti iznini Ayarlar > İzinler ve onaylar bölümünden istediğin an kapatabilirsin. Açık rızanı geri çekmek için de bize yazabilirsin; geri çekme, o ana kadar yapılan işlemleri etkilemez.',
      ]],
      ['Çerezler ve yerel depolama', [
        'Oturumunu açık tutmak, tema ve dil tercihini hatırlamak ve ziyaretleri saymak için (rastgele üretilmiş bir kimlik) tarayıcının yerel depolamasını kullanırız. Reklam veya üçüncü taraf takip çerezi kullanmayız.',
      ]],
    ],
  },
  'kullanim-sartlari': {
    title: 'Kullanım Şartları',
    lead: `${SITE.name} hizmetini kullanarak aşağıdaki şartları kabul etmiş olursun.`,
    sections: [
      ['Kimler kullanabilir?', [
        '18 yaşını doldurmuş, aktif üniversite öğrencileri. Kayıt sırasında üniversitenin okul e-postasına gönderilen kodla doğrulama yapman gerekir.',
        'Her kişi yalnızca bir hesap açabilir; hesabını başkasına devredemezsin.',
      ]],
      ['Hesabının güvenliği', [
        'Şifreni gizli tutmaktan sen sorumlusun. Hesabında şüpheli bir hareket görürsen Ayarlar > Tüm Cihazlardan Çıkış Yap ile oturumları kapatabilirsin.',
      ]],
      ['Paylaştığın içerik', [
        'Paylaştığın içeriğin hakları sende kalır. Hizmeti sunabilmemiz için içeriğini platformda gösterme izni vermiş olursun.',
        'Başkasına ait fotoğrafı, kişisel bilgiyi veya telif hakkıyla korunan içeriği izinsiz paylaşamazsın.',
      ]],
      ['Yasak davranışlar', [
        'Taciz, tehdit, nefret söylemi, cinsel içerikli istenmeyen mesajlar, sahte profil, spam ve dolandırıcılık.',
        'Platformu otomatik araçlarla taramak, başka kullanıcıların verilerini toplamak.',
      ]],
      ['Yaptırımlar', [
        'Kuralları ihlal eden içerikleri kaldırabilir, hesapları geçici ya da kalıcı olarak kapatabiliriz. Ciddi durumlarda yetkili makamlarla iş birliği yaparız.',
      ]],
      ['Beğeni hakkı, Premium ve Boost', [
        'Üyeliği olmayan hesapla günde 5 kişiyi beğenebilirsin; hak her gün Türkiye saatiyle 00:00’da yenilenir ve kullanılmayan hak ertesi güne devretmez.',
        'İki aylık üyelik sunulur: Plus ve Premium. Plus’ta günlük beğeni hakkı 30, Premium’da sınırsızdır. Planların güncel ücreti ve hakları satın alma ekranında ve Ayarlar > Premium bölümünde gösterilir.',
        'Plus ve Premium üyeler Kart Modu’nu başka bir üniversiteye taşıyabilir; o zaman Kart Modu’nda seçilen üniversitenin, profilini herkese açan öğrencileri görünür. Akış, hikâyeler ve kulüpler her zaman kendi üniversitenden gelir.',
        'Kart Modu’nda kadınlara erkekler, erkeklere kadınlar gösterilir. Cinsiyetini belirtmek istemeyenler herkesle karışık eşleşir. Cinsiyet bilgin profilinde görünmez; Ayarlar’dan değiştirebilirsin.',
        'Üyeliklerde günlük Süper Beğeni hakkı vardır (Plus 1, Premium 5). Süper Beğendiğin kişiye bildirim gider ve onun Kart Modu destesinde öne çıkarsın; Süper Beğeni normal beğeni hakkından düşmez.',
        'Seni beğenenleri görme, Gizli mod, gelişmiş filtreler ve son kararı geri alma Premium’a özeldir. Gizli mod açıkken Kart Modu ve Keşfet’te yalnızca senin beğendiğin kişilere görünürsün; Premium sona erince gizli mod kendiliğinden etkisiz olur.',
        'Her ay üyelik başladığında ya da yenilendiğinde hesabına Boost hakkı eklenir (Plus 1, Premium 4). Bir Boost, profilini 30 dakika boyunca kampüsündeki öğrencilerin Kart Modu ve Keşfet listelerinde öne çıkarır. Kullanılan Boost geri alınamaz; kullanılmayan Boost hakkın üyeliğin bitse de hesabında kalır.',
        'Üyelik her ay aynı planla otomatik yenilenir. Otomatik yenilemeyi Ayarlar’dan istediğin an kapatabilirsin; üyeliğin dönem sonuna kadar devam eder.',
        'Satın alma koşulları, cayma hakkı ve uyuşmazlık yolları Mesafeli Satış Sözleşmesi’nde yer alır.',
      ]],
      ['Sorumluluğun sınırı', [
        'Kullanıcıların birbiriyle çevrim dışı buluşmalarından doğan sonuçlardan sorumlu değiliz. İlk buluşmaları kampüs içinde ve kalabalık yerlerde yapmanı öneririz.',
      ]],
      ['Değişiklikler', [
        'Bu şartları güncelleyebiliriz. Önemli değişiklikleri uygulama içinden duyururuz.',
      ]],
    ],
  },
  'mesafeli-satis-sozlesmesi': {
    title: 'Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme',
    lead: '6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında, Plus ya da Premium üyelik satın almadan önce bilmen gerekenler.',
    plans: true,
    sections: [
      ['1. Taraflar', [
        `Satıcı: ${SITE.name} (ticari unvan, adres ve vergi numarası ödeme sistemi açılmadan önce burada yer alacaktır). E-posta: ${SITE.contactEmail}`,
        'Alıcı: Premium üyelik satın alan, kayıtlı ve 18 yaşını doldurmuş kullanıcı. Alıcının bilgileri hesabındaki bilgilerdir.',
      ]],
      ['2. Sözleşmenin konusu', [
        'Elektronik ortamda anında ifa edilen dijital hizmet: 30 günlük Plus ya da Premium üyelik ve plana bağlı beğeni, Süper Beğeni ile Boost hakları.',
        'Plus ile tüm üniversitelerde arama yapabilir ve Kart Modu’nu başka bir üniversiteye taşıyabilirsin. Premium ile bunlara ek olarak seni beğenenleri görebilir, Gizli modu ve Kart Modu’nun gelişmiş filtrelerini kullanabilir ve son kararını geri alabilirsin.',
      ]],
      ['3. Ücret ve ödeme', [
        'Planların ücreti yukarıdaki tabloda ve satın alma ekranında, vergiler dahil olarak gösterilir. Ödeme banka ya da kredi kartıyla, lisanslı bir ödeme kuruluşu aracılığıyla alınır; kart bilgilerin bizde saklanmaz.',
      ]],
      ['4. Süre ve otomatik yenileme', [
        'Üyelik ödemenin onaylandığı anda başlar ve seçilen dönem sonunda aynı plan ve o günkü ücretle otomatik yenilenir. Yenilemeyi Ayarlar > Premium bölümünden dönem bitmeden istediğin an kapatabilirsin; üyeliğin dönem sonuna kadar sürer.',
        'Ücret değişirse yeni ücret, yenilemeden önce uygulama içinden bildirilir.',
      ]],
      ['5. Cayma hakkı', [
        'Mesafeli Sözleşmeler Yönetmeliği m.15/1 (ğ) uyarınca, elektronik ortamda anında ifa edilen ve tüketicinin onayıyla ifasına başlanan hizmetlerde cayma hakkı kullanılamaz.',
        'Satın alma sırasında hizmetin hemen başlamasını onayladığın ve bu nedenle cayma hakkının sona ereceğini kabul ettiğin için, ödemeden sonra cayma hakkın bulunmaz. Hizmetten kaynaklanan bir sorun olursa bize yaz; mevzuat çerçevesinde değerlendiririz.',
      ]],
      ['6. Beğeni ve Boost hakları', [
        'Günlük beğeni hakkı Türkiye saatiyle her gün 00:00’da yenilenir; kullanılmayan hak devretmez.',
        'Bir Boost 30 dakika sürer. Kullanılan Boost geri alınamaz ve iade edilmez; kullanılmayan Boost hakları üyelik sona erse de hesapta kalır, hesap silinince sona erer.',
      ]],
      ['7. Hesabın kapatılması', [
        'Kullanım Şartları’na ya da Topluluk Kuralları’na aykırılık nedeniyle kapatılan hesaplarda kalan üyelik süresi için iade, mevzuatın izin verdiği ölçüde yapılmaz.',
      ]],
      ['8. Şikâyet ve uyuşmazlık', [
        `Şikâyetlerini ${SITE.contactEmail} adresine iletebilirsin.`,
        'Uyuşmazlıklarda, Ticaret Bakanlığı’nca her yıl ilan edilen parasal sınırlar içinde tüketici hakem heyetlerine, bu sınırların üzerinde tüketici mahkemelerine başvurabilirsin.',
      ]],
      ['9. Onay', [
        'Alıcı, satın almadan önce bu ön bilgilendirmeyi ve sözleşmeyi okuduğunu ve hizmetin hemen başlamasını onayladığını elektronik ortamda kabul eder. Onayın zamanı satın alma kaydında saklanır.',
      ]],
    ],
  },
  'topluluk-kurallari': {
    title: 'Topluluk Kuralları',
    lead: 'Kampüs herkesin kendini güvende hissettiği bir yer olmalı. Bu kurallar o yüzden var.',
    sections: [
      ['Saygılı ol', [
        'Farklı görüşlere, kimliklere ve sınırlara saygı göster. "Hayır" cevabını kabul et.',
      ]],
      ['Gerçek ol', [
        'Kendi fotoğraflarını ve gerçek bilgilerini kullan. Başkası gibi davranmak yasak.',
      ]],
      ['Taciz ve rahatsız edici içerik yok', [
        'İstenmeyen cinsel içerik, hakaret, tehdit, zorbalık ve ayrımcılık kesinlikle yasak.',
        'Kulüp sohbetleri yalnızca kulüp içindir; oradan kimseye özel mesaj atılamaz. Özel sohbetler yalnızca karşılıklı eşleşmeyle açılır.',
      ]],
      ['Spam ve reklam yok', [
        'Tekrarlayan mesajlar, izinsiz reklam ve dolandırıcılık girişimleri kaldırılır.',
      ]],
      ['Bir sorun mu var?', [
        'Profildeki ya da gönderideki ⋯ menüsünden "Şikayet Et" ile bize bildir; ekibimiz inceler. "Engelle" ile o kişi seni bir daha göremez ve sana ulaşamaz.',
        `Acil bir durumda ${SITE.contactEmail} adresine yaz.`,
      ]],
    ],
  },
};

// Güncel planlar sunucudan okunur (ücret değişince metin elle güncellenmez)
function PlanTable() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    api
      .get('/premium/plans')
      .then((res) => setInfo(res.data))
      .catch(() => {});
  }, []);
  if (!info) return null;
  const period = { plus: '30 gün', premium: '30 gün' };
  return (
    <section>
      <h2>Planlar ve ücretler</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col">Süre</th>
              <th scope="col">Ücret (vergiler dahil)</th>
              <th scope="col">Günlük beğeni</th>
              <th scope="col">Günlük Süper Beğeni</th>
              <th scope="col">Boost</th>
            </tr>
          </thead>
          <tbody>
            {info.plans.map((p) => (
              <tr key={p.key}>
                <th scope="row">{p.label}</th>
                <td>{period[p.key] || `${p.days} gün`}</td>
                <td>{formatTL(p.amount)}</td>
                <td>{p.dailyLikes === null ? 'Sınırsız' : p.dailyLikes}</td>
                <td>{p.dailySuperLikes}</td>
                <td>{`${p.boosts} × ${info.boostMinutes} dk`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function LegalPage({ doc }) {
  const d = DOCS[doc];
  return (
    <div className="container legal">
      <Link to="/" className="legal-back">
        <ArrowLeft size={16} /> {SITE.name}
      </Link>
      <h1>{d.title}</h1>
      <p className="legal-lead">{d.lead}</p>
      <p className="legal-updated">Son güncelleme: {UPDATED}</p>
      {d.plans && <PlanTable />}
      {d.sections.map(([heading, paras]) => (
        <section key={heading}>
          <h2>{heading}</h2>
          {paras.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </section>
      ))}
      <nav className="legal-nav" aria-label="Yasal sayfalar">
        <Link to="/gizlilik">Gizlilik Politikası</Link>
        <Link to="/kullanim-sartlari">Kullanım Şartları</Link>
        <Link to="/topluluk-kurallari">Topluluk Kuralları</Link>
        <Link to="/mesafeli-satis-sozlesmesi">Mesafeli Satış Sözleşmesi</Link>
      </nav>
    </div>
  );
}
