// Fotoğrafı yüklemeden önce tarayıcıda küçültür ve sıkıştırır: telefon
// kameralarının 4-12 MB'lık fotoğrafları ~200-500 KB'a iner, sayfalar mobil
// veride hızlı açılır. Uzun kenar en fazla `maxSide` piksel olur.
//
// - GIF (animasyon bozulmasın) ve küçük dosyalar olduğu gibi gönderilir.
// - Sıkıştırılmış hali daha büyük çıkarsa orijinal kullanılır.
// - Herhangi bir hata olursa (desteklenmeyen format vb.) orijinal dosya döner;
//   yükleme hiçbir zaman bu adım yüzünden başarısız olmaz.
const SKIP_BELOW = 300 * 1024; // 300 KB altı zaten küçük

export async function compressImage(file, { maxSide = 1600, quality = 0.82 } = {}) {
  if (!file || !file.type?.startsWith('image/') || file.type === 'image/gif' || file.size < SKIP_BELOW) {
    return file;
  }
  try {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    // PNG şeffaflığı korunsun diye WebP; diğerleri JPEG
    const type = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob || blob.size >= file.size) return file;

    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

// EXIF yönünü dikkate alarak çizilebilir görüntü (dik çekilmiş fotoğraf yan dönmesin)
async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // bazı tarayıcılar seçeneği desteklemez; aşağıdaki yönteme düş
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
