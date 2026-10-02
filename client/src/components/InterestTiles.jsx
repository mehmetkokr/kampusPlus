import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck, Bike, BookOpen, Brain, Camera, ChevronRight, Code, Coffee, Dumbbell, Film, Gamepad2, Globe2,
  Leaf, Loader2, Mountain, Music, Palette, PawPrint, Plane, Plus, Sparkles, Tent, Trophy, Tv, UserRound,
  Utensils, X,
} from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';

// Etikete uygun simge; listede yoksa genel bir simge
const ICONS = {
  Kahve: Coffee, 'Kahve Demlemek': Coffee, Sinema: Film, Dizi: Tv, Müzik: Music, Gitar: Music, Piyano: Music,
  'Şarkı Söylemek': Music, Konser: Music, Yazılım: Code, Kodlama: Code, Teknoloji: Code, 'Yapay Zekâ': Brain,
  Bilim: Brain, Felsefe: Brain, Psikoloji: Brain, Edebiyat: BookOpen, 'Kitap Okumak': BookOpen, Tarih: BookOpen,
  Fotoğrafçılık: Camera, 'Fotoğraf Çekmek': Camera, 'Video Çekmek': Camera, Sanat: Palette, Resim: Palette,
  Çizim: Palette, Tasarım: Palette, Oyun: Gamepad2, 'Video Oyunları': Gamepad2, Anime: Gamepad2, Spor: Trophy,
  Futbol: Trophy, Basketbol: Trophy, Voleybol: Trophy, 'Futbol Oynamak': Trophy, 'Basketbol Oynamak': Trophy,
  Fitness: Dumbbell, Koşu: Dumbbell, Bisiklet: Bike, Kamp: Tent, Dağcılık: Mountain, Yürüyüş: Mountain,
  Doğa: Leaf, Bahçecilik: Leaf, Çevre: Leaf, Seyahat: Plane, Gezmek: Plane, Yemek: Utensils,
  'Yemek Yapmak': Utensils, 'Tatlı Yapmak': Utensils, Hayvanlar: PawPrint, 'Dil Öğrenme': Globe2,
  'Dil Öğrenmek': Globe2,
};
const TONES = ['tone-brick', 'tone-sage', 'tone-ink', 'tone-stone'];
const MAX_TILES = 6;

export default function InterestTiles({ tiles }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [openTag, setOpenTag] = useState(null);
  const closeSheet = useCallback(() => setOpenTag(null), []);

  // Kişinin hiç ilgi alanı yoksa: bölüm kaybolmaz, ekleme çağrısına dönüşür
  if (!tiles || tiles.length === 0) {
    return (
      <button type="button" className="interest-empty" onClick={() => navigate('/profile')}>
        <span className="interest-empty-icon">
          <Sparkles size={18} />
        </span>
        <span className="interest-empty-text">
          <strong>{t('İlgi alanlarını ekle')}</strong>
          <span>{t('Kampüste seninle aynı şeyleri sevenleri burada görürsün.')}</span>
        </span>
        <Plus size={18} className="interest-empty-plus" />
      </button>
    );
  }

  return (
    <>
      <div className="interest-grid">
        {tiles.slice(0, MAX_TILES).map((tile, i) => {
          const Icon = ICONS[tile.tag] || Sparkles;
          const empty = tile.count === 0;
          return (
            <button
              key={tile.tag}
              type="button"
              className={`interest-tile ${TONES[i % TONES.length]} ${empty ? 'is-empty' : ''}`}
              onClick={() => !empty && setOpenTag(tile.tag)}
              aria-disabled={empty}
            >
              <span className="interest-tile-icon">
                <Icon size={18} />
              </span>
              <span className="interest-tile-name">{t(tile.tag)}</span>
              <span className="interest-tile-meta">
                {tile.avatars.length > 0 && (
                  <span className="interest-avatars" aria-hidden="true">
                    {tile.avatars.map((a) => (
                      <img key={a} src={`${API_BASE_URL}${a}`} alt="" loading="lazy" />
                    ))}
                  </span>
                )}
                <span>{empty ? t('Henüz kimse yok') : t('{n} kişi', { n: tile.count })}</span>
              </span>
            </button>
          );
        })}
      </div>
      {openTag && <TagPeopleSheet tag={openTag} onClose={closeSheet} />}
    </>
  );
}

// Bir etiketi seçmiş kampüs öğrencilerinin listesi (alttan açılan pencere)
function TagPeopleSheet({ tag, onClose }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [users, setUsers] = useState(null);

  useEffect(() => {
    api
      .get('/discover/by-tag', { params: { tag } })
      .then((res) => setUsers(res.data.users))
      .catch(() => setUsers([]));
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tag, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet tag-people-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-people-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="tag-people-title">{t('{tag} sevenler', { tag: t(tag) })}</h3>
          <button className="modal-close" onClick={onClose} aria-label={t('Kapat')}>
            <X size={16} />
          </button>
        </div>
        {!users && (
          <p className="muted center-text">
            <Loader2 size={18} className="spin" />
          </p>
        )}
        {users && users.length === 0 && <p className="muted center-text">{t('Şu an gösterilecek kimse yok.')}</p>}
        {users && users.length > 0 && (
          <ul className="tag-people-list">
            {users.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => navigate(`/users/${u.id}`)}>
                  <span className="tag-people-avatar">
                    {u.photoUrl ? <img src={`${API_BASE_URL}${u.photoUrl}`} alt="" /> : <UserRound size={20} />}
                  </span>
                  <span className="tag-people-text">
                    <strong>
                      {u.fullName}
                      {u.verified && <BadgeCheck size={14} className="person-card-verified" />}
                    </strong>
                    <span>
                      {[u.department, u.classYear ? t(`${u.classYear}. Sınıf`) : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <ChevronRight size={16} className="tag-people-chevron" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
