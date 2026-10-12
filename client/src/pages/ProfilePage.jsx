import React, { useState, useEffect } from 'react';
import { VerifiedBadge } from '@/components/ui/icon-badge';
import { Link } from 'react-router-dom';
import { Camera, ChevronRight, GraduationCap, Lock, LogOut, Settings, ShieldCheck } from '../components/icons';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import NotificationBell from '../components/NotificationBell';
import PhotoGallery from '../components/PhotoGallery';
import StudentBadgeCard from '../components/StudentBadgeCard';
import ProfileCompletion, { getCompletionPercent } from '../components/ProfileCompletion';
import MultiSelectBox from '../components/MultiSelectBox';
import { SocialBadge } from '../components/SocialGlyphs';
import { socialHandle } from '../utils/social';
import { INTENT_OPTIONS, parseIntents } from '../constants/intents';
import { INTEREST_OPTIONS, HOBBY_OPTIONS, MAX_TAGS, parseTags } from '../constants/tags';
import { useI18n } from '../i18n';
import { compressImage } from '../utils/image';
import { usePhotoEditor } from '../context/PhotoEditorContext';
import BirthDateInput from '../components/BirthDateInput';
import '../styles/profile.css';

// Profilim: ortada ilerleme halkalı fotoğraf ve rozetler; altında 2×3
// fotoğraf galerisi, "Ne arıyorsun?", "Hakkımda", ilgi alanları, hobiler ve
// sosyal medya. Değişiklikler alttaki sabit düğmeyle tek seferde kaydedilir.
const BIO_MAX = 300;

function fromUser(user) {
  return {
    bio: user.bio || '',
    interests: user.interests || '',
    hobbies: user.hobbies || '',
    // Formda kullanıcı adı gösterilir; sunucu güvenli adrese çevirir
    instagramUrl: socialHandle('instagram', user.instagramUrl) || '',
    twitterUrl: socialHandle('x', user.twitterUrl) || '',
    intent: parseIntents(user.intent).join(','),
  };
}

export default function ProfilePage() {
  const { t } = useI18n();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const editPhoto = usePhotoEditor();

  const [form, setForm] = useState(null);
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  useEffect(() => {
    if (user) setForm(fromUser(user));
  }, [user]);

  if (!user || !form) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const intents = form.intent ? form.intent.split(',') : [];

  const saved = fromUser(user);
  const dirty = Object.keys(saved).some((k) => saved[k] !== form[k]) || (!user.birthDate && !!birthDate);

  async function handleSave() {
    if (intents.length === 0) {
      toast.error('"Ne arıyorsun?" için en az bir seçenek seç.');
      document.getElementById('profile-intents')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/profile/me', {
        ...form,
        // Doğum tarihi yalnızca daha önce hiç girilmemişse bir kez gönderilir
        ...(!user.birthDate && birthDate ? { birthDate } : {}),
      });
      setUser((prev) => ({ ...prev, ...res.data.user }));
      setBirthDate('');
      toast.success('Değişiklikler kaydedildi.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Güncelleme başarısız oldu.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const edited = await editPhoto(file, { aspects: ['1:1'], title: 'Profil fotoğrafı' });
    if (!edited) return;
    const formData = new FormData();
    formData.append('photo', await compressImage(edited));
    try {
      const res = await api.post('/profile/me/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser((prev) => ({ ...prev, photoUrl: res.data.photoUrl, photos: res.data.photos || prev.photos }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Fotoğraf yüklenemedi.');
    }
  }

  const percent = getCompletionPercent(user);
  const R = 62;
  const C = 2 * Math.PI * R;
  const isStudentVerified = user.studentDocStatus === 'approved';
  const statusBadge = isStudentVerified
    ? null
    : {
        pending: 'Doğrulama bekleniyor',
        manual_review: 'Belge inceleniyor',
        auto_verified: 'E-posta doğrulandı',
        verified: 'E-posta doğrulandı',
        rejected: 'Belge reddedildi',
      }[user.verificationStatus];

  return (
    <div className="container pf-page">
      {/* Cam kartların arkasındaki renkli zemin: profil fotoğrafının bulanık
          hâli ve sitenin mavisinde yumuşak ışıklar */}
      <div className="pf-backdrop" aria-hidden="true">
        {user.photoUrl && <img src={`${API_BASE_URL}${user.photoUrl}`} alt="" />}
      </div>
      <header className="pf-header">
        <h1>{t('Profilim')}</h1>
        <div className="pf-header-actions">
          <Link to="/settings" className="pf-icon-btn" aria-label={t('Ayarlar')}>
            <Settings size={22} />
          </Link>
          <NotificationBell />
        </div>
      </header>

      {/* ---------- Profil kartı ---------- */}
      <section className="pf-card pf-hero">
        <div className="pf-avatar">
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <circle cx="70" cy="70" r={R} className="pf-ring-track" />
            <circle cx="70" cy="70" r={R} className="pf-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - percent / 100)} />
          </svg>
          {user.photoUrl ? <img src={`${API_BASE_URL}${user.photoUrl}`} alt={user.fullName} /> : <span className="pf-avatar-empty" aria-hidden="true" />}
          <label className="pf-avatar-edit">
            <Camera size={16} aria-hidden="true" />
            <span className="sr-only">{t('Profil fotoğrafını değiştir')}</span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          </label>
        </div>
        <h2 className="pf-name">
          {user.fullName}
          {user.age ? `, ${user.age}` : ''}
        </h2>
        <p className="pf-uni">{user.university?.name}</p>
        <div className="pf-hero-row">
          {isStudentVerified ? (
            <span className="pf-verified">
              <VerifiedBadge size="sm" label={t('Onaylı öğrenci')} /> {t('Onaylı Öğrenci')}
            </span>
          ) : (
            statusBadge && <span className="pf-status">{t(statusBadge)}</span>
          )}
          <button type="button" className="pf-completion-link" onClick={() => setShowCompletion((v) => !v)} aria-expanded={showCompletion}>
            {t('Profil Tamamlama')}: %{percent} <ChevronRight size={16} className={showCompletion ? 'is-open' : ''} />
          </button>
        </div>
      </section>

      {showCompletion && <ProfileCompletion user={user} />}
      {!isStudentVerified && <StudentBadgeCard user={user} setUser={setUser} variant="profile" />}

      {/* ---------- Fotoğraflar ---------- */}
      <section className="pf-card" id="profile-gallery" tabIndex={-1}>
        <div className="pf-section-head">
          <h3 className="pf-title">{t('Fotoğraflar')}</h3>
          <button type="button" className="pf-link" onClick={() => setEditingPhotos((v) => !v)} aria-pressed={editingPhotos}>
            {editingPhotos ? t('Bitti') : t('Düzenle')}
          </button>
        </div>
        <PhotoGallery
          bare
          editing={editingPhotos}
          photos={user.photos || []}
          onChange={(data) => setUser((prev) => ({ ...prev, photos: data.photos, photoUrl: data.photoUrl }))}
        />
      </section>

      <section className="pf-card pf-form">
        {/* ---------- Ne arıyorsun? ---------- */}
        <MultiSelectBox
          id="profile-intents"
          label={t('Ne arıyorsun?')}
          options={INTENT_OPTIONS}
          value={intents}
          onChange={(values) => set('intent', values.join(','))}
          hint={t('Flört ve Uzun Süreli İlişki seçimini yalnızca bunları seçen öğrenciler görür.')}
        />

        {/* ---------- Hakkımda ---------- */}
        <div className="pf-section">
          <div className="pf-section-head">
            <label className="pf-label" htmlFor="profile-bio">
              {t('Hakkımda')}
            </label>
            <span className="pf-count">
              {form.bio.length}/{BIO_MAX}
            </span>
          </div>
          <textarea
            id="profile-bio"
            className="pf-input pf-textarea"
            rows={3}
            maxLength={BIO_MAX}
            value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
            placeholder={t('Kendinden birkaç cümle bahset...')}
          />
        </div>

        {/* ---------- İlgi alanları ve hobiler ---------- */}
        <MultiSelectBox
          id="profile-interests"
          label={t('İlgi Alanları')}
          options={INTEREST_OPTIONS}
          max={MAX_TAGS}
          value={parseTags(form.interests)}
          onChange={(tags) => set('interests', tags.join(', '))}
        />
        <MultiSelectBox
          id="profile-hobbies"
          label={t('Hobiler')}
          options={HOBBY_OPTIONS}
          max={MAX_TAGS}
          value={parseTags(form.hobbies)}
          onChange={(tags) => set('hobbies', tags.join(', '))}
        />

        {/* ---------- Sosyal medya ---------- */}
        <div className="pf-section" id="profile-social" tabIndex={-1}>
          <h3 className="pf-label">{t('Sosyal Medya Bağlantıları')}</h3>
          <label className="pf-social">
            <span className="pf-social-icon">
              <SocialBadge network="instagram" size={32} />
            </span>
            <input className="pf-input" value={form.instagramUrl} onChange={(e) => set('instagramUrl', e.target.value)} placeholder={t('Instagram kullanıcı adı')} aria-label={t('Instagram kullanıcı adı')} />
          </label>
          <label className="pf-social">
            <span className="pf-social-icon">
              <SocialBadge network="x" size={32} />
            </span>
            <input className="pf-input" value={form.twitterUrl} onChange={(e) => set('twitterUrl', e.target.value)} placeholder={t('Twitter / X kullanıcı adı')} aria-label={t('Twitter / X kullanıcı adı')} />
          </label>
        </div>

        {!user.birthDate && (
          <div className="pf-section" id="profile-birth" tabIndex={-1}>
            <label className="pf-label" htmlFor="profile-birth-input">
              {t('Doğum Tarihi')}
            </label>
            <BirthDateInput id="profile-birth-input" value={birthDate} onChange={setBirthDate} />
            <p className="pf-hint">{t('Yaşın buradan hesaplanır. Bir kez kaydedildikten sonra değiştirilemez.')}</p>
          </div>
        )}
      </section>

      {/* ---------- Okul bilgileri (değiştirilemez) ---------- */}
      <section className="pf-card locked-info" aria-label={t('Okul bilgilerin')}>
        <div className="locked-info-head">
          <GraduationCap size={16} /> {t('Okul bilgilerin')}
          <span className="locked-info-tag">
            <Lock size={12} /> {t('Değiştirilemez')}
          </span>
        </div>
        <dl>
          <div>
            <dt>{t('Üniversite')}</dt>
            <dd>{user.university?.name || t('Belirtilmemiş')}</dd>
          </div>
          <div>
            <dt>{t('Bölüm')}</dt>
            <dd>{user.department || t('Belirtilmemiş')}</dd>
          </div>
          <div>
            <dt>{t('Sınıf')}</dt>
            <dd>{user.classYear ? (user.classYear >= 5 ? t('Yüksek Lisans / Diğer') : t(`${user.classYear}. Sınıf`)) : t('Belirtilmemiş')}</dd>
          </div>
          <div>
            <dt>{t('Yaş')}</dt>
            <dd>{user.age ?? t('Belirtilmemiş')}</dd>
          </div>
        </dl>
        <p>{t('Bu bilgiler kayıt sırasında belirlenir ve sonradan değiştirilemez. Hatalıysa destek ekibine yaz.')}</p>
      </section>

      <div className="pf-footer-links">
        {user?.isAdmin && (
          <Link to="/admin" className="pf-secondary">
            <ShieldCheck size={16} /> {t('Admin Paneli')}
          </Link>
        )}
        <button type="button" className="pf-secondary" onClick={logout}>
          <LogOut size={16} /> {t('Çıkış Yap')}
        </button>
      </div>

      {/* ---------- Sabit kaydet düğmesi: yalnızca kaydedilecek değişiklik varken ----------
          (her zaman görünmesi küçük telefonlarda ekranın altını boşuna kapatıyordu) */}
      {(dirty || saving) && (
        <div className="pf-savebar">
          <button type="button" className="pf-save" onClick={handleSave} disabled={saving}>
            {saving ? t('Kaydediliyor...') : t('Değişiklikleri kaydet')}
          </button>
        </div>
      )}
    </div>
  );
}
