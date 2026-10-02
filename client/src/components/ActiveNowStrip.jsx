import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';

// Keşfet'in üstündeki "Şu an aktif" şeridi: kampüste çevrimiçi olanlar,
// yeşil halkalı avatarlar halinde yatay kayar (Instagram hikâye şeridi gibi).
// Çevrimiçi kimse yoksa hiç gösterilmez; boş bir şerit sayfayı ölü gösterir.
export default function ActiveNowStrip({ users }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  if (!users || users.length === 0) return null;

  return (
    <section className="active-now" aria-labelledby="active-now-title">
      <h2 id="active-now-title" className="active-now-title">
        <span className="active-now-pulse" aria-hidden="true" />
        {t('Şu an aktif')}
        <span className="active-now-count">{users.length}</span>
      </h2>
      <ul className="active-now-list">
        {users.map((u) => (
          <li key={u.id}>
            <button type="button" className="active-now-item" onClick={() => navigate(`/users/${u.id}`)}>
              <span className="active-now-ring">
                <span className="active-now-avatar">
                  {u.photoUrl ? (
                    <img src={`${API_BASE_URL}${u.photoUrl}`} alt="" loading="lazy" />
                  ) : (
                    <UserRound size={24} strokeWidth={1.6} />
                  )}
                </span>
                <span className="active-now-dot" aria-hidden="true" />
              </span>
              <span className="active-now-name">{u.fullName.split(' ')[0]}</span>
              <span className="sr-only">{t('{name} şu an çevrimiçi', { name: u.fullName })}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
