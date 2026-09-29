import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Flag, ShieldOff } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useToast } from '../context/ToastContext';
import ReportModal from '../components/ReportModal';
import { INTENT_LABEL, INTENT_CHIP_CLASS, parseIntents } from '../constants/intents';
import { UserPlus as UserPlusIcon, UserCheck as UserCheckIcon } from 'lucide-react';

export default function UserProfileViewPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [following, setFollowing] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/users/${userId}`);
      setProfile(res.data);
      setFollowing(res.data.isFollowing);
    } catch (err) {
      setError(err.response?.data?.error || 'Profil yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function toggleFollow() {
    const next = !following;
    setFollowing(next);
    try {
      await api.post(`/users/${userId}/${next ? 'follow' : 'unfollow'}`);
    } catch (err) {
      setFollowing(!next);
      toast.error(err.response?.data?.error || 'İşlem başarısız oldu.');
    }
  }

  async function handleBlock() {
    if (!window.confirm(`${profile.fullName} kullanıcısını engellemek istediğine emin misin?`)) return;
    try {
      await api.post(`/users/${userId}/block`);
      toast.success('Kullanıcı engellendi.');
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Engellenemedi.');
    }
  }

  return (
    <div className="container">
      <div className="page-title-row">
        <button className="chat-back" onClick={() => navigate(-1)} aria-label="Geri">
          <ArrowLeft size={18} />
        </button>
        <h2 className="page-title">Profil</h2>
      </div>

      {loading && <p className="muted center-text">Yükleniyor...</p>}

      {!loading && error && (
        <div className="card center-text">
          <p className="muted">{error}</p>
        </div>
      )}

      {!loading && profile && (
        <>
          <div className="card profile-hero">
            <img
              className="profile-avatar"
              src={profile.photoUrl ? `${API_BASE_URL}${profile.photoUrl}` : undefined}
              alt={profile.fullName}
            />
            <h3 className="profile-name">
              {profile.fullName}
              {profile.age ? `, ${profile.age}` : ''}
            </h3>
            <p className="muted profile-sub">{profile.university?.name}</p>
            <p className="muted profile-sub">
              {profile.followerCount} takipçi · {profile.followingCount} takip
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <button
                className={`follow-toggle-btn ${following ? 'following' : ''}`}
                onClick={toggleFollow}
                style={{ padding: '8px 16px' }}
              >
                {following ? <UserCheckIcon width={14} height={14} /> : <UserPlusIcon width={14} height={14} />}
                {following ? 'Takip Ediliyor' : 'Takip Et'}
              </button>
              <button className="btn-secondary" style={{ padding: '8px 14px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setReporting(true)}>
                <Flag size={14} /> Şikayet Et
              </button>
              <button className="btn-secondary" style={{ padding: '8px 14px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--coral)' }} onClick={handleBlock}>
                <ShieldOff size={14} /> Engelle
              </button>
            </div>
          </div>

          {(profile.intent || profile.department || profile.bio) && (
            <div className="card">
              {profile.intent && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {parseIntents(profile.intent).map((v) => (
                    <span key={v} className={`intent-chip ${INTENT_CHIP_CLASS[v] || ''}`}>
                      {INTENT_LABEL[v] || v}
                    </span>
                  ))}
                </div>
              )}
              {profile.department && (
                <p className="muted" style={{ marginBottom: 6 }}>
                  {profile.department}
                  {profile.classYear ? ` · ${profile.classYear}. Sınıf` : ''}
                </p>
              )}
              {profile.bio && <p>{profile.bio}</p>}
            </div>
          )}

          {(profile.interests || profile.hobbies) && (
            <div className="card">
              {profile.interests && (
                <>
                  <label>İlgi Alanları</label>
                  <p style={{ marginBottom: 12 }}>{profile.interests}</p>
                </>
              )}
              {profile.hobbies && (
                <>
                  <label>Hobiler</label>
                  <p>{profile.hobbies}</p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {reporting && profile && (
        <ReportModal targetType="user" targetId={profile.id} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}
