import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SITE } from '../constants/site';

// Yasal sayfalar: Gizlilik Politikası (KVKK aydınlatma metni), Kullanım
// Şartları ve Topluluk Kuralları. Metinler taslaktır; yayına almadan önce bir
// hukukçuya kontrol ettirilmeli (veri sorumlusu unvanı, adres vb. eklenmeli).
const UPDATED = '2 Ekim 2026';

const DOCS = {
  gizlilik: {
    title: 'Gizlilik Politikası',
    lead: '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, kişisel verilerinin nasıl işlendiğini açıklar.',
    sections: [
      ['Hangi verileri topluyoruz?', [
        'Hesap bilgileri: ad soyad, üniversite e-posta adresi, üniversite, bölüm, sınıf, doğum tarihi ve şifrenin geri döndürülemez özeti.',
        'Profil bilgileri: fotoğraflar, hakkında yazısı, ilgi alanları, hobiler ve "ne arıyorsun" tercihleri.',
        'Doğrulama: yüklediğin e-Devlet öğrenci belgesi. Yalnızca inceleme ekibi görür, profilinde gösterilmez.',
        'Kullanım verileri: paylaşımlar, yorumlar, beğeniler, takipler, kulüp üyelikleri, mesajlar ve son görülme zamanı.',
      ]],
      ['Verileri ne için kullanıyoruz?', [
        'Öğrenci olduğunu doğrulamak ve kampüs topluluğunu yalnızca gerçek öğrencilere açık tutmak.',
        'Seni kendi kampüsündeki öğrencilerle buluşturmak (öneriler, Kart Modu, kulüpler).',
        'Güvenliği sağlamak: şikayetleri incelemek, kötüye kullanımı engellemek.',
        'Sana bildirim ve hesabınla ilgili e-postalar göndermek.',
      ]],
      ['Hukuki sebep', [
        'Kişisel verilerin, KVKK m.5/2 (c) uyarınca üyelik sözleşmesinin kurulması ve ifası, (f) uyarınca platform güvenliği için meşru menfaat ve gerektiğinde açık rızan kapsamında işlenir.',
      ]],
      ['Kimlerle paylaşıyoruz?', [
        'Verilerini satmayız ve reklam amacıyla üçüncü taraflarla paylaşmayız.',
        'Hizmeti sunmak için çalıştığımız altyapı sağlayıcıları (sunucu, e-posta gönderimi) verilere yalnızca bu amaçla ve sözleşmeyle bağlı olarak erişebilir.',
        'Kanunen yetkili kurumların talebi halinde mevzuatın gerektirdiği ölçüde paylaşım yapılabilir.',
      ]],
      ['Profilini kimler görebilir?', [
        'Profilin varsayılan olarak yalnızca doğrulanmış öğrencilere görünür. Ayarlar > Gizlilik bölümünden "Yalnızca Üniversitem" ya da "Kimseye Gösterme" seçebilir, çevrimiçi durumunu ve Kart Modu\'nu kapatabilirsin.',
        'Doğum tarihin kimseye gösterilmez; profilinde yalnızca yaşın görünür.',
      ]],
      ['Saklama süresi', [
        'Hesabını sildiğinde profilin, fotoğrafların, paylaşımların, mesajların ve yüklediğin belge kalıcı olarak silinir. Kanunen saklanması zorunlu kayıtlar yasal süre boyunca tutulur.',
      ]],
      ['Haklarını nasıl kullanırsın? (KVKK m.11)', [
        'Verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme ve itiraz etme haklarına sahipsin.',
        `Taleplerini ${SITE.contactEmail} adresine yazabilirsin; en geç 30 gün içinde yanıtlanır. Hesabını Ayarlar > Hesabı Sil ile kendin de silebilirsin.`,
      ]],
      ['Çerezler ve yerel depolama', [
        'Oturumunu açık tutmak, tema ve dil tercihini hatırlamak için tarayıcının yerel depolamasını kullanırız. Reklam veya takip çerezi kullanmayız.',
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
      ['Premium', [
        'Premium üyelik, seçtiğin dönem sonunda otomatik yenilenir. Otomatik yenilemeyi Ayarlar\'dan istediğin an kapatabilirsin; üyeliğin dönem sonuna kadar devam eder.',
      ]],
      ['Sorumluluğun sınırı', [
        'Kullanıcıların birbiriyle çevrim dışı buluşmalarından doğan sonuçlardan sorumlu değiliz. İlk buluşmaları kampüs içinde ve kalabalık yerlerde yapmanı öneririz.',
      ]],
      ['Değişiklikler', [
        'Bu şartları güncelleyebiliriz. Önemli değişiklikleri uygulama içinden duyururuz.',
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
        'Profildeki ya da gönderideki ⋯ menüsünden "Şikayet Et" ile bize bildir; ekibimiz 24 saat içinde inceler. "Engelle" ile o kişi seni bir daha göremez ve sana ulaşamaz.',
        `Acil bir durumda ${SITE.contactEmail} adresine yaz.`,
      ]],
    ],
  },
};

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
      </nav>
    </div>
  );
}
