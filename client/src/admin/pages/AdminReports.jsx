import React, { useEffect, useState, useCallback } from 'react';
import adminApi from '../adminApi';

const STATUS_LABELS = {
  pending: { label: 'Bekliyor', cls: 'admin-badge-sky' },
  reviewed: { label: 'İncelendi', cls: 'admin-badge-amber' },
  resolved: { label: 'Çözüldü', cls: 'admin-badge-teal' },
  dismissed: { label: 'Reddedildi', cls: 'admin-badge-muted' },
};

const TARGET_TYPE_LABELS = {
  user: 'Kullanıcı',
  post: 'İlan',
  comment: 'Yorum',
  message: 'Mesaj',
  club: 'Kulüp',
  club_message: 'Kulüp Mesajı',
  group_message: 'Grup Mesajı',
  confession: 'İtiraf',
};

const REASON_LABELS = {
  spam: 'Spam',
  harassment: 'Taciz / Zorbalık',
  inappropriate_content: 'Uygunsuz İçerik',
  fake_profile: 'Sahte Profil',
  other: 'Diğer',
};

function targetSummary(report) {
  if (!report.target) return <span className="muted">İçerik silinmiş</span>;
  if (report.targetType === 'user') return `${report.target.fullName} (${report.target.email})`;
  if (report.targetType === 'post') return report.target.caption || '(açıklamasız ilan)';
  if (report.targetType === 'confession') return report.target.content || '(itiraf)';
  return report.target.content || '(medya mesajı)';
}

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 20;

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getReports({ status, page, pageSize })
      .then((res) => {
        setReports(res.data.reports);
        setTotal(res.data.total);
      })
      .catch((err) => {
        console.error('Şikayetler alınamadı:', err);
        setError('Şikayetler yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id, newStatus) {
    try {
      await adminApi.updateReport(id, { status: newStatus });
      load();
    } catch (err) {
      alert('Şikayet güncellenemedi.');
    }
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div>
      <h1 className="admin-page-title">Şikayetler</h1>
      <p className="admin-page-sub">Kullanıcıların bildirdiği kullanıcı/içerik şikayetleri.</p>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <div className="admin-toolbar">
          <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tüm durumlar</option>
            {Object.entries(STATUS_LABELS).map(([key, v]) => (
              <option key={key} value={key}>{v.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="admin-loading">Yükleniyor...</div>
        ) : reports.length === 0 ? (
          <div className="admin-empty">Bu durumda şikayet yok.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Şikayet Eden</th>
                  <th>Tür</th>
                  <th>Hedef</th>
                  <th>Sebep</th>
                  <th>Açıklama</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td>{r.reporter?.fullName}</td>
                    <td>{TARGET_TYPE_LABELS[r.targetType] || r.targetType}</td>
                    <td style={{ maxWidth: 200 }}>{targetSummary(r)}</td>
                    <td>{REASON_LABELS[r.reason] || r.reason}</td>
                    <td style={{ maxWidth: 200 }}>{r.description || <span className="muted">—</span>}</td>
                    <td>
                      <span className={`admin-badge ${STATUS_LABELS[r.status]?.cls || 'admin-badge-muted'}`}>
                        {STATUS_LABELS[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td>{new Date(r.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td>
                      <select
                        className="admin-select"
                        value={r.status}
                        onChange={(e) => updateStatus(r.id, e.target.value)}
                      >
                        {Object.entries(STATUS_LABELS).map(([key, v]) => (
                          <option key={key} value={key}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-pagination">
          <span>Sayfa {page} / {totalPages}</span>
          <div className="admin-row-actions">
            <button className="admin-btn admin-btn-outline admin-btn-small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Önceki</button>
            <button className="admin-btn admin-btn-outline admin-btn-small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sonraki</button>
          </div>
        </div>
      </div>
    </div>
  );
}
