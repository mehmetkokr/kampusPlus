import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n';

// Profil doluluk oranı: her adımın bir ağırlığı var (toplam 100).
// Eksik adıma tıklanınca profildeki ilgili bölüme kaydırılır.
export function getCompletionSteps(user) {
  const photos = user?.photos?.length || 0;
  return [
    { key: 'photo', label: 'Profil fotoğrafı ekle', weight: 15, done: !!user?.photoUrl, target: 'profile-gallery' },
    { key: 'photos', label: 'En az 3 fotoğraf ekle', weight: 10, done: photos >= 3, target: 'profile-gallery' },
    { key: 'bio', label: 'Hakkında birkaç cümle yaz', weight: 15, done: !!user?.bio?.trim(), target: 'profile-bio' },
    { key: 'interests', label: 'İlgi alanlarını ekle', weight: 10, done: !!user?.interests?.trim(), target: 'profile-interests' },
    { key: 'hobbies', label: 'Hobilerini ekle', weight: 10, done: !!user?.hobbies?.trim(), target: 'profile-hobbies' },
    { key: 'birth', label: 'Doğum tarihini ekle', weight: 10, done: !!user?.birthDate, target: 'profile-birth' },
    { key: 'school', label: 'Bölüm ve sınıf bilgisi', weight: 5, done: !!(user?.department && user?.classYear), target: null },
    { key: 'social', label: 'Bir sosyal medya hesabı ekle', weight: 10, done: !!(user?.instagramUrl || user?.twitterUrl), target: 'profile-social' },
    { key: 'badge', label: 'Onaylı öğrenci rozeti al', weight: 15, done: user?.studentDocStatus === 'approved', target: 'student-badge' },
  ];
}

export function getCompletionPercent(user) {
  return getCompletionSteps(user).reduce((sum, s) => sum + (s.done ? s.weight : 0), 0);
}

function scrollTo(id) {
  const el = id && document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (typeof el.focus === 'function') el.focus({ preventScroll: true });
}

export default function ProfileCompletion({ user }) {
  const { t } = useI18n();
  const steps = getCompletionSteps(user);
  const percent = getCompletionPercent(user);
  const missing = steps.filter((s) => !s.done);
  const r = 26;
  const circ = 2 * Math.PI * r;

  return (
    <div className="completion-card" aria-label={`Profilin yüzde ${percent} tamamlandı`}>
      <div className="completion-head">
        <div className="completion-ring" aria-hidden="true">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={r} className="completion-track" />
            <circle
              cx="32"
              cy="32"
              r={r}
              className="completion-fill"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - percent / 100)}
            />
          </svg>
          <span>%{percent}</span>
        </div>
        <div>
          <strong>{percent === 100 ? t("Profilin eksiksiz") : t("Profilini tamamla")}</strong>
          <p>
            {percent === 100
              ? t("Tüm adımları tamamladın. Harika görünüyor!")
              : t('{n} adım kaldı. Dolu bir profil seni diğer öğrencilere daha iyi tanıtır.', { n: missing.length })}
          </p>
        </div>
      </div>

      {missing.length > 0 && (
        <ul className="completion-list">
          {steps.map((s) => (
            <li key={s.key} className={s.done ? 'done' : ''}>
              <button type="button" disabled={s.done || !s.target} onClick={() => scrollTo(s.target)}>
                <span className="completion-check">{s.done && <Check size={12} strokeWidth={3} />}</span>
                <span className="completion-label">{t(s.label)}</span>
                <span className="completion-weight">+{s.weight}</span>
                {!s.done && s.target && <ChevronRight size={15} className="completion-chevron" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
