import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Settings, Link2, Flame, Zap, BadgeCheck, User as UserIcon } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Camera as CameraIcon } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import PageHeader from '../components/PageHeader';
import { INTENT_OPTIONS, parseIntents } from '../constants/intents';

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();

  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [intents, setIntents] = useState(['friendship']);
  const [department, setDepartment] = useState('');
  const [classYear, setClassYear] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [buyingPriority, setBuyingPriority] = useState(false);
  const [reuploading, setReuploading] = useState(false);

  async function handleReuploadDocument(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReuploading(true);
    try {
      const formData = new FormData();
      formData.append('studentDoc', file);
      await api.post('/profile/verification-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser((prev) => ({ ...prev, verificationStatus: 'manual_review', rejectionReason: null }));
      toast.success('Belge yüklendi, incelemeye alındı.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Belge yüklenemedi.');
    } finally {
      setReuploading(false);
    }
  }

  const isBoosted = !!(user?.boostedUntil && new Date(user.boostedUntil).getTime() > Date.now());

  async function handleBoost(planKey) {
    setBoosting(true);
    try {
      const res = await api.post('/monetization/profile/boost', { planKey });
      setUser((prev) => ({ ...prev, boostedUntil: res.data.boostedUntil }));
      toast.success('Profilin boost edildi! Keşfet listelerinde öne çıkacaksın.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Boost başlatılamadı.');
    } finally {
      setBoosting(false);
    }
  }

  async function handlePriorityVerification() {
    setBuyingPriority(true);
    try {
      await api.post('/monetization/verification/priority');
      setUser((prev) => ({ ...prev, verificationPriority: true }));
      toast.success('Öncelikli doğrulama kuyruğuna alındın.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Öncelikli doğrulama başlatılamadı.');
    } finally {
      setBuyingPriority(false);
    }
  }

  function toggleIntent(value) {
    setIntents((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  useEffect(() => {
    if (user) {
      setAge(user.age ?? '');
      setBio(user.bio || '');
      setInterests(user.interests || '');
      setHobbies(user.hobbies || '');
      setInstagramUrl(user.instagramUrl || '');
      setTwitterUrl(user.twitterUrl || '');
      setLinkedinUrl(user.linkedinUrl || '');
      setIntents(parseIntents(user.intent));
      setDepartment(user.department || '');
      setClassYear(user.classYear || '');
      setBirthDate(user.birthDate ? user.birthDate.slice(0, 10) : '');
    }
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/profile/me', {
        age,
        bio,
        interests,
        hobbies,
        instagramUrl,
        twitterUrl,
        linkedinUrl,
        intent: (intents.length ? intents : ['friendship']).join(','),
        department,
        classYear,
        birthDate,
      });
      setUser(res.data.user);
      toast.success('Profil güncellendi.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Güncelleme başarısız oldu.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await api.post('/profile/me/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser((prev) => ({ ...prev, photoUrl: res.data.photoUrl }));
    } catch (err) {
      toast.error('Fotoğraf yüklenemedi.');
    }
  }

  if (!user) return null;

  const statusBadge = {
    pending: { text: 'Doğrulama Bekleniyor', cls: 'badge-pending' },
    manual_review: { text: 'İnceleniyor', cls: 'badge-pending' },
    auto_verified: { text: 'Doğrulandı', cls: 'badge-verified' },
    verified: { text: 'Doğrulandı', cls: 'badge-verified' },
    rejected: { text: 'Reddedildi', cls: 'badge-pending' },
  }[user.verificationStatus];

  return (
    <div className="container">
      <PageHeader
        compact
        tone="amber"
        icon={UserIcon}
        eyebrow="Hesabın"
        title="Profilim"
        actions={
          <>
            <NotificationBell />
            <Link to="/settings" className="icon-btn-amber" aria-label="Ayarlar">
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
          {age ? `, ${age}` : ''}
        </h3>
        <p className="muted profile-sub">{user.university?.name}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          {statusBadge && <span className={`badge ${statusBadge.cls}`}>{statusBadge.text}</span>}
          {user.currentStreak > 0 && (
            <span
              className="badge"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title={`En uzun serin: ${user.longestStreak} gün`}
            >
              <Flame size={14} /> {user.currentStreak} günlük seri
            </span>
          )}
          {isBoosted && (
            <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Zap size={14} /> Boost aktif
            </span>
          )}
          {user.verificationStatus === 'manual_review' && user.verificationPriority && (
            <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <BadgeCheck size={14} /> Öncelikli inceleme
            </span>
          )}
        </div>

        {user.verificationStatus === 'rejected' && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--coral-dim, rgba(233,90,90,0.1))',
              fontSize: 13,
              textAlign: 'left',
            }}
          >
            <strong>Belgen onaylanmadı:</strong> {user.rejectionReason || 'Sebep belirtilmemiş.'}
            <div style={{ marginTop: 8 }}>
              <label className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 12px', display: 'inline-flex', cursor: 'pointer' }}>
                {reuploading ? 'Yükleniyor...' : 'Yeni Belge Yükle'}
                <input type="file" accept="image/*,.pdf" hidden disabled={reuploading} onChange={handleReuploadDocument} />
              </label>
            </div>
          </div>
        )}
        {user.verificationStatus === 'pending' && (
          <div style={{ marginTop: 12 }}>
            <label className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 14px', display: 'inline-flex', cursor: 'pointer' }}>
              {reuploading ? 'Yükleniyor...' : 'Öğrenci Belgesi Yükle'}
              <input type="file" accept="image/*,.pdf" hidden disabled={reuploading} onChange={handleReuploadDocument} />
            </label>
          </div>
        )}

        {/* Grup C: Ek gelir kanalları - profil boost ve öncelikli doğrulama */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          {!isBoosted && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: 13, padding: '8px 14px' }}
              disabled={boosting}
              onClick={() => handleBoost('profile_boost_24h')}
            >
              <Zap size={14} /> {boosting ? 'Başlatılıyor...' : 'Profili Boost\'la (24 sa · ₺24,90)'}
            </button>
          )}
          {user.verificationStatus === 'manual_review' && !user.verificationPriority && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: 13, padding: '8px 14px' }}
              disabled={buyingPriority}
              onClick={handlePriorityVerification}
            >
              <BadgeCheck size={14} /> {buyingPriority ? 'Başlatılıyor...' : 'Öncelikli Doğrulama (₺19,90)'}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSave}>
          <label>Ne arıyorsun? (en az bir tane seç)</label>
          <div className="intent-select-grid">
            {INTENT_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={`intent-toggle ${intents.includes(opt.value) ? 'active' : ''}`}
                onClick={() => toggleIntent(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label>Yaş</label>
          <input
            type="number"
            min={16}
            max={100}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="örn. 21"
          />

          <label>Bölüm</label>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} />

          <label>Sınıf</label>
          <select value={classYear} onChange={(e) => setClassYear(e.target.value)}>
            <option value="">Seçiniz...</option>
            <option value="1">1. Sınıf</option>
            <option value="2">2. Sınıf</option>
            <option value="3">3. Sınıf</option>
            <option value="4">4. Sınıf</option>
            <option value="5">Yüksek Lisans / Diğer</option>
          </select>

          <label>Doğum Tarihi (isteğe bağlı)</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 12 }}>
            Doğum gününde sana özel bir kutlama bildirimi göndeririz. 🎉
          </p>

          <label>Hakkımda</label>
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />

          <label>İlgi Alanları (virgülle ayır)</label>
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="müzik, sinema, basketbol"
          />

          <label>Hobiler (virgülle ayır)</label>
          <input
            value={hobbies}
            onChange={(e) => setHobbies(e.target.value)}
            placeholder="fotoğrafçılık, kamp, satranç"
          />

          <label>Sosyal Medya Bağlantıları (isteğe bağlı)</label>
          <div className="social-links-row" style={{ marginBottom: 8 }}>
            <div>
              <input
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="Instagram kullanıcı adı"
              />
            </div>
          </div>
          <div className="social-links-row" style={{ marginBottom: 8 }}>
            <div>
              <input
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                placeholder="Twitter / X kullanıcı adı"
              />
            </div>
          </div>
          <div className="social-links-row" style={{ marginBottom: 14 }}>
            <div>
              <input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="LinkedIn profil bağlantısı"
              />
            </div>
          </div>

          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      </div>

      {(user.instagramUrl || user.twitterUrl || user.linkedinUrl) && (
        <div className="card" style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
          {user.instagramUrl && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Link2 size={16} /> Instagram
            </span>
          )}
          {user.twitterUrl && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Link2 size={16} /> Twitter/X
            </span>
          )}
          {user.linkedinUrl && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Link2 size={16} /> LinkedIn
            </span>
          )}
        </div>
      )}

      {user?.isAdmin && (
        <Link to="/admin" className="btn btn-secondary" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
          <ShieldCheck size={16} /> Admin Paneli
        </Link>
      )}

      <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={logout}>
        Çıkış Yap
      </button>
    </div>
  );
}
