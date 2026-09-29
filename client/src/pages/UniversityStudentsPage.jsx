import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useToast } from '../context/ToastContext';
import PaywallModal from '../components/PaywallModal';

export default function UniversityStudentsPage() {
  const { universityId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [university, setUniversity] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(null); // { university, lockedCount } | null
  const [showPaywall, setShowPaywall] = useState(false);

  async function load() {
    setLoading(true);
    setLocked(null);
    try {
      const res = await api.get(`/universities/${universityId}/students`);
      setUniversity(res.data.university);
      setStudents(res.data.students);
    } catch (err) {
      if (err.response?.status === 403 && err.response.data?.error === 'premium_required') {
        setUniversity(err.response.data.university);
        setLocked(err.response.data);
      } else {
        toast.error(err.response?.data?.error || 'Öğrenciler yüklenemedi.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universityId]);

  return (
    <div className="container">
      <div className="page-title-row">
        <button className="chat-back" onClick={() => navigate(-1)} aria-label="Geri">
          <ArrowLeft size={18} />
        </button>
        <h2 className="page-title">{university?.name || 'Üniversite'}</h2>
      </div>

      {loading && <p className="muted center-text">Yükleniyor...</p>}

      {!loading && locked && (
        <div className="other-uni-locked-banner">
          <div className="other-uni-locked-banner-icon">
            <Lock size={18} />
          </div>
          <h4>{locked.lockedCount} öğrenci seni bekliyor</h4>
          <p>{locked.message}</p>
          <button className="btn-premium-cta" onClick={() => setShowPaywall(true)}>
            👑 Premium'a Geç
          </button>
        </div>
      )}

      {!loading && !locked && students.length === 0 && (
        <div className="card empty-state">
          <div className="empty-icon">🏫</div>
          <p className="muted">Bu üniversiteden henüz görüntülenecek öğrenci yok.</p>
        </div>
      )}

      {!loading &&
        !locked &&
        students.map((s) => (
          <div
            key={s.id}
            className="suggest-card"
            onClick={() => navigate(`/users/${s.id}`)}
            style={{ cursor: 'pointer' }}
          >
            <div className="suggest-card-top">
              <img
                className="suggest-card-avatar"
                src={s.photoUrl ? `${API_BASE_URL}${s.photoUrl}` : undefined}
                alt={s.fullName}
              />
              <div className="suggest-card-info">
                <div className="suggest-card-name">{s.fullName}</div>
                {s.department && (
                  <div className="suggest-card-department">
                    {s.department}
                    {s.classYear ? ` · ${s.classYear}. Sınıf` : ''}
                  </div>
                )}
                <div className="suggest-card-mutual">{s.followerCount} takipçi</div>
              </div>
            </div>
          </div>
        ))}

      {showPaywall && (
        <PaywallModal
          contextText={locked?.message}
          onClose={() => setShowPaywall(false)}
          onUpgraded={load}
        />
      )}
    </div>
  );
}
