import React, { useEffect, useState } from 'react';
import { VerifiedBadge } from '@/components/ui/icon-badge';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Flag, MessageCircle, ShieldOff, UserCheck, UserPlus } from '../components/icons';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useToast } from '../context/ToastContext';
import ReportModal from '../components/ReportModal';
import { SocialBadge } from '../components/SocialGlyphs';
import { socialHandle, socialUrl } from '../utils/social';
import { INTENT_LABEL, INTENT_CHIP_CLASS, parseIntents } from '../constants/intents';
import { useConfirm } from '../context/ConfirmContext';
import { useI18n } from '../i18n';
import '../styles/profile.css';

const initialsOf = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('tr');

const tagsOf = (text) =>
  (text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Başka bir öğrencinin profili: Profilim sayfasıyla aynı kart düzeni.
// Eşleşilmişse birincil eylem "Mesaj gönder", değilse "Takip et".
// Şikâyet ve engelleme altta, daha sakin düğmelerde.
export default function UserProfileViewPage() {
  const { t } = useI18n();
  const { userId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .get(`/users/${userId}`)
      .then((res) => {
        if (!alive) return;
        setProfile(res.data);
        setFollowing(res.data.isFollowing);
      })
      .catch((err) => alive && setError(err.response?.data?.error || t('Profil yüklenemedi.')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId, t]);

  async function toggleFollow() {
    const next = !following;
    setFollowing(next);
    setProfile((p) => ({ ...p, followerCount: Math.max(0, p.followerCount + (next ? 1 : -1)) }));
    try {
      await api.post(`/users/${userId}/${next ? 'follow' : 'unfollow'}`);
    } catch (err) {
      setFollowing(!next);
      setProfile((p) => ({ ...p, followerCount: Math.max(0, p.followerCount + (next ? -1 : 1)) }));
      toast.error(err.response?.data?.error || t('İşlem başarısız oldu.'));
    }
  }

  async function handleBlock() {
    if (!(await confirm(t('{name} kullanıcısını engellemek istediğine emin misin?', { name: profile.fullName })))) return;
    try {
      await api.post(`/users/${userId}/block`);
      toast.success(t('Kullanıcı engellendi.'));
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.error || t('Engellenemedi.'));
    }
  }

  const interests = tagsOf(profile?.interests);
  const hobbies = tagsOf(profile?.hobbies);
  const instagram = socialUrl('instagram', profile?.instagramUrl);
  const x = socialUrl('x', profile?.twitterUrl);

  return (
    <div className="container pf-page uv-page">
      <div className="pf-backdrop" aria-hidden="true">
        {profile?.photoUrl && <img src={`${API_BASE_URL}${profile.photoUrl}`} alt="" />}
      </div>
      <header className="uv-header">
        <button type="button" className="pf-icon-btn" onClick={() => navigate(-1)} aria-label={t('Geri')}>
          <ArrowLeft size={22} />
        </button>
        <h1>{t('Profil')}</h1>
      </header>

      {loading && <p className="muted center-text">{t('Yükleniyor...')}</p>}

      {!loading && error && (
        <div className="pf-card center-text">
          <p className="muted">{error}</p>
        </div>
      )}

      {!loading && profile && (
        <>
          <section className="pf-card pf-hero">
            <div className="uv-avatar">
              {profile.photoUrl ? (
                <img src={`${API_BASE_URL}${profile.photoUrl}`} alt={profile.fullName} />
              ) : (
                <span className="uv-initials" aria-hidden="true">
                  {initialsOf(profile.fullName)}
                </span>
              )}
            </div>
            <h2 className="pf-name">
              {profile.fullName}
              {profile.age ? `, ${profile.age}` : ''}
              {profile.isStudentVerified && <VerifiedBadge size="lg" className="ml-1.5" label={t('Onaylı öğrenci')} />}
            </h2>
            <p className="pf-uni">{profile.university?.name}</p>
            {profile.department && (
              <p className="uv-dept">
                {profile.department}
                {profile.classYear ? ` · ${t(`${profile.classYear}. Sınıf`)}` : ''}
              </p>
            )}

            <dl className="uv-stats">
              <div>
                <dt>{t('takipçi')}</dt>
                <dd>{profile.followerCount}</dd>
              </div>
              <div>
                <dt>{t('takip')}</dt>
                <dd>{profile.followingCount}</dd>
              </div>
            </dl>

            <div className="uv-actions">
              {profile.matchId && (
                <button type="button" className="uv-btn uv-btn-primary" onClick={() => navigate(`/chat/${profile.matchId}`)}>
                  <MessageCircle size={18} /> {t('Mesaj gönder')}
                </button>
              )}
              <button
                type="button"
                className={`uv-btn ${profile.matchId ? 'uv-btn-secondary' : 'uv-btn-primary'} ${following ? 'is-following' : ''}`}
                onClick={toggleFollow}
                aria-pressed={following}
              >
                {following ? <UserCheck size={18} /> : <UserPlus size={18} />}
                {following ? t('Takip Ediliyor') : t('Takip Et')}
              </button>
            </div>
          </section>

          {profile.photos?.length > 1 && (
            <div className="profile-photo-strip" aria-label={t('Fotoğraflar')}>
              {profile.photos.map((ph, i) => (
                <img key={ph.id} src={`${API_BASE_URL}${ph.url}`} alt={t('{name}, fotoğraf {n}', { name: profile.fullName, n: i + 1 })} loading="lazy" />
              ))}
            </div>
          )}

          {(profile.intent || profile.bio) && (
            <section className="pf-card">
              {profile.intent && (
                <div className="uv-chips">
                  {parseIntents(profile.intent).map((v) => (
                    <span key={v} className={`intent-chip ${INTENT_CHIP_CLASS[v] || ''}`}>
                      {t(INTENT_LABEL[v] || v)}
                    </span>
                  ))}
                </div>
              )}
              {profile.bio && <p className="uv-bio">{profile.bio}</p>}
            </section>
          )}

          {(interests.length > 0 || hobbies.length > 0) && (
            <section className="pf-card">
              {interests.length > 0 && (
                <>
                  <h3 className="uv-label">{t('İlgi Alanları')}</h3>
                  <div className="uv-chips">
                    {interests.map((v) => (
                      <span key={v} className="uv-tag">
                        {t(v)}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {hobbies.length > 0 && (
                <>
                  <h3 className="uv-label">{t('Hobiler')}</h3>
                  <div className="uv-chips">
                    {hobbies.map((v) => (
                      <span key={v} className="uv-tag">
                        {t(v)}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {(instagram || x) && (
            <section className="pf-card profile-social-links">
              {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer nofollow" className="profile-social-link">
                  <SocialBadge network="instagram" size={30} />
                  <span>@{socialHandle('instagram', profile.instagramUrl)}</span>
                </a>
              )}
              {x && (
                <a href={x} target="_blank" rel="noopener noreferrer nofollow" className="profile-social-link">
                  <SocialBadge network="x" size={30} />
                  <span>@{socialHandle('x', profile.twitterUrl)}</span>
                </a>
              )}
            </section>
          )}

          <div className="uv-safety">
            <button type="button" onClick={() => setReporting(true)}>
              <Flag size={16} /> {t('Şikayet Et')}
            </button>
            <button type="button" className="is-danger" onClick={handleBlock}>
              <ShieldOff size={16} /> {t('Engelle')}
            </button>
          </div>
        </>
      )}

      {reporting && profile && <ReportModal targetType="user" targetId={profile.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
