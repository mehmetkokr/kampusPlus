import React, { useEffect, useState, useCallback } from 'react';
import { FileCheck2, X as CloseIcon, ExternalLink, ShieldQuestion } from 'lucide-react';
import adminApi from '../adminApi';
import { buildFileUrl } from '../../api';

// Onay/Red Kuyruğu (Grup: OCR doğrulama ile birlikte çalışır)
// -----------------------------------------------------------
// "manual_review" durumundaki her kullanıcı burada listelenir. Liste zaten
// backend'de öncelikli doğrulama satın alanlara göre sıralı gelir
// (bkz. admin.js -> GET /users, status=manual_review özel orderBy).
// Bir satıra tıklayınca belge (öğrenci kimliği/e-devlet belgesi) büyük
// boyutta gösterilir, OCR ön kontrol sonucu bir ipucu olarak sunulur ve
// admin tek tıkla Onayla/Reddet yapabilir. Reddederken kısa bir gerekçe
// zorunludur - bu gerekçe öğrenciye e-posta ile iletilir (bkz. admin.js).
export default function AdminVerificationQueue() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // detaylı kullanıcı (GET /users/:id)
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectFor, setShowRejectFor] = useState(null); // userId | null
  const [actingId, setActingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getUsers({ status: 'manual_review', page: 1, pageSize: 50 })
      .then((res) => {
        setUsers(res.data.users);
        setTotal(res.data.total);
      })
      .catch((err) => {
        console.error('Kuyruk alınamadı:', err);
        setError('Kuyruk yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openDetail(userId) {
    setDetailLoading(true);
    setSelected({ id: userId });
    adminApi
      .getUser(userId)
      .then((res) => setSelected(res.data))
      .catch(() => setError('Kullanıcı detayı alınamadı.'))
      .finally(() => setDetailLoading(false));
  }

  async function approve(userId) {
    setActingId(userId);
    try {
      await adminApi.updateUser(userId, { verificationStatus: 'verified' });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTotal((t) => t - 1);
      if (selected?.id === userId) setSelected(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Onaylanamadı.');
    } finally {
      setActingId(null);
    }
  }

  async function reject(userId) {
    if (!rejectReason.trim()) return;
    setActingId(userId);
    try {
      await adminApi.updateUser(userId, { verificationStatus: 'rejected', rejectionReason: rejectReason.trim() });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTotal((t) => t - 1);
      setShowRejectFor(null);
      setRejectReason('');
      if (selected?.id === userId) setSelected(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Reddedilemedi.');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <h1 className="admin-page-title">Onay/Red Kuyruğu</h1>
      <p className="admin-page-sub">
        Manuel incelemeye düşen öğrenci belgeleri ({total} bekliyor). ⚡ ile işaretlenenler
        öncelikli doğrulama satın aldı ve listenin başında gösteriliyor. OCR rozeti sadece bir
        ipucudur — son kararı sen veriyorsun.
      </p>

      {error && <div className="admin-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div className="admin-card">
          {loading ? (
            <div className="admin-loading">Yükleniyor...</div>
          ) : users.length === 0 ? (
            <div className="admin-empty">Kuyrukta bekleyen kimse yok 🎉</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ad Soyad</th>
                    <th>Üniversite</th>
                    <th>Bölüm</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => openDetail(u.id)}
                      style={{ cursor: 'pointer', background: selected?.id === u.id ? 'rgba(232,163,61,0.08)' : undefined }}
                    >
                      <td>{u.fullName}</td>
                      <td>{u.university?.name}</td>
                      <td>{u.department || '—'}</td>
                      <td>
                        {u.ocrAutoCheckPassed === true && <span className="admin-badge admin-badge-teal">OCR ✓</span>}
                        {u.ocrAutoCheckPassed === false && <span className="admin-badge admin-badge-coral">OCR ✗</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && (
          <div className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: 0 }}>{selected.fullName || 'Yükleniyor...'}</h3>
              <button className="admin-btn admin-btn-outline admin-btn-small" onClick={() => setSelected(null)}>
                <CloseIcon size={14} />
              </button>
            </div>

            {detailLoading ? (
              <div className="admin-loading">Yükleniyor...</div>
            ) : (
              <>
                <p className="muted" style={{ fontSize: 13, margin: '4px 0 14px' }}>
                  {selected.email} · {selected.university?.name} · {selected.department || 'Bölüm belirtilmemiş'}
                </p>

                {selected.studentDocUrl ? (
                  <a href={buildFileUrl(selected.studentDocUrl)} target="_blank" rel="noreferrer">
                    <img
                      src={buildFileUrl(selected.studentDocUrl)}
                      alt="Öğrenci belgesi"
                      style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: '#0b0d12' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="muted" style={{ fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ExternalLink size={12} /> Tam boyutta / PDF olarak aç
                    </div>
                  </a>
                ) : (
                  <div className="admin-empty">Belge yüklenmemiş.</div>
                )}

                <div className="admin-card" style={{ marginTop: 14, marginBottom: 14, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <ShieldQuestion size={16} color="var(--sky)" />
                    <strong style={{ fontSize: 13 }}>OCR ön kontrolü (sadece ipucu)</strong>
                    {selected.ocrAutoCheckPassed === true && <span className="admin-badge admin-badge-teal">Örtüşüyor</span>}
                    {selected.ocrAutoCheckPassed === false && <span className="admin-badge admin-badge-coral">Örtüşmüyor</span>}
                    {(selected.ocrAutoCheckPassed === null || selected.ocrAutoCheckPassed === undefined) && (
                      <span className="admin-badge admin-badge-muted">Çalıştırılamadı (ör. PDF)</span>
                    )}
                  </div>
                  <p className="muted" style={{ fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto', margin: 0 }}>
                    {selected.ocrExtractedText || 'Belgeden metin çıkarılamadı.'}
                  </p>
                </div>

                {showRejectFor === selected.id ? (
                  <div>
                    <textarea
                      className="admin-select"
                      style={{ width: '100%', minHeight: 70 }}
                      placeholder="Öğrenciye gösterilecek kısa red gerekçesi (ör. 'Belge okunaklı değil, lütfen net bir fotoğraf yükle.')"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        className="admin-btn admin-btn-danger"
                        disabled={!rejectReason.trim() || actingId === selected.id}
                        onClick={() => reject(selected.id)}
                      >
                        Reddi Onayla ve Gönder
                      </button>
                      <button className="admin-btn admin-btn-outline" onClick={() => { setShowRejectFor(null); setRejectReason(''); }}>
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="admin-btn"
                      disabled={actingId === selected.id}
                      onClick={() => approve(selected.id)}
                    >
                      <FileCheck2 size={14} style={{ marginRight: 6 }} />
                      {actingId === selected.id ? 'İşleniyor...' : 'Onayla'}
                    </button>
                    <button className="admin-btn admin-btn-danger" onClick={() => setShowRejectFor(selected.id)}>
                      Reddet
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
