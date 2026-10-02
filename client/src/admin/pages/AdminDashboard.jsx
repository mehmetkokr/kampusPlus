import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, MessageSquare, GraduationCap, Flag, ShieldAlert, Activity, CalendarDays, Crown, TrendingUp } from 'lucide-react';
import adminApi from '../adminApi';

function StatCard({ icon: Icon, value, label }) {
  return (
    <div className="admin-stat-card">
      <Icon size={20} color="var(--amber-soft)" />
      <div className="admin-stat-value">{value ?? '—'}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

function MiniStat({ icon: Icon, color, value, label, to }) {
  const content = (
    <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 0 }}>
      <Icon size={22} color={color} />
      <div>
        <div className="admin-stat-value" style={{ fontSize: '1.4rem' }}>{value ?? '—'}</div>
        <div className="admin-stat-label">{label}</div>
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{content}</Link> : content;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.getStats(), adminApi.getEngagement(), adminApi.getCampusStats()])
      .then(([statsRes, engagementRes, campusesRes]) => {
        setStats(statsRes.data);
        setEngagement(engagementRes.data);
        setCampuses(campusesRes.data);
      })
      .catch((err) => {
        console.error('İstatistikler alınamadı:', err);
        setError('İstatistikler yüklenirken bir hata oluştu.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="admin-page-title">Dashboard</h1>
      <p className="admin-page-sub">Platformun genel durumuna hızlı bir bakış.</p>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-loading">Yükleniyor...</div>
      ) : (
        <>
          <div className="admin-stat-grid">
            <StatCard icon={Users} value={stats?.totalUsers} label="Toplam Kullanıcı" />
            <StatCard icon={FileText} value={stats?.totalPosts} label="Toplam İlan" />
            <StatCard icon={MessageSquare} value={stats?.totalMessages} label="Toplam Mesaj" />
            <StatCard icon={GraduationCap} value={stats?.totalUniversities} label="Toplam Üniversite" />
          </div>

          <div className="admin-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <MiniStat icon={Flag} color="var(--coral)" value={stats?.pendingReports ?? 0} label="Bekleyen şikayet" to="/admin/reports" />
            <MiniStat
              icon={ShieldAlert}
              color="var(--sky)"
              value={stats?.pendingVerifications ?? 0}
              label="Onay/Red kuyruğunda bekleyen"
              to="/admin/verification-queue"
            />
          </div>

          {/* Etkileşim & Dönüşüm */}
          <h2 className="admin-section-title" style={{ marginTop: 28 }}>Etkileşim &amp; Dönüşüm</h2>
          <div className="admin-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <MiniStat icon={Activity} color="var(--teal, #2dd4bf)" value={engagement?.dau} label="Günlük Aktif Kullanıcı (DAU)" />
            <MiniStat icon={CalendarDays} color="var(--teal, #2dd4bf)" value={engagement?.mau} label="Aylık Aktif Kullanıcı (MAU)" />
            <MiniStat
              icon={Crown}
              color="var(--amber-soft)"
              value={engagement ? `%${engagement.premiumConversionRate}` : '—'}
              label={`Premium Dönüşüm Oranı${engagement ? ` (${engagement.everPremiumCount}/${engagement.totalUsers})` : ''}`}
            />
            <MiniStat
              icon={TrendingUp}
              color="var(--amber-soft)"
              value={engagement ? `%${engagement.activePremiumRate}` : '—'}
              label={`Şu An Aktif Premium (${engagement?.activePremiumCount ?? 0} kişi)`}
            />
          </div>

          {/* En Aktif Kampüsler */}
          <h2 className="admin-section-title" style={{ marginTop: 28 }}>En Aktif Kampüsler</h2>
          <div className="admin-card">
            {campuses.length === 0 ? (
              <div className="admin-empty">Henüz veri yok.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Üniversite</th>
                      <th>Kullanıcı</th>
                      <th>Eşleşme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campuses.slice(0, 10).map((c, i) => (
                      <tr key={c.id}>
                        <td>{i + 1}</td>
                        <td>{c.name}</td>
                        <td>{c.userCount}</td>
                        <td>{c.matchCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
