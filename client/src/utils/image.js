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
    const bw = bitmap.naturalWidth || bitmap.width;
    const bh = bitmap.naturalHeight || bitmap.height;
    const scale = Math.min(1, maxSide / Math.max(bw, bh));
    const width = Math.round(bw * scale);
    const height = Math.round(bh * scale);

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

// EXIF yönünü dikkate alarak çizilebilir görüntü (dik ya da ters çekilmiş
// fotoğraf yan/ters dönmesin). createImageBitmap kullanılmaz: iPhone Safari
// gibi bazı tarayıcılar onun "from-image" seçeneğini yok sayıyor ve fotoğraf
// düzenleyicide doğru görünürken paylaşılınca ters kaydediliyordu. <img>
// öğesi yönü her modern tarayıcıda uygular; uygulamayan eski tarayıcıda
// yön EXIF'ten okunup elle çevrilir.
export async function loadBitmap(file) {
  const url = URL.createObjectURL(file);
  let img;
  try {
    img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  const autoOriented = typeof CSS !== 'undefined' && CSS.supports?.('image-orientation', 'from-image');
  if (autoOriented) return img;
  const orientation = await readExifOrientation(file);
  return orientation > 1 ? orientCanvas(img, orientation) : img;
}

// JPEG içindeki EXIF yön etiketi (1-8); bulunamazsa 1
async function readExifOrientation(file) {
  try {
    const view = new DataView(await file.slice(0, 128 * 1024).arrayBuffer());
    if (view.getUint16(0) !== 0xffd8) return 1;
    let off = 2;
    while (off + 4 < view.byteLength) {
      const marker = view.getUint16(off);
      const len = view.getUint16(off + 2);
      if (marker === 0xffe1 && view.getUint32(off + 4) === 0x45786966) {
        const tiff = off + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const ifd = tiff + view.getUint32(tiff + 4, little);
        const count = view.getUint16(ifd, little);
        for (let i = 0; i < count; i++) {
          const e = ifd + 2 + i * 12;
          if (view.getUint16(e, little) === 0x0112) return view.getUint16(e + 8, little);
        }
        return 1;
      }
      if ((marker & 0xff00) !== 0xff00) return 1;
      off += 2 + len;
    }
  } catch {
    // okunamazsa yön değiştirilmez
  }
  return 1;
}

// Ham görüntüyü EXIF yönüne göre çevrilmiş bir tuvale çizer
function orientCanvas(img, o) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const swap = o >= 5;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext('2d');
  const T = {
    2: [-1, 0, 0, 1, w, 0],
    3: [-1, 0, 0, -1, w, h],
    4: [1, 0, 0, -1, 0, h],
    5: [0, 1, 1, 0, 0, 0],
    6: [0, 1, -1, 0, h, 0],
    7: [0, -1, -1, 0, h, w],
    8: [0, -1, 1, 0, 0, w],
  }[o];
  if (T) ctx.setTransform(...T);
  ctx.drawImage(img, 0, 0);
  return canvas;
}
