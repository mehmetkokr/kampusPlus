import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { Users as UsersIcon, MessageCircle as MessageCircleIcon, Archive as ArchiveIcon, GraduationCap as GraduationCapIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader';

export default function ClassmatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/classmates/groups')
      .then((res) => setData(res.data))
      .catch(() => setError('Gruplar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  const missingProfile = user && (!user.department || !user.classYear);

  return (
    <div className="container">
      <PageHeader
        tone="teal"
        icon={GraduationCapIcon}
        eyebrow={user?.department || 'Sınıfım'}
        title="Ders Arkadaşların"
        subtitle="Bölümündeki ve sınıfındaki kişilerle otomatik olarak aynı grup sohbetine dahil olursun."
        actions={<NotificationBell />}
      />

      {loading && <p className="muted center-text">Yükleniyor...</p>}
      {error && <p className="error-text center-text">{error}</p>}

      {!loading && !error && missingProfile && (
        <div className="card center-text">
          <p style={{ marginBottom: 10 }}>
            Ders arkadaşı grubuna otomatik eklenebilmen için profilinde bölüm ve sınıf bilgini tamamlamalısın.
          </p>
          <Link to="/profile" className="btn">
            Profili Tamamla
          </Link>
        </div>
      )}

      {!loading && !error && !missingProfile && data && (
        <>
          {data.current ? (
            <div className="card classmate-current-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/classmates/${data.current.id}`)}>
              <div className="classmate-current-label">
                <span className="live-dot" /> Bu dönemin grubu
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="club-header-icon">
                  <UsersIcon width={20} height={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{data.current.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {data.current.semesterLabel} · {data.current.memberCount} üye
                  </div>
                </div>
                <span className="icon-btn-amber is-primary" aria-hidden="true">
                  <MessageCircleIcon width={18} height={18} />
                </span>
              </div>
            </div>
          ) : (
            <div className="card center-text muted">
              Bu dönem için henüz bir ders arkadaşı grubun oluşmadı. Profilindeki bölüm/sınıf bilgisi kaydedilince otomatik oluşur.
            </div>
          )}

          {data.past.length > 0 && (
            <>
              <div className="section-heading" style={{ marginTop: 20 }}>
                <h3>Geçmiş Dönemler</h3>
                <span className="count">{data.past.length}</span>
              </div>
              {data.past.map((g) => (
                <div
                  key={g.id}
                  className="card"
                  style={{ cursor: 'pointer', opacity: 0.75 }}
                  onClick={() => navigate(`/classmates/${g.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="club-header-icon">
                      <ArchiveIcon width={18} height={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{g.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {g.semesterLabel} · {g.memberCount} üye · Salt-okunur
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
