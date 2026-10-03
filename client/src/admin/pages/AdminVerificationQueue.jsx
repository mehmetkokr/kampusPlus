import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ExternalLink, FileText, ShieldQuestion, X } from 'lucide-react';
import adminApi, { errorText, refreshCounts } from '../adminApi';
import { Empty, PageHead, Person, Skeleton, fmtDate, timeAgo } from '../ui';
import { buildFileUrl } from '../../api';
import { useToast } from '../../context/ToastContext';

const REJECT_REASONS = [
  'Belge okunaklı değil, lütfen net bir fotoğraf ya da PDF yükle.',
  'Belgedeki isim hesabındaki isimle eşleşmiyor.',
  'Belge güncel değil; bu döneme ait e-Devlet öğrenci belgesi yükle.',
  'Yüklenen dosya öğrenci belgesi değil.',
];

// Onaylı öğrenci rozeti için yüklenen e-Devlet belgeleri.
// En eski başvuru en üstte. OCR yalnızca ipucudur; kararı yönetici verir.
export default function AdminVerificationQueue() {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi
      .getUsers({ status: 'manual_review', pageSize: 100 })
      .then((res) => setUsers(res.data.users))
      .catch((err) => toast.error(errorText(err, 'Kuyruk yüklenemedi.')));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);

  function open(id) {
    setRejecting(false);
    setReason('');
    setSelected({ id });
    adminApi
      .getUser(id)
      .then((res) => setSelected(res.data))
      .catch((err) => {
        toast.error(errorText(err, 'Belge yüklenemedi.'));
        setSelected(null);
      });
  }

  async function decide(verificationStatus) {
    setBusy(true);
    try {
      await adminApi.updateUser(selected.id, verificationStatus === 'rejected' ? { verificationStatus, rejectionReason: reason.trim() } : { verificationStatus });
      toast.success(verificationStatus === 'verified' ? `${selected.fullName} onaylandı, rozet verildi.` : 'Başvuru reddedildi, öğrenciye gerekçe iletildi.');
      refreshCounts();
      // Sıradaki başvuruyu otomatik aç
      const rest = users.filter((u) => u.id !== selected.id);
      setUsers(rest);
      if (rest[0]) open(rest[0].id);
      else setSelected(null);
    } catch (err) {
      toast.error(errorText(err, 'İşlem yapılamadı.'));
    } finally {
      setBusy(false);
    }
  }

  const doc = selected?.studentDocUrl ? buildFileUrl(selected.studentDocUrl) : null;
  const isPdf = selected?.studentDocUrl?.toLowerCase().endsWith('.pdf');

  return (
    <div>
      <PageHead
        title="Onay Kuyruğu"
        sub="Onaylı öğrenci rozeti için yüklenen e-Devlet belgeleri. Onayladığında öğrenciye bildirim ve e-posta gider; reddederken yazdığın gerekçe öğrenciye iletilir."
      />
      <div className="adm-grid adm-grid-main" style={{ alignItems: 'start' }}>
        <section className="adm-card">
          <h2 className="adm-card-title">Bekleyenler {users && <span className="adm-badge">{users.length}</span>}</h2>
          {users === null ? (
            <Skeleton h={200} />
          ) : users.length === 0 ? (
            <Empty icon={BadgeCheck}>Kuyruk boş. Bekleyen belge yok.</Empty>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr><th>Öğrenci</th><th className="hide-sm">Bölüm</th><th>OCR</th><th className="hide-sm">Kayıt</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className={`clickable ${selected?.id === u.id ? 'selected' : ''}`}
                      onClick={() => open(u.id)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && open(u.id)}
                    >
                      <td><Person user={u} meta={u.university?.name} /></td>
                      <td className="hide-sm adm-muted">{u.department || '-'}</td>
                      <td>
                        {u.ocrAutoCheckPassed === true && <span className="adm-badge green">Örtüşüyor</span>}
                        {u.ocrAutoCheckPassed === false && <span className="adm-badge red">Örtüşmüyor</span>}
                        {u.ocrAutoCheckPassed == null && <span className="adm-badge">Yok</span>}
                      </td>
                      <td className="hide-sm adm-muted">{timeAgo(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="adm-card">
          {!selected ? (
            <Empty icon={FileText}>İncelemek için soldan bir başvuru seç.</Empty>
          ) : !selected.email ? (
            <Skeleton h={420} />
          ) : (
            <div className="adm-grid" style={{ gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <Person user={selected} meta={`${selected.university?.name} · ${selected.department || 'bölüm yok'}`} />
                <button type="button" className="adm-btn ghost small icon" onClick={() => setSelected(null)} aria-label="Kapat"><X /></button>
              </div>
              <p className="adm-faint" style={{ margin: 0 }}>{selected.email} · Kayıt {fmtDate(selected.createdAt)}</p>

              {doc ? (
                <>
                  {isPdf ? (
                    <iframe title="Öğrenci belgesi" src={doc} className="adm-doc" style={{ height: 440 }} />
                  ) : (
                    <img src={doc} alt={`${selected.fullName} öğrenci belgesi`} className="adm-doc" />
                  )}
                  <a href={doc} target="_blank" rel="noopener noreferrer" className="adm-btn ghost small" style={{ alignSelf: 'start' }}>
                    <ExternalLink /> Tam boyutta aç
                  </a>
                </>
              ) : (
                <Empty>Belge bulunamadı.</Empty>
              )}

              <div className="adm-note">
                <ShieldQuestion />
                <div style={{ minWidth: 0 }}>
                  <b style={{ color: 'var(--text)' }}>OCR ön kontrolü</b> (yalnızca ipucu):{' '}
                  {selected.ocrAutoCheckPassed === true ? 'belgedeki metin isim ve üniversiteyle örtüşüyor.' : selected.ocrAutoCheckPassed === false ? 'belgedeki metin örtüşmüyor, dikkatli bak.' : 'çalıştırılamadı (ör. PDF).'}
                  {selected.ocrExtractedText && (
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ cursor: 'pointer' }}>Okunan metni göster</summary>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem', maxHeight: 160, overflow: 'auto', margin: '6px 0 0' }}>{selected.ocrExtractedText}</pre>
                    </details>
                  )}
                </div>
              </div>

              {rejecting ? (
                <div className="adm-grid" style={{ gap: 8 }}>
                  <div className="adm-chips">
                    {REJECT_REASONS.map((r) => (
                      <button key={r} type="button" className={`adm-chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>
                        {r.split(',')[0].split(';')[0]}
                      </button>
                    ))}
                  </div>
                  <textarea className="adm-textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Öğrenciye gösterilecek gerekçe" aria-label="Red gerekçesi" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="adm-btn danger" disabled={busy || !reason.trim()} onClick={() => decide('rejected')}>Reddet ve gönder</button>
                    <button type="button" className="adm-btn ghost" onClick={() => setRejecting(false)}>Vazgeç</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="adm-btn" disabled={busy} onClick={() => decide('verified')}>
                    <BadgeCheck /> Onayla ve rozet ver
                  </button>
                  <button type="button" className="adm-btn danger-ghost" disabled={busy} onClick={() => setRejecting(true)}>Reddet</button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
