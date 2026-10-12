import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Bug, CheckCircle2, Database, Download, HardDriveDownload, RotateCcw } from 'lucide-react';
import adminApi, { errorText } from '../adminApi';
import { Empty, PageHead, Skeleton, fmt, fmtDateTime, timeAgo } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import AuditLogCard from './AuditLogCard';

const fmtSize = (b) =>
  b === null || b === undefined ? '-' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

const STATUS = [
  { value: 'open', label: 'Açık' },
  { value: 'resolved', label: 'Çözüldü' },
  { value: 'all', label: 'Tümü' },
];
const SOURCES = [
  { value: '', label: 'Hepsi' },
  { value: 'server', label: 'Sunucu' },
  { value: 'client', label: 'Tarayıcı' },
];

function StatusTile({ icon: Icon, label, value, note, tone }) {
  return (
    <div className="adm-card adm-kpi">
      <span className="adm-kpi-icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="adm-kpi-body">
        <div style={{ minWidth: 0 }}>
          <span className="adm-kpi-label">{label}</span>
          <span className="adm-kpi-value" style={{ fontSize: 22 }}>{value}</span>
        </div>
      </div>
      {note && (
        <div className="adm-kpi-foot">
          <span className={`adm-badge ${tone || ''}`}>{note}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminSystem() {
  const toast = useToast();
  const confirm = useConfirm();
  const [system, setSystem] = useState(null);
  const [backups, setBackups] = useState(null);
  const [errors, setErrors] = useState(null);
  const [status, setStatus] = useState('open');
  const [source, setSource] = useState('');
  const [open, setOpen] = useState(null);
  const [backingUp, setBackingUp] = useState(false);

  const loadSystem = useCallback(() => {
    adminApi.getSystem().then((r) => setSystem(r.data)).catch((err) => toast.error(errorText(err, 'Sistem durumu yüklenemedi.')));
    adminApi.getBackups().then((r) => setBackups(r.data.backups)).catch(() => setBackups([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadErrors = useCallback(() => {
    adminApi
      .getErrors({ status, source: source || undefined })
      .then((r) => setErrors(r.data))
      .catch((err) => toast.error(errorText(err, 'Hata kayıtları yüklenemedi.')));
  }, [status, source]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(loadSystem, [loadSystem]);
  useEffect(loadErrors, [loadErrors]);

  async function backupNow() {
    setBackingUp(true);
    try {
      const res = await adminApi.createBackup();
      toast.success(`${res.data.message} (${fmtSize(res.data.backup.size)})`);
      loadSystem();
    } catch (err) {
      toast.error(errorText(err, 'Yedek alınamadı.'));
    } finally {
      setBackingUp(false);
    }
  }

  async function download(name) {
    try {
      const res = await adminApi.downloadBackup(name);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.error(errorText(err, 'Yedek indirilemedi.'));
    }
  }

  async function setResolved(e, resolved) {
    try {
      await adminApi.updateError(e.id, { resolved });
      loadErrors();
      loadSystem();
    } catch (err) {
      toast.error(errorText(err, 'Kayıt güncellenemedi.'));
    }
  }

  async function clearResolved() {
    if (!(await confirm({ title: 'Çözülen kayıtlar silinsin mi?', message: 'Çözüldü olarak işaretlenen tüm hata kayıtları kalıcı olarak silinir.', confirmLabel: 'Sil', danger: true }))) return;
    try {
      const res = await adminApi.clearResolvedErrors();
      toast.success(res.data.message);
      loadErrors();
    } catch (err) {
      toast.error(errorText(err, 'Kayıtlar silinemedi.'));
    }
  }

  const latest = system?.backups.latest;
  const backupAge = latest ? Date.now() - new Date(latest.createdAt).getTime() : null;

  return (
    <div>
      <PageHead title="Sistem" sub="Veritabanı yedekleri, hata kayıtları, yönetici işlem kaydı ve altyapı durumu.">
        <button type="button" className="adm-btn" onClick={backupNow} disabled={backingUp}>
          <HardDriveDownload /> {backingUp ? 'Yedek alınıyor…' : 'Şimdi yedek al'}
        </button>
      </PageHead>

      <div className="adm-grid adm-grid-kpi">
        {!system ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={104} />)
        ) : (
          <>
            <StatusTile icon={Database} label="Veritabanı boyutu" value={fmtSize(system.database.size)} />
            <StatusTile
              icon={HardDriveDownload}
              label="Son yedek"
              value={latest ? timeAgo(latest.createdAt) : 'Yok'}
              note={!latest ? 'Henüz yedek alınmadı' : backupAge > 36 * 3600 * 1000 ? 'Son yedek eski' : 'Her gece 03:30'}
              tone={!latest || backupAge > 36 * 3600 * 1000 ? 'red' : 'green'}
            />
            <StatusTile
              icon={Bug}
              label="Açık hata"
              value={fmt(system.errors.open)}
              note={system.sentry ? 'Sentry bağlı' : 'Yalnızca bu panel'}
              tone={system.errors.open ? 'amber' : 'green'}
            />
            <StatusTile icon={BellRing} label="Bildirim alan cihaz" value={fmt(system.push.devices)} note={`${fmt(system.push.users)} öğrenci`} />
          </>
        )}
      </div>

      {system?.config?.production && (
        <section className="adm-card" style={{ marginTop: 14 }} aria-labelledby="adm-config-title">
          <h2 className="adm-card-title" id="adm-config-title">Yayın ayarları</h2>
          {system.config.warnings.length === 0 ? (
            <p style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--adm-up)' }} aria-hidden="true" /> Temel yayın ayarlarının hepsi tamam.
            </p>
          ) : (
            <>
              <p className="adm-card-sub">Railway &gt; Variables ekranında düzeltilmesi gerekenler (her değişiklikten sonra sunucu yeniden başlar):</p>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
                {system.config.warnings.map((w) => (
                  <li key={w} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <AlertTriangle size={18} style={{ color: 'var(--adm-warn)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {system.mail && system.mail.mode !== 'console' && (
            <p style={{ margin: '12px 0 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {system.mail.ok === false ? (
                <AlertTriangle size={18} style={{ color: 'var(--adm-warn)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={18} style={{ color: 'var(--adm-up)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              )}
              <span>
                E-posta ({system.mail.mode === 'brevo' ? 'Brevo' : 'SMTP'}):{' '}
                {system.mail.ok === false
                  ? `son deneme başarısız — ${system.mail.error}`
                  : system.mail.ok
                    ? 'son deneme başarılı.'
                    : 'henüz e-posta gönderilmedi.'}
              </span>
            </p>
          )}
        </section>
      )}

      {system?.payments.mock && (
        <div className="adm-card" style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={20} style={{ color: 'var(--adm-warn)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <p style={{ margin: 0 }}>
            Deneme ödemesi açık: Premium ödeme alınmadan açılıyor. Yayında bu ayar kapalı olmalı (<code>MOCK_PAYMENTS</code>).
          </p>
        </div>
      )}

      <div className="adm-grid adm-grid-main" style={{ marginTop: 14, alignItems: 'start' }}>
        <section className="adm-card">
          <h2 className="adm-card-title">Hata kayıtları</h2>
          <p className="adm-card-sub">Sunucuda ve öğrencilerin tarayıcısında oluşan hatalar. Aynı hata tekrar edince yeni satır açılmaz, sayısı artar.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14, justifyContent: 'space-between' }}>
            <div className="adm-chips" role="group" aria-label="Durum">
              {STATUS.map((s) => (
                <button key={s.value} type="button" className={`adm-chip ${status === s.value ? 'on' : ''}`} aria-pressed={status === s.value} onClick={() => setStatus(s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="adm-chips" role="group" aria-label="Kaynak">
              {SOURCES.map((s) => (
                <button key={s.value} type="button" className={`adm-chip ${source === s.value ? 'on' : ''}`} aria-pressed={source === s.value} onClick={() => setSource(s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {!errors ? (
            <Skeleton h={200} />
          ) : errors.errors.length === 0 ? (
            <Empty icon={CheckCircle2}>{status === 'open' ? 'Açık hata yok. Her şey yolunda görünüyor.' : 'Kayıt yok.'}</Empty>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Hata</th>
                    <th className="hide-sm">Kaynak</th>
                    <th>Sayı</th>
                    <th className="hide-sm">Son görülme</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {errors.errors.map((e) => (
                    <React.Fragment key={e.id}>
                      <tr>
                        <td style={{ maxWidth: 360 }}>
                          <button
                            type="button"
                            onClick={() => setOpen(open === e.id ? null : e.id)}
                            aria-expanded={open === e.id}
                            style={{ all: 'unset', cursor: 'pointer', display: 'block', fontWeight: 600, wordBreak: 'break-word' }}
                          >
                            {e.message}
                          </button>
                          {e.path && <div className="adm-muted" style={{ fontSize: 13 }}>{e.path}</div>}
                        </td>
                        <td className="hide-sm">
                          <span className="adm-badge">{e.source === 'server' ? 'Sunucu' : 'Tarayıcı'}</span>
                        </td>
                        <td>{fmt(e.count)}</td>
                        <td className="hide-sm adm-muted" title={fmtDateTime(e.lastSeen)}>{timeAgo(e.lastSeen)}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {e.resolved ? (
                            <button type="button" className="adm-btn ghost small" onClick={() => setResolved(e, false)}>
                              <RotateCcw /> Yeniden aç
                            </button>
                          ) : (
                            <button type="button" className="adm-btn ghost small" onClick={() => setResolved(e, true)}>
                              <CheckCircle2 /> Çözüldü
                            </button>
                          )}
                        </td>
                      </tr>
                      {open === e.id && (
                        <tr>
                          <td colSpan={5}>
                            <div className="adm-muted" style={{ fontSize: 13, marginBottom: 6 }}>
                              İlk görülme {fmtDateTime(e.firstSeen)}
                              {e.userId ? ` · Öğrenci #${e.userId}` : ''}
                              {e.userAgent ? ` · ${e.userAgent}` : ''}
                            </div>
                            {e.stack && (
                              <pre style={{ margin: 0, padding: 12, borderRadius: 10, background: 'var(--surface-2)', fontSize: 12, lineHeight: 1.5, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {e.stack}
                              </pre>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {status !== 'open' && errors?.errors.some((e) => e.resolved) && (
            <button type="button" className="adm-btn danger-ghost small" style={{ marginTop: 14 }} onClick={clearResolved}>
              Çözülenleri sil
            </button>
          )}
        </section>

        <section className="adm-card">
          <h2 className="adm-card-title">Yedekler</h2>
          <p className="adm-card-sub">Her gece 03:30'da alınır, son 14 yedek saklanır.</p>
          {system &&
            (system.backups.offsite?.configured ? (
              <p className={`adm-badge ${system.backups.offsite.lastError ? 'red' : 'green'}`} style={{ marginBottom: 12, whiteSpace: 'normal' }}>
                {system.backups.offsite.lastError
                  ? `Dış depoya son yükleme başarısız: ${system.backups.offsite.lastError}`
                  : system.backups.offsite.lastUploadAt
                    ? `Dış depoya da yükleniyor · son ${timeAgo(system.backups.offsite.lastUploadAt)}`
                    : 'Dış depo bağlı; ilk yedekte yüklenecek.'}
              </p>
            ) : (
              <p className="adm-badge amber" style={{ marginBottom: 12, whiteSpace: 'normal' }}>
                Yedekler yalnızca sunucu diskinde. Disk kaybına karşı BACKUP_S3_* ayarlarıyla S3/R2'ye gönderimi aç ya da ara sıra indir.
              </p>
            ))}
          {!backups ? (
            <Skeleton h={160} />
          ) : backups.length === 0 ? (
            <Empty icon={Database}>Henüz yedek yok. “Şimdi yedek al” ile ilk yedeği oluştur.</Empty>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {backups.map((b) => (
                <li key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{fmtDateTime(b.createdAt)}</div>
                    <div className="adm-muted" style={{ fontSize: 13 }}>{fmtSize(b.size)}</div>
                  </div>
                  <button type="button" className="adm-btn ghost small icon" onClick={() => download(b.name)} aria-label={`${fmtDateTime(b.createdAt)} yedeğini indir`} title="İndir">
                    <Download />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AuditLogCard />
    </div>
  );
}
