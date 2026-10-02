import React from 'react';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';

// Kart Modu fotoğraf galerisi: fotoğraflar kartın içindeki yuvarlak köşeli
// bir çerçevede yan yana durur ve etkin fotoğrafa kayar. Çerçeveyi her zaman
// fotoğraf doldurur (arkada siyah sahne görünmez). Sağ/sol yarıya dokunma
// SwipeDiscoverPage'deki sürükleme mantığı içinde (hareketsiz bırakınca)
// algılanır; bu bileşen yalnızca görüntüler.
export default function PhotoCarousel({ photos, index, name, initials }) {
  const { t } = useI18n();

  if (!photos || photos.length === 0) {
    return (
      <div className="photo-frame is-empty" data-photo-area>
        <span className="photo-carousel-initials">{initials}</span>
      </div>
    );
  }

  const active = Math.min(index, photos.length - 1);
  const single = photos.length === 1;

  return (
    <div className="photo-frame" data-photo-area>
      <div className="photo-frame-track" style={{ '--i': active }}>
        {photos.map((p, i) => {
          const near = Math.abs(i - active) <= 1;
          return (
            <div key={p.id} className="photo-frame-slide" aria-hidden={i !== active}>
              <img
                src={`${API_BASE_URL}${p.url}`}
                alt={i === active ? t('{name} — fotoğraf {n}', { name, n: i + 1 }) : ''}
                draggable={false}
                loading={near ? 'eager' : 'lazy'}
              />
            </div>
          );
        })}
      </div>

      {!single && (
        <>
          <div
            className="photo-frame-bars"
            role="img"
            aria-label={t('{total} fotoğraftan {n}.', { total: photos.length, n: active + 1 })}
          >
            {photos.map((p, i) => (
              <span key={p.id} className={i === active ? 'active' : ''} />
            ))}
          </div>
          <span className="photo-frame-count" aria-hidden="true">
            {active + 1}/{photos.length}
          </span>
        </>
      )}
    </div>
  );
}
