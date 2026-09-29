// Grup D — OCR doğrulama
//
// Yüklenen öğrenci belgesinden (fotoğraf) metni çıkarır ve belgenin, kayıt
// sırasında seçilen üniversiteyle "kabaca" tutarlı görünüp görünmediğine dair
// basit bir ön kontrol yapar.
//
// ÖNEMLİ GÜVENLİK NOTU: Bu modül asla otomatik doğrulama (auto_verified)
// YAPMAZ. Sadece admin'in manuel inceleme sırasında ilk bakışta karar
// vermesini hızlandıran bir "ipucu" üretir (ocrAutoCheckPassed). Gerçek
// karar her zaman admin.js -> PATCH /users/:id üzerinden bir insan
// tarafından verilir. Bunun nedeni: OCR metin eşleşmesi çok kolay
// yanıltılabilir (ör. üniversite adını içeren alakasız bir görsel), bu
// yüzden tek başına kimlik doğrulaması için güvenilir değildir.
//
// Sadece resim dosyaları desteklenir (jpeg/png/webp). PDF belgeleri için
// (tesseract.js PDF'i doğrudan okuyamadığından) OCR atlanır; bu durumda
// ocrAutoCheckPassed null bırakılır ve belge her zamanki gibi tamamen
// manuel incelemeye düşer.

const path = require('path');

const OCR_SUPPORTED_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function normalize(text) {
  return (text || '')
    .toLocaleLowerCase('tr')
    .replace(/[İI]/g, 'i')
    .replace(/[^a-z0-9ığüşöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Üniversite adının anlamlı kelimelerinin (örn. "İstanbul", "Teknik",
// "Üniversitesi") kaçının belgede geçtiğine bakar. Tam eşleşme aranmaz,
// çünkü OCR taramaları harf hatası yapabilir; en az yarısının geçmesi
// yeterli sayılır.
function looksLikeUniversityDoc(extractedText, universityName) {
  const docWords = new Set(normalize(extractedText).split(' ').filter((w) => w.length >= 3));
  const nameWords = normalize(universityName)
    .split(' ')
    .filter((w) => w.length >= 3 && w !== 'universitesi' && w !== 'üniversitesi');

  if (nameWords.length === 0) return false;

  let matched = 0;
  for (const word of nameWords) {
    if (docWords.has(word)) matched += 1;
  }
  return matched >= Math.max(1, Math.ceil(nameWords.length / 2));
}

// filePath: private-uploads altındaki dosyanın tam yolu
// mimetype: multer'ın verdiği dosya türü
// universityName: kullanıcının kayıt sırasında seçtiği üniversite adı
// Döner: { extractedText, autoCheckPassed } ya da OCR atlanırsa
//        { extractedText: null, autoCheckPassed: null }
async function runDocumentOcr(filePath, mimetype, universityName) {
  if (!OCR_SUPPORTED_MIMETYPES.has(mimetype)) {
    return { extractedText: null, autoCheckPassed: null };
  }

  try {
    // Lazy require: tesseract.js oldukça büyük bir bağımlılık, sadece
    // gerçekten resim yüklendiğinde yüklensin.
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker(['eng', 'tur']);
    try {
      const {
        data: { text },
      } = await worker.recognize(path.resolve(filePath));
      const autoCheckPassed = looksLikeUniversityDoc(text, universityName);
      return { extractedText: (text || '').slice(0, 5000), autoCheckPassed };
    } finally {
      await worker.terminate();
    }
  } catch (err) {
    console.error('OCR işlenemedi:', err);
    // OCR başarısız olursa kayıt/akış asla bloklanmaz - sadece ipucu üretilemez.
    return { extractedText: null, autoCheckPassed: null };
  }
}

module.exports = { runDocumentOcr, OCR_SUPPORTED_MIMETYPES };
