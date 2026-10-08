import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Settings, Link2, BadgeCheck, User as UserIcon, Lock, GraduationCap } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Camera as CameraIcon } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import PageHeader from '../components/PageHeader';
import PhotoGallery from '../components/PhotoGallery';
import StudentBadgeCard from '../components/StudentBadgeCard';
import ProfileCompletion from '../components/ProfileCompletion';
import { INTENT_OPTIONS, parseIntents } from '../constants/intents';
import { INTEREST_OPTIONS, HOBBY_OPTIONS, parseTags } from '../constants/tags';
import TagPicker from '../components/TagPicker';
import { useI18n } from '../i18n';
import { compressImage } from '../utils/image';
import { usePhotoEditor } from '../context/PhotoEditorContext';
import BirthDateInput from '../components/BirthDateInput';
import ThemeToggle from '../components/ThemeToggle';

export default function ProfilePage() {
  const { t } = useI18n();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const editPhoto = usePhotoEditor();

  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [intents, setIntents] = useState(['friendship']);
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  function toggleIntent(value) {
    setIntents((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  useEffect(() => {
    if (user) {
      setBio(user.bio || '');
      setInterests(user.interests || '');
      setHobbies(user.hobbies || '');
      setInstagramUrl(user.instagramUrl || '');
      setTwitterUrl(user.twitterUrl || '');
      setIntents(parseIntents(user.intent));
      setBirthDate('');
    }
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/profile/me', {
        bio,
        interests,
        hobbies,
        instagramUrl,
        twitterUrl,
        intent: (intents.length ? intents : ['friendship']).join(','),
        // Doğum tarihi yalnızca daha önce hiç girilmemişse bir kez gönderilir
        ...(!user.birthDate && birthDate ? { birthDate } : {}),
      });
      setUser((prev) => ({ ...prev, ...res.data.user }));
      toast.success('Profil güncellendi.');
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
      const res = await api.post('/profile/me/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser((prev) => ({ ...prev, photoUrl: res.data.photoUrl, photos: res.data.photos || prev.photos }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Fotoğraf yüklenemedi.');
    } finally {
      e.target.value = '';
    }
  }

  if (!user) return null;

  const isStudentVerified = user.studentDocStatus === 'approved';
  // Hesap erişimi (e-posta) ile onaylı öğrenci rozeti ayrı gösterilir
  const statusBadge = isStudentVerified
    ? { text: 'Onaylı öğrenci', cls: 'badge-verified' }
    : {
        pending: { text: 'Doğrulama bekleniyor', cls: 'badge-pending' },
        manual_review: { text: 'Belge inceleniyor', cls: 'badge-pending' },
        auto_verified: { text: 'E-posta doğrulandı', cls: 'badge-neutral' },
        verified: { text: 'E-posta doğrulandı', cls: 'badge-neutral' },
        rejected: { text: 'Belge reddedildi', cls: 'badge-pending' },
      }[user.verificationStatus];

  return (
    <div className="container">
      <PageHeader
        compact
        tone="amber"
        icon={UserIcon}
        eyebrow={t("Hesabın")}
        title={t("Profilim")}
        actions={
          <>
            <ThemeToggle className="icon-btn-amber" />
            <NotificationBell />
            <Link to="/settings" className="icon-btn-amber" aria-label={t("Ayarlar")}>
              <Settings size={18} />
            </Link>
          </>
        }
      />

      <div className="card profile-hero">
        <div className="profile-avatar-wrap">
          <img
            className="profile-avatar"
            src={user.photoUrl ? `${API_BASE_URL}${user.photoUrl}` : undefined}
            alt={user.fullName}
          />
          <label className="profile-photo-edit">
            <CameraIcon width={16} height={16} />
            <input type="file" accept="image/*" onChange={handlePhotoUpload} />
          </label>
        </div>
        <h3 className="profile-name">
          {user.fullName}
          {user.age ? `, ${user.age}` : ''}
          {isStudentVerified && <BadgeCheck size={18} className="name-verified" aria-label={t("Onaylı öğrenci")} />}
        </h3>
        <p className="muted profile-sub">{user.university?.name}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          {statusBadge && <span className={`badge ${statusBadge.cls}`}>{t(statusBadge.text)}</span>}
        </div>

      </div>

      <ProfileCompletion user={user} />

      <StudentBadgeCard user={user} setUser={setUser} variant="profile" />

      <div className="card" id="profile-gallery" tabIndex={-1}>
        <PhotoGallery
          photos={user.photos || []}
          onChange={(data) => setUser((prev) => ({ ...prev, photos: data.photos, photoUrl: data.photoUrl }))}
        />
      </div>

      <div className="card">
        <form onSubmit={handleSave}>
          <label>{t("Ne arıyorsun? (en az bir tane seç)")}</label>
          <div className="intent-select-grid">
            {INTENT_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={`intent-toggle ${intents.includes(opt.value) ? 'active' : ''}`}
                onClick={() => toggleIntent(opt.value)}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>
          <p className="field-hint intent-dating-note">{t("Flört ve Uzun Süreli İlişki seçimini yalnızca bunları seçen öğrenciler görür.")}</p>

          <div className="locked-info" aria-label={t("Okul bilgilerin")}>
            <div className="locked-info-head">
              <GraduationCap size={16} /> {t("Okul bilgilerin")}
              <span className="locked-info-tag">
                <Lock size={12} /> {t("Değiştirilemez")}
              </span>
            </div>
            <dl>
              <div>
                <dt>{t("Üniversite")}</dt>
                <dd>{user.university?.name || t('Belirtilmemiş')}</dd>
              </div>
              <div>
                <dt>{t("Bölüm")}</dt>
                <dd>{user.department || t('Belirtilmemiş')}</dd>
              </div>
              <div>
                <dt>{t("Sınıf")}</dt>
                <dd>{user.classYear ? (user.classYear >= 5 ? t("Yüksek Lisans / Diğer") : t(`${user.classYear}. Sınıf`)) : t('Belirtilmemiş')}</dd>
              </div>
              <div>
                <dt>{t("Yaş")}</dt>
                <dd>{user.age ?? t('Belirtilmemiş')}</dd>
              </div>
            </dl>
            <p>{t("Bu bilgiler kayıt sırasında belirlenir ve sonradan değiştirilemez. Hatalıysa destek ekibine yaz.")}</p>
          </div>

          {!user.birthDate && (
            <>
              <label htmlFor="profile-birth">{t("Doğum Tarihi")}</label>
              <BirthDateInput id="profile-birth" value={birthDate} onChange={setBirthDate} />
              <p className="field-hint">{t("Yaşın buradan hesaplanır. Bir kez kaydedildikten sonra değiştirilemez.")}</p>
            </>
          )}

          <label htmlFor="profile-bio">{t("Hakkımda")}</label>
          <textarea id="profile-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />

          <TagPicker
            id="profile-interests"
            label={t('İlgi Alanları')}
            options={INTEREST_OPTIONS}
            value={parseTags(interests)}
            onChange={(tags) => setInterests(tags.join(', '))}
          />

          <TagPicker
            id="profile-hobbies"
            label={t('Hobiler')}
            options={HOBBY_OPTIONS}
            value={parseTags(hobbies)}
            onChange={(tags) => setHobbies(tags.join(', '))}
          />

          <label>{t("Sosyal Medya Bağlantıları (isteğe bağlı)")}</label>
          <div className="social-links-row" style={{ marginBottom: 8 }}>
            <div>
              <input
                id="profile-social"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder={t("Instagram kullanıcı adı")}
              />
            </div>
          </div>
          <div className="social-links-row" style={{ marginBottom: 14 }}>
            <div>
              <input
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                placeholder={t("Twitter / X kullanıcı adı")}
              />
            </div>
          </div>

          <button className="btn" type="submit" disabled={saving}>
            {saving ? t("Kaydediliyor...") : t("Kaydet")}
          </button>
        </form>
      </div>

      {(user.instagramUrl || user.twitterUrl) && (
        <div className="card" style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
          {user.instagramUrl && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Link2 size={16} /> {t("Instagram")}
            </span>
          )}
          {user.twitterUrl && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Link2 size={16} /> {t("Twitter/X")}
            </span>
          )}
        </div>
      )}

      {user?.isAdmin && (
        <Link to="/admin" className="btn btn-secondary" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
          <ShieldCheck size={16} /> {t("Admin Paneli")}
        </Link>
      )}

      <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={logout}>
        {t("Çıkış Yap")}
      </button>
    </div>
  );
}
