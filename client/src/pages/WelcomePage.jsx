import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Check, UserRound } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import PhotoGallery from '../components/PhotoGallery';
import TagPicker from '../components/TagPicker';
import { HOBBY_OPTIONS, INTEREST_OPTIONS, parseTags } from '../constants/tags';

// Kayıttan hemen sonra gösterilen 3 adımlık başlangıç: fotoğraf, ilgi
// alanları, birkaç kişiyi takip et. Amaç yeni gelenin boş bir profil ve boş
// bir akışla karşılaşmaması. Her adım atlanabilir; sonradan profilden yapılır.
const STEPS = ['photo', 'interests', 'people'];

export default function WelcomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState(user?.interests || '');
  const [hobbies, setHobbies] = useState(user?.hobbies || '');
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState(null);
  const [followed, setFollowed] = useState(new Set());

  useEffect(() => {
    if (STEPS[step] !== 'people' || people) return;
    api
      .get('/discover/home')
      .then((res) => setPeople((res.data.suggestedUsers || []).slice(0, 8)))
      .catch(() => setPeople([]));
  }, [step, people]);

  function finish() {
    navigate('/discover', { replace: true });
  }

  async function saveInterests() {
    setSaving(true);
    try {
      const res = await api.put('/profile/me', { interests, hobbies });
      setUser((prev) => ({ ...prev, ...res.data.user }));
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFollow(id) {
    const on = followed.has(id);
    setFollowed((prev) => {
      const next = new Set(prev);
      on ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      await api.post(`/users/${id}/${on ? 'unfollow' : 'follow'}`);
    } catch {
      setFollowed((prev) => {
        const next = new Set(prev);
        on ? next.add(id) : next.delete(id);
        return next;
      });
    }
  }

  if (!user) return null;
  const firstName = user.fullName?.split(' ')[0] || '';
  const current = STEPS[step];

  return (
    <div className="container welcome">
      <div className="welcome-progress" aria-label={t('Adım {n} / {total}', { n: step + 1, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <span key={s} className={i <= step ? 'on' : ''} />
        ))}
      </div>

      {current === 'photo' && (
        <section className="welcome-step">
          <p className="welcome-eyebrow">{t('Hoş geldin, {name}', { name: firstName })}</p>
          <h1>{t('Önce bir fotoğraf ekle')}</h1>
          <p className="welcome-lead">{t('Fotoğrafı olan profiller çok daha fazla ilgi görür. İlk fotoğraf profil fotoğrafın olur.')}</p>
          <div className="card welcome-card">
            <PhotoGallery
              photos={user.photos || []}
              onChange={(data) => setUser((prev) => ({ ...prev, photos: data.photos, photoUrl: data.photoUrl }))}
            />
          </div>
          <div className="welcome-actions">
            <button type="button" className="welcome-skip" onClick={() => setStep(1)}>
              {t('Şimdilik geç')}
            </button>
            <button type="button" className="btn welcome-next" onClick={() => setStep(1)}>
              {t('Devam et')} <ArrowRight size={17} />
            </button>
          </div>
        </section>
      )}

      {current === 'interests' && (
        <section className="welcome-step">
          <p className="welcome-eyebrow">{t('2. adım')}</p>
          <h1>{t('Neleri seversin?')}</h1>
          <p className="welcome-lead">{t('Seçtiklerine göre seninle aynı şeyleri seven öğrencileri öne çıkarırız.')}</p>
          <div className="card welcome-card">
            <TagPicker
              id="welcome-interests"
              label={t('İlgi Alanları')}
              options={INTEREST_OPTIONS}
              value={parseTags(interests)}
              onChange={(tags) => setInterests(tags.join(', '))}
            />
            <TagPicker
              id="welcome-hobbies"
              label={t('Hobiler')}
              options={HOBBY_OPTIONS}
              value={parseTags(hobbies)}
              onChange={(tags) => setHobbies(tags.join(', '))}
            />
          </div>
          <div className="welcome-actions">
            <button type="button" className="welcome-skip" onClick={() => setStep(2)}>
              {t('Şimdilik geç')}
            </button>
            <button type="button" className="btn welcome-next" onClick={saveInterests} disabled={saving}>
              {saving ? t('Kaydediliyor...') : t('Devam et')} <ArrowRight size={17} />
            </button>
          </div>
        </section>
      )}

      {current === 'people' && (
        <section className="welcome-step">
          <p className="welcome-eyebrow">{t('Son adım')}</p>
          <h1>{t('Kampüsünden birkaç kişiyi takip et')}</h1>
          <p className="welcome-lead">{t('Takip ettiklerinin paylaşımları akışında görünür.')}</p>
          {!people && <p className="muted center-text">{t('Yükleniyor...')}</p>}
          {people && people.length === 0 && (
            <div className="card welcome-card center-text">
              <p className="muted">{t('Kampüsünde henüz önerecek kimse yok. İlk gelenlerdensin!')}</p>
            </div>
          )}
          {people && people.length > 0 && (
            <ul className="welcome-people">
              {people.map((p) => {
                const on = followed.has(p.id);
                return (
                  <li key={p.id}>
                    <span className="welcome-avatar">
                      {p.photoUrl ? <img src={`${API_BASE_URL}${p.photoUrl}`} alt="" /> : <UserRound size={22} />}
                    </span>
                    <span className="welcome-person-text">
                      <strong>
                        {p.fullName}
                        {p.verified && <BadgeCheck size={14} className="person-card-verified" />}
                      </strong>
                      <span>{p.department || p.university?.name}</span>
                    </span>
                    <button
                      type="button"
                      className={`welcome-follow ${on ? 'is-on' : ''}`}
                      onClick={() => toggleFollow(p.id)}
                      aria-pressed={on}
                    >
                      {on ? (
                        <>
                          <Check size={14} /> {t('Takipte')}
                        </>
                      ) : (
                        t('Takip Et')
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="welcome-actions">
            <span className="welcome-count">{followed.size > 0 ? t('{n} kişiyi takip ediyorsun', { n: followed.size }) : ''}</span>
            <button type="button" className="btn welcome-next" onClick={finish}>
              {t('Keşfetmeye başla')} <ArrowRight size={17} />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
