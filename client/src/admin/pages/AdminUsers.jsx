import React, { useEffect, useState, useCallback } from 'react';
import { Search, ShieldCheck, ShieldX, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import adminApi from '../adminApi';

const STATUS_LABELS = {
  pending: { label: 'Bekliyor', cls: 'admin-badge-muted' },
  auto_verified: { label: 'Otomatik Doğrulandı', cls: 'admin-badge-teal' },
  manual_review: { label: 'İncelemede', cls: 'admin-badge-sky' },
  verified: { label: 'Doğrulandı', cls: 'admin-badge-teal' },
  rejected: { label: 'Reddedildi', cls: 'admin-badge-coral' },
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 20;

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getUsers({ search, status, page, pageSize })
      .then((res) => {
        setUsers(res.data.users);
        setTotal(res.data.total);
      })
      .catch((err) => {
        console.error('Kullanıcılar alınamadı:', err);
        setError('Kullanıcılar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [search, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function setVerification(id, verificationStatus) {
    let rejectionReason;
    if (verificationStatus === 'rejected') {
      rejectionReason = window.prompt('Öğrenciye e-posta ile gönderilecek kısa red gerekçesi:');
      if (!rejectionReason || !rejectionReason.trim()) return; // vazgeçildi
    }
    try {
      await adminApi.updateUser(id, { verificationStatus, ...(rejectionReason ? { rejectionReason } : {}) });
      load();
    } catch (err) {
      console.error('Durum güncellenemedi:', err);
      alert(err.response?.data?.error || 'Durum güncellenemedi.');
    }
  }

  async function toggleBan(id, isBanned) {
    try {
      await adminApi.updateUser(id, { isBanned: !isBanned });
      load();
    } catch (err) {
      console.error('Ban durumu güncellenemedi:', err);
      alert('İşlem başarısız.');
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`"${name}" adlı kullanıcıyı kalıcı olarak silmek istediğine emin misin?`)) return;
    try {
      await adminApi.deleteUser(id);
      load();
    } catch (err) {
      console.error('Kullanıcı silinemedi:', err);
      alert(err.response?.data?.error || 'Kullanıcı silinemedi.');
    }
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div>
      <h1 className="admin-page-title">Kullanıcılar</h1>
      <p className="admin-page-sub">Toplam {total} kullanıcı.</p>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <form className="admin-toolbar" onSubmit={handleSearchSubmit}>
          <input
            className="admin-input"
            placeholder="İsim veya e-posta ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tüm durumlar</option>
            {Object.entries(STATUS_LABELS).map(([key, v]) => (
              <option key={key} value={key}>{v.label}</option>
            ))}
          </select>
          <button className="admin-btn" type="submit"><Search size={14} /></button>
        </form>

        {loading ? (
          <div className="admin-loading">Yükleniyor...</div>
        ) : users.length === 0 ? (
          <div className="admin-empty">Kullanıcı bulunamadı.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Üniversite</th>
                  <th>Bölüm / Sınıf</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.fullName}
                      {u.isAdmin && <span className="admin-badge admin-badge-amber" style={{ marginLeft: 6 }}>Admin</span>}
                      {u.isBanned && <span className="admin-badge admin-badge-coral" style={{ marginLeft: 6 }}>Banlı</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>{u.university?.name || '—'}</td>
                    <td>{u.department || '—'} {u.classYear ? `/ ${u.classYear}. sınıf` : ''}</td>
                    <td>
                      <span className={`admin-badge ${STATUS_LABELS[u.verificationStatus]?.cls || 'admin-badge-muted'}`}>
                        {STATUS_LABELS[u.verificationStatus]?.label || u.verificationStatus}
                      </span>
                      {u.verificationStatus === 'manual_review' && u.verificationPriority && (
                        <span className="admin-badge admin-badge-amber" style={{ marginLeft: 6 }} title="Öncelikli doğrulama satın aldı">
                          ⚡ Öncelikli
                        </span>
                      )}
                      {u.verificationStatus === 'manual_review' && u.ocrAutoCheckPassed !== null && u.ocrAutoCheckPassed !== undefined && (
                        <span
                          className={`admin-badge ${u.ocrAutoCheckPassed ? 'admin-badge-teal' : 'admin-badge-coral'}`}
                          style={{ marginLeft: 6 }}
                          title="OCR ön kontrolü - hesabı otomatik doğrulamaz, sadece ipucudur"
                        >
                          OCR {u.ocrAutoCheckPassed ? '✓' : '✗'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        {u.verificationStatus === 'manual_review' && (
                          <>
                            <button className="admin-btn admin-btn-small" title="Doğrula" onClick={() => setVerification(u.id, 'verified')}>
                              <CheckCircle2 size={14} />
                            </button>
                            <button className="admin-btn admin-btn-small admin-btn-danger" title="Reddet" onClick={() => setVerification(u.id, 'rejected')}>
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                        <button
                          className={`admin-btn admin-btn-small ${u.isBanned ? '' : 'admin-btn-danger'}`}
                          title={u.isBanned ? 'Banı kaldır' : 'Banla'}
                          onClick={() => toggleBan(u.id, u.isBanned)}
                        >
                          {u.isBanned ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
                        </button>
                        <button className="admin-btn admin-btn-small admin-btn-danger" title="Sil" onClick={() => handleDelete(u.id, u.fullName)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
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
