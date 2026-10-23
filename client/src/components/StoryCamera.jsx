import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, SwitchCamera, X } from './icons';
import { useI18n } from '../i18n';
import { haptic } from '../lib/native';
import '../styles/story-camera.css';

// Uygulama içi hikâye kamerası (Instagram'daki gibi).
// Telefonun sistem kamerası ön kamerada önizlemeyi aynalı gösterip fotoğrafı
// ters kaydediyor; tarayıcı da dosyayı gönderirken "ön kamera" bilgisini
// siliyor. Bu yüzden kamerayı kendimiz açarız: deklanşöre basınca önizlemede
// ne görünüyorsa fotoğraf odur (ön kamerada aynalı, arka kamerada olduğu gibi;
// video kareleri her zaman dik gelir, yön bilgisi gerekmez).
// Kamera açılamazsa (izin yok, kamera yok) galeriden seçmeye düşülür.
// onCapture(file): çekilen ya da seçilen fotoğraf; onClose: vazgeç.
const FACING_KEY = 'kp-story-facing';

function savedFacing() {
  try {
    return localStorage.getItem(FACING_KEY) === 'environment' ? 'environment' : 'user';
  } catch {
    return 'user';
  }
}

export default function StoryCamera({ onCapture, onClose }) {
  const { t } = useI18n();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [facing, setFacing] = useState(savedFacing);
  const [status, setStatus] = useState('starting'); // starting | live | denied | unavailable
  const [flash, setFlash] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  // Kamera akışını aç (yön değişince yeniden)
  useEffect(() => {
    let cancelled = false;
    async function start() {
      setStatus('starting');
      stop();
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setStatus('live');
      } catch (err) {
        if (!cancelled) setStatus(err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'denied' : 'unavailable');
      }
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [facing, stop]);

  // Kapanınca kamera ışığı sönsün; Esc ile çık
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      stop();
    };
  }, [onClose, stop]);

  function switchFacing() {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    try {
      localStorage.setItem(FACING_KEY, next);
    } catch {
      // tercih hatırlanmazsa sorun değil
    }
  }

  // Deklanşör: önizlemede görünen kare (ön kamerada aynalı) olduğu gibi çekilir
  async function shoot() {
    const video = videoRef.current;
    if (!video || status !== 'live' || !video.videoWidth) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (facing === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    setFlash(true);
    haptic(12);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    stop();
    if (blob) onCapture(new File([blob], `hikaye-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
  }

  function pickFromGallery(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    stop();
    onCapture(file);
  }

  const mirrored = facing === 'user';

  return createPortal(
    <div className="story-cam" role="dialog" aria-modal="true" aria-label={t('Hikâye kamerası')}>
      <video
        ref={videoRef}
        className={`story-cam-video ${mirrored ? 'is-mirrored' : ''} ${status === 'live' ? 'is-live' : ''}`}
        playsInline
        muted
        autoPlay
      />
      {flash && <span className="story-cam-flash" onAnimationEnd={() => setFlash(false)} />}

      {status !== 'live' && (
        <div className="story-cam-message">
          {status === 'starting' ? (
            <p>{t('Kamera açılıyor…')}</p>
          ) : (
            <>
              <p>
                {status === 'denied'
                  ? t('Kameraya izin verilmedi. Tarayıcı ayarlarından kamera iznini açabilir ya da galeriden fotoğraf seçebilirsin.')
                  : t('Kamera açılamadı. Galeriden fotoğraf seçebilirsin.')}
              </p>
              <button type="button" className="story-cam-pill" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={18} /> {t('Galeriden seç')}
              </button>
            </>
          )}
        </div>
      )}

      <div className="story-cam-top">
        <button type="button" className="story-cam-icon" onClick={onClose} aria-label={t('Kapat')}>
          <X size={22} />
        </button>
      </div>

      <div className="story-cam-bottom">
        <button type="button" className="story-cam-icon" onClick={() => fileRef.current?.click()} aria-label={t('Galeriden seç')}>
          <ImagePlus size={24} />
        </button>
        <button type="button" className="story-cam-shutter" onClick={shoot} disabled={status !== 'live'} aria-label={t('Fotoğraf çek')}>
          <span />
        </button>
        <button type="button" className="story-cam-icon" onClick={switchFacing} disabled={status === 'starting'} aria-label={t('Kamerayı çevir')}>
          <SwitchCamera size={24} />
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickFromGallery} />
    </div>,
    document.body
  );
}
