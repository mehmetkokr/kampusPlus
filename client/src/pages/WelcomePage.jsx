import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Check, UserRound } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { needsBasics, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import PhotoGallery from '../components/PhotoGallery';
import TagPicker from '../components/TagPicker';
import BirthDateInput from '../components/BirthDateInput';
import CubeLoader from '../components/CubeLoader';
import { HOBBY_OPTIONS, INTEREST_OPTIONS, parseTags } from '../constants/tags';
import { INTENT_OPTIONS, parseIntents } from '../constants/intents';
import { toTitleCaseTR } from '../utils/text';

// Kayıttan hemen sonra gösterilen başlangıç. Kayıt formu kısa olduğu için
// ilk adım "seni tanıyalım": doğum tarihi, bölüm, sınıf ve ne aradığın (bu adım
// atlanamaz). Ardından fotoğraf, ilgi alanları ve birkaç kişiyi takip etme
// gelir; amaç yeni gelenin boş bir profil ve boş bir akışla karşılaşmaması.
// Bu üçü atlanabilir; sonradan profilden yapılır.
const BASE_STEPS = ['photo', 'interests', 'people'];

export default function WelcomePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const [step, setStep] = useState(0);
  // Profil tam yüklenince bir kez karar verilir; adım bitince liste değişmesin
  const [withAbout, setWithAbout] = useState(null);
  const [about, setAbout] = useState({ birthDate: '', department: '', classYear: '' });
  const [intents, setIntents] = useState(['friendship']);
  const [aboutError, setAboutError] = useState(null);
  const [interests, setInterests] = useState(user?.interests || '');
  const [hobbies, setHobbies] = useState(user?.hobbies || '');
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState(null);
  const [followed, setFollowed] = useState(new Set());

  useEffect(() => {
    if (withAbout === null && user && 'department' in user) {
      setWithAbout(needsBasics(user));
      const own = parseIntents(user.intent);
      if (own.length) setIntents(own);
    }
  }, [user, withAbout]);

  const STEPS = withAbout ? ['about', ...BASE_STEPS] : BASE_STEPS;
  const stepIndex = (key) => STEPS.indexOf(key);

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

  function toggleIntent(value) {
    setIntents((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function saveAbout(e) {
    e.preventDefault();
    if (!user.birthDate && !about.birthDate) return setAboutError({ field: 'birthDate', text: t('Doğum tarihini gir.') });
    if (!user.department && about.department.trim().length < 2) return setAboutError({ field: 'department', text: t('Bölümünü yaz.') });
    if (!user.classYear && !about.classYear) return setAboutError({ field: 'classYear', text: t('Sınıfını seç.') });
    if (intents.length === 0) return setAboutError({ field: 'intent', text: t('En az bir seçenek seç.') });
    setAboutError(null);
    setSaving(true);
    try {
      const res = await api.put('/profile/me/basics', {
        ...about,
        department: toTitleCaseTR(about.department),
        intent: intents.join(','),
      });
      setUser((prev) => ({ ...prev, ...res.data.user }));
      setStep(stepIndex('photo'));
    } catch (err) {
      const data = err.response?.data || {};
      if (data.field) setAboutError({ field: data.field, text: data.error });
      else toast.error(data.error || 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function saveInterests() {
    setSaving(true);
    try {
      const res = await api.put('/profile/me', { interests, hobbies });
      setUser((prev) => ({ ...prev, ...res.data.user }));
      setStep(stepIndex('people'));
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
  if (withAbout === null) return <CubeLoader mode="fullscreen" />;
  const firstName = user.fullName?.split(' ')[0] || '';
  const current = STEPS[step];

  return (
    <div className="container welcome">
      <div className="welcome-progress" aria-label={t('Adım {n} / {total}', { n: step + 1, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <span key={s} className={i <= step ? 'on' : ''} />
        ))}
      </div>

      {current === 'about' && (
        <section className="welcome-step">
          <p className="welcome-eyebrow">{t('Hoş geldin, {name}', { name: firstName })}</p>
          <h1>{t('Seni biraz tanıyalım')}</h1>
          <p className="welcome-lead">{t('E-postan doğrulandı. Bu bilgiler profilinde görünür ve sana uygun öğrencileri bulmamıza yardım eder.')}</p>
          <form className="card welcome-card welcome-about" onSubmit={saveAbout} noValidate>
            {!user.birthDate && (
              <>
                <label htmlFor="welcome-birth">{t('Doğum Tarihi')}</label>
                <BirthDateInput id="welcome-birth" value={about.birthDate} onChange={(v) => setAbout((a) => ({ ...a, birthDate: v }))} required />
                {aboutError?.field === 'birthDate' ? (
                  <p className="field-hint field-hint-warn" role="alert">{aboutError.text}</p>
                ) : (
                  <p className="field-hint">{t('Profilinde yalnızca yaşın görünür. Sonradan değiştirilemez.')}</p>
                )}
              </>
            )}

            {!user.department && (
              <>
                <label htmlFor="welcome-dept">{t('Bölüm')}</label>
                <input
                  id="welcome-dept"
                  value={about.department}
                  onChange={(e) => setAbout((a) => ({ ...a, department: e.target.value }))}
                  onBlur={(e) => setAbout((a) => ({ ...a, department: toTitleCaseTR(e.target.value) }))}
                  placeholder={t('örn. Bilgisayar Mühendisliği')}
                  aria-invalid={aboutError?.field === 'department'}
                  className={aboutError?.field === 'department' ? 'is-invalid' : ''}
                  autoComplete="off"
                />
                {aboutError?.field === 'department' && (
                  <p className="field-hint field-hint-warn" role="alert">{aboutError.text}</p>
                )}
              </>
            )}

            {!user.classYear && (
              <>
                <label htmlFor="welcome-class">{t('Sınıf')}</label>
                <select
                  id="welcome-class"
                  value={about.classYear}
                  onChange={(e) => setAbout((a) => ({ ...a, classYear: e.target.value }))}
                  aria-invalid={aboutError?.field === 'classYear'}
                  className={aboutError?.field === 'classYear' ? 'is-invalid' : ''}
                >
                  <option value="">{t('Seçiniz...')}</option>
                  <option value="1">{t('1. Sınıf')}</option>
                  <option value="2">{t('2. Sınıf')}</option>
                  <option value="3">{t('3. Sınıf')}</option>
                  <option value="4">{t('4. Sınıf')}</option>
                  <option value="5">{t('Yüksek Lisans / Diğer')}</option>
                </select>
                {aboutError?.field === 'classYear' ? (
                  <p className="field-hint field-hint-warn" role="alert">{aboutError.text}</p>
                ) : (
                  <p className="field-hint">{t('Bölüm ve sınıf sonradan değiştirilemez; lütfen doğru seç.')}</p>
                )}
              </>
            )}

            <label id="welcome-intent-label">{t('Ne arıyorsun? (birden fazla seçebilirsin)')}</label>
            <div className="intent-select-grid" role="group" aria-labelledby="welcome-intent-label">
              {INTENT_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className={`intent-toggle ${intents.includes(opt.value) ? 'active' : ''}`}
                  aria-pressed={intents.includes(opt.value)}
                  onClick={() => toggleIntent(opt.value)}
                >
                  {t(opt.label)}
                </button>
              ))}
            </div>
            {aboutError?.field === 'intent' ? (
              <p className="field-hint field-hint-warn" role="alert">{aboutError.text}</p>
            ) : (
              <p className="field-hint">{t('Flört ve Uzun Süreli İlişki seçimini yalnızca bunları seçen öğrenciler görür.')}</p>
            )}

            <div className="welcome-actions welcome-about-actions">
              <span />
              <button type="submit" className="btn welcome-next" disabled={saving}>
                {saving ? t('Kaydediliyor...') : t('Devam et')} <ArrowRight size={17} />
              </button>
            </div>
          </form>
        </section>
      )}

      {current === 'photo' && (
        <section className="welcome-step">
          <p className="welcome-eyebrow">
            {withAbout ? t('{n}. adım', { n: step + 1 }) : t('Hoş geldin, {name}', { name: firstName })}
          </p>
          <h1>{withAbout ? t('Bir fotoğraf ekle') : t('Önce bir fotoğraf ekle')}</h1>
          <p className="welcome-lead">{t('Fotoğrafı olan profiller çok daha fazla ilgi görür. İlk fotoğraf profil fotoğrafın olur.')}</p>
          <div className="card welcome-card">
            <PhotoGallery
              photos={user.photos || []}
              onChange={(data) => setUser((prev) => ({ ...prev, photos: data.photos, photoUrl: data.photoUrl }))}
            />
          </div>
          <div className="welcome-actions">
            <button type="button" className="welcome-skip" onClick={() => setStep(stepIndex('interests'))}>
              {t('Şimdilik geç')}
            </button>
            <button type="button" className="btn welcome-next" onClick={() => setStep(stepIndex('interests'))}>
              {t('Devam et')} <ArrowRight size={17} />
            </button>
          </div>
        </section>
      )}

      {current === 'interests' && (
        <section className="welcome-step">
          <p className="welcome-eyebrow">{t('{n}. adım', { n: step + 1 })}</p>
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
            <button type="button" className="welcome-skip" onClick={() => setStep(stepIndex('people'))}>
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
