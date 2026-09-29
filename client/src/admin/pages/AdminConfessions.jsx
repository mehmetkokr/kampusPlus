import React, { useEffect, useState, useCallback } from 'react';
import adminApi from '../adminApi';

const STATUS_LABELS = {
  visible: { label: 'Görünür', cls: 'admin-badge-teal' },
  hidden_auto: { label: 'Otomatik Gizlendi', cls: 'admin-badge-amber' },
  hidden_admin: { label: 'Admin Gizledi', cls: 'admin-badge-amber' },
  removed: { label: 'Kaldırıldı', cls: 'admin-badge-muted' },
};

export default function AdminConfessions() {
  const [confessions, setConfessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('hidden_auto');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 20;

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getConfessions({ status, page, pageSize })
      .then((res) => {
        setConfessions(res.data.confessions);
        setTotal(res.data.total);
      })
      .catch((err) => {
        console.error('İtiraflar alınamadı:', err);
        setError('İtiraflar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id, newStatus) {
    try {
      await adminApi.updateConfession(id, { status: newStatus });
      load();
    } catch (err) {
      alert('İtiraf güncellenemedi.');
    }
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div>
      <h1 className="admin-page-title">İtiraf Kutusu Moderasyonu</h1>
      <p className="admin-page-sub">
        Anonim itiraf kutusundaki içerikler. Şikayet eşiği aşılan itiraflar otomatik gizlenir
        (varsayılan görünüm: "Otomatik Gizlendi"). Yazar kimliği yalnızca burada, kötüye kullanım
        soruşturması için gösterilir.
      </p>

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
        ) : confessions.length === 0 ? (
          <div className="admin-empty">Bu durumda itiraf yok.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>İçerik</th>
                  <th>Yazar (dahili)</th>
                  <th>Üniversite</th>
                  <th>Şikayet Sayısı</th>
                  <th>Tepki</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {confessions.map((c) => (
                  <tr key={c.id}>
                    <td style={{ maxWidth: 280 }}>{c.content}</td>
                    <td>
                      {c.author?.fullName}
                      {c.author?.isBanned && <span className="admin-badge admin-badge-muted" style={{ marginLeft: 6 }}>Banlı</span>}
                    </td>
                    <td>{c.university?.name}</td>
                    <td>{c.reportCount}</td>
                    <td>{c._count?.reactions ?? 0}</td>
                    <td>
                      <span className={`admin-badge ${STATUS_LABELS[c.status]?.cls || 'admin-badge-muted'}`}>
                        {STATUS_LABELS[c.status]?.label || c.status}
                      </span>
                    </td>
                    <td>{new Date(c.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td>
                      <select
                        className="admin-select"
                        value={c.status}
                        onChange={(e) => updateStatus(c.id, e.target.value)}
                      >
                        <option value="visible">Görünür Yap</option>
                        <option value="hidden_admin">Gizle</option>
                        <option value="removed">Kaldır</option>
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
