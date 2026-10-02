import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Coffee, Cpu, Palette, Sparkles, Trophy, Users, X } from 'lucide-react';
import api from '../api';
import ClubIcon from './ClubIcon';
import { CLUB_CATEGORY_STYLE, CLUB_ICONS, ICON_PREFIX } from '../constants/clubIcons';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';

export const NAME_MAX = 40;
export const DESC_MAX = 280;

// Her kategorinin kendi rengi, ikonu, önerilen simgeleri ve isim ilhamları var.
// Önizleme kapağı ve seçili kutular bu renklerle boyanır.
const CATEGORIES = [
  {
    value: 'Teknoloji',
    icon: Cpu,
    tone: '#6f8db3',
    tone2: '#4a6588',
    ideas: ['Yapay Zeka Topluluğu', 'Kodlama Kulübü', 'Oyun Geliştirme'],
  },
  {
    value: 'Spor',
    icon: Trophy,
    tone: '#7fa88a',
    tone2: '#557a60',
    ideas: ['Koşu Takımı', 'Doğa Yürüyüşü', 'Kampüs Voleybolu'],
  },
  {
    value: 'Sanat',
    icon: Palette,
    tone: '#d97757',
    tone2: '#a94a22',
    ideas: ['Fotoğrafçılık Kulübü', 'Film Gecesi', 'Akustik Müzik'],
  },
  {
    value: 'Akademik',
    icon: BookOpen,
    tone: '#c9a24a',
    tone2: '#9c7a2c',
    ideas: ['Final Çalışma Grubu', 'Münazara Kulübü', 'Satranç Kulübü'],
  },
  {
    value: 'Sosyal',
    icon: Coffee,
    tone: '#b08968',
    tone2: '#7f6149',
    ideas: ['Kahve Sohbetleri', 'Kutu Oyunu Geceleri', 'Gönüllülük Topluluğu'],
  },
  {
    value: 'Diğer',
    icon: Sparkles,
    tone: '#8e8499',
    tone2: '#665d72',
    ideas: ['Girişimcilik Kulübü', 'Astronomi Topluluğu', 'Dil Değişimi'],
  },
];

export default function CreateClubSheet({ onClose, onCreated }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [category, setCategory] = useState('Sosyal');
  const cat = CATEGORIES.find((c) => c.value === category);
  const iconsFor = (c) => CLUB_CATEGORY_STYLE[c].icons.map((k) => ICON_PREFIX + k);
  const [iconEmoji, setIconEmoji] = useState(iconsFor('Sosyal')[0]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Önizleme kapağındaki desen: kategorinin önerilen çizgi ikonları
  const patternIcons = (CLUB_CATEGORY_STYLE[cat.value]?.icons || []).slice(0, 6).map((k) => CLUB_ICONS[k]).filter(Boolean);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function pickCategory(next) {
    const c = CATEGORIES.find((x) => x.value === next);
    setCategory(next);
    // Kullanıcı henüz kendi simgesini değiştirmediyse kategoriye uygun olanı öner
    // Kullanıcı kendi simgesini seçmediyse kategoriye uygun ilkini öner
    if (CATEGORIES.some((x) => iconsFor(x.value)[0] === iconEmoji)) setIconEmoji(iconsFor(next)[0]);
  }

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length >= 3 && !saving;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (trimmedName.length < 3) return setError('Kulüp adı en az 3 karakter olmalı.');
    setSaving(true);
    try {
      const res = await api.post('/clubs', { name: trimmedName, description, category, iconEmoji });
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Kulüp oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  const toneStyle = { '--club-tone': cat.tone, '--club-tone-2': cat.tone2 };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal-sheet club-studio"
        style={toneStyle}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-studio-title"
      >
        <div className="club-studio-top">
          <div>
            <p className="club-studio-eyebrow">{t("Kulüp Stüdyosu")}</p>
            <h3 id="club-studio-title">{t("Yeni kulüp kur")}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t("Kapat")}>
            <X size={18} />
          </button>
        </div>

        {/* ---------- Canlı önizleme ---------- */}
        <div className="club-preview" aria-label={t("Kulüp kartı önizlemesi")}>
          <div className="club-preview-cover">
            <span className="club-preview-pattern" aria-hidden="true">
              {patternIcons.concat(patternIcons).map((Icon, i) => (
                <span key={i}>
                  <Icon size={18} strokeWidth={1.8} />
                </span>
              ))}
            </span>
          </div>
          <div className="club-preview-body">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={iconEmoji}
                className="club-preview-emoji"
                initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 26 }}
              >
                <ClubIcon value={iconEmoji} category={category} size={52} />
              </motion.span>
            </AnimatePresence>
            <div className="club-preview-text">
              <strong className={trimmedName ? '' : 'is-placeholder'}>{trimmedName || t("Kulübünün adı")}</strong>
              <span>
                <cat.icon size={12} /> {category} {t("· 1 üye ·")} {user?.university?.name || t("Kampüsün")}
              </span>
            </div>
          </div>
          {description.trim() && <p className="club-preview-desc">{description.trim()}</p>}
        </div>

        {/* ---------- Kategori ---------- */}
        <fieldset className="club-studio-section">
          <legend>{t("Ne tür bir kulüp?")}</legend>
          <div className="club-category-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`club-category ${category === c.value ? 'active' : ''}`}
                style={{ '--cat-tone': c.tone }}
                onClick={() => pickCategory(c.value)}
                aria-pressed={category === c.value}
              >
                <c.icon size={18} />
                <span>{t(c.value)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* ---------- Simge ---------- */}
        <fieldset className="club-studio-section">
          <legend>{t("Simgesi")}</legend>
          <div className="club-emoji-row">
            {iconsFor(category).map((em) => {
              const Icon = CLUB_ICONS[em.slice(ICON_PREFIX.length)];
              return (
                <button
                  key={em}
                  type="button"
                  className={`club-emoji ${iconEmoji === em ? 'active' : ''}`}
                  onClick={() => setIconEmoji(em)}
                  aria-label={`Simge: ${em.slice(ICON_PREFIX.length)}`}
                  aria-pressed={iconEmoji === em}
                >
                  <Icon size={20} strokeWidth={1.9} />
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* ---------- Ad ---------- */}
        <div className="club-studio-section">
          <div className="club-field-head">
            <label htmlFor="club-name">{t("Kulüp adı")}</label>
            <span className={`club-counter ${name.length > NAME_MAX - 5 ? 'warn' : ''}`}>
              {name.length}/{NAME_MAX}
            </span>
          </div>
          <input
            id="club-name"
            ref={nameRef}
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder={`örn. ${cat.ideas[0]}`}
            autoComplete="off"
          />
          <div className="club-ideas">
            <span>{t("İlham:")}</span>
            {cat.ideas.map((idea) => (
              <button key={idea} type="button" onClick={() => setName(idea)}>
                {idea}
              </button>
            ))}
          </div>
        </div>

        {/* ---------- Açıklama ---------- */}
        <div className="club-studio-section">
          <div className="club-field-head">
            <label htmlFor="club-desc">
              {t("Açıklama")} <span className="club-optional">{t("isteğe bağlı")}</span>
            </label>
            <span className={`club-counter ${description.length > DESC_MAX - 20 ? 'warn' : ''}`}>
              {description.length}/{DESC_MAX}
            </span>
          </div>
          <textarea
            id="club-desc"
            value={description}
            maxLength={DESC_MAX}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("Ne yapıyorsunuz, ne sıklıkla buluşuyorsunuz, kimler katılmalı?")}
            rows={3}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="club-studio-footer">
          <p>
            <Users size={14} /> {t('Kulübün yalnızca {uni} öğrencilerine görünür. Kurucusu sen olursun.', { uni: user?.university?.name || t('kendi üniversitendeki') })}
          </p>
          <button className="btn club-studio-submit" type="submit" disabled={!canSubmit}>
            {saving ? t("Kuruluyor…") : t("Kulübü kur")}
          </button>
        </div>
      </form>
    </div>
  );
}
