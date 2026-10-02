import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BadgeCheck,
  Ban,
  Bell,
  Crown,
  Download,
  ExternalLink,
  Gift,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import adminApi, { errorText } from '../adminApi';
import {
  Avatar,
  CLASS_LABELS,
  Drawer,
  Empty,
  INTENT_LABELS,
  PageHead,
  Pager,
  Person,
  Skeleton,
  fmt,
  fmtDate,
  fmtMoney,
  timeAgo,
} from '../ui';
import { buildFileUrl } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

const PAGE_SIZE = 25;
const FILTER_KEYS = ['search', 'university', 'premium', 'badge', 'role', 'joined', 'inactive', 'sort'];

function StatusBadges({ u }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {u.isAdmin && <span className="adm-badge blue"><Shield /> Yönetici</span>}
      {u.isBanned && <span className="adm-badge red"><Ban /> Askıda</span>}
      {u.isFrozen && <span className="adm-badge">Dondurulmuş</span>}
      {u.premiumActive && <span className="adm-badge amber"><Crown /> Premium</span>}
      {u.studentDocStatus === 'approved' && <span className="adm-badge green"><BadgeCheck /> Rozet</span>}
      {u.studentDocStatus === 'pending' && <span className="adm-badge">Rozet bekliyor</span>}
    </span>
  );
}

function UserDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [u, setU] = useState(null);
  const [giftDays, setGiftDays] = useState(30);
  const [note, setNote] = useState({ title: '', body: '' });
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi
      .getUser(id)
      .then((res) => setU(res.data))
      .catch((err) => {
        toast.error(errorText(err, 'Kullanıcı yüklenemedi.'));
        onClose();
      });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);

  async function patch(data, success) {
    setBusy(true);
    try {
      await adminApi.updateUser(id, data);
      toast.success(success);
      load();
      onChanged();
    } catch (err) {
      toast.error(errorText(err, 'İşlem yapılamadı.'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleBan() {
    if (!u.isBanned) {
      const ok = await confirm({
        title: `${u.fullName} askıya alınsın mı?`,
        message: 'Hesaba giriş yapamaz, listelerde görünmez ve açık oturumu hemen kapanır. İstediğin zaman geri alabilirsin.',
        confirmLabel: 'Askıya al',
        danger: true,
      });
      if (!ok) return;
    }
    patch({ isBanned: !u.isBanned }, u.isBanned ? 'Askı kaldırıldı.' : 'Hesap askıya alındı.');
  }

  async function toggleAdmin() {
    const ok = await confirm({
      title: u.isAdmin ? 'Yönetici yetkisi kaldırılsın mı?' : `${u.fullName} yönetici yapılsın mı?`,
      message: u.isAdmin ? '' : 'Bu panele ve tüm öğrenci verilerine erişebilir.',
      confirmLabel: u.isAdmin ? 'Kaldır' : 'Yönetici yap',
      danger: !u.isAdmin,
    });
    if (ok) patch({ isAdmin: !u.isAdmin }, u.isAdmin ? 'Yönetici yetkisi kaldırıldı.' : 'Artık yönetici.');
  }

  async function grantBadge() {
    const ok = await confirm({ title: 'Onaylı öğrenci rozeti verilsin mi?', message: 'Öğrenciye bildirim ve e-posta gider.', confirmLabel: 'Rozet ver' });
    if (ok) patch({ verificationStatus: 'verified' }, 'Rozet verildi.');
  }

  async function sendNote(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await adminApi.notifyUser(id, note);
      toast.success(res.data.message);
      setNote({ title: '', body: '' });
      setNoteOpen(false);
    } catch (err) {
      toast.error(errorText(err, 'Bildirim gönderilemedi.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `${u.fullName} kalıcı olarak silinsin mi?`,
      message: 'Profil, mesajlar, eşleşmeler ve gönderiler silinir. Bu işlem geri alınamaz. Geçici bir önlem için askıya almayı tercih et.',
      confirmLabel: 'Kalıcı olarak sil',
      danger: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteUser(id);
      toast.success('Hesap silindi.');
      onChanged();
      onClose();
    } catch (err) {
      toast.error(errorText(err, 'Hesap silinemedi.'));
    }
  }

  return (
    <Drawer title="Öğrenci detayı" onClose={onClose}>
      {!u ? (
        <Skeleton h={400} />
      ) : (
        <>
          <div className="adm-person" style={{ gap: 14 }}>
            <Avatar user={u} size="lg" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{u.fullName}</div>
              <div className="adm-muted" style={{ fontSize: '0.85rem', overflowWrap: 'anywhere' }}>{u.email}</div>
              <div style={{ marginTop: 6 }}><StatusBadges u={u} /></div>
            </div>
          </div>

          <div className="adm-stat-mini">
            <div><b>{fmt(u.stats.matches)}</b><span>eşleşme</span></div>
            <div><b>{fmt(u.stats.messages)}</b><span>mesaj</span></div>
            <div><b>{fmt(u.stats.likesReceived)}</b><span>beğeni aldı</span></div>
            <div><b>{fmt(u.stats.likesGiven)}</b><span>beğendi</span></div>
            <div><b>{fmt(u.stats.posts)}</b><span>gönderi</span></div>
            <div><b>{fmt(u.stats.clubs)}</b><span>kulüp</span></div>
            <div><b>{fmt(u.stats.followers)}</b><span>takipçi</span></div>
            <div><b style={{ color: u.stats.reportsAgainst ? 'var(--adm-down)' : undefined }}>{fmt(u.stats.reportsAgainst)}</b><span>şikayet</span></div>
          </div>

          <dl className="adm-kv">
            <dt>Üniversite</dt><dd>{u.university?.name}</dd>
            <dt>Bölüm / sınıf</dt><dd>{u.department || '—'} · {CLASS_LABELS[u.classYear] || '—'}</dd>
            <dt>Yaş</dt><dd>{u.age || '—'}</dd>
            <dt>Ne arıyor</dt><dd>{(u.intent || '').split(',').filter(Boolean).map((i) => INTENT_LABELS[i] || i).join(', ') || '—'}</dd>
            <dt>İlgi alanları</dt><dd>{[u.interests, u.hobbies].filter(Boolean).join(', ') || '—'}</dd>
            <dt>Kayıt</dt><dd>{fmtDate(u.createdAt)}</dd>
            <dt>Son görülme</dt><dd>{timeAgo(u.lastSeenAt)}</dd>
            <dt>Premium</dt><dd>{u.premiumActive ? (u.premiumUntil ? `${fmtDate(u.premiumUntil)} tarihine kadar` : 'Süresiz') : 'Yok'}</dd>
            <dt>Görünürlük</dt><dd>{{ everyone: 'Herkes', university: 'Yalnızca kampüsü', nobody: 'Gizli' }[u.profileVisibility] || u.profileVisibility}{u.swipeEnabled ? ' · Kart Modu açık' : ' · Kart Modu kapalı'}</dd>
          </dl>

          {u.bio && <p className="adm-note" style={{ margin: 0 }}>{u.bio}</p>}

          {u.photos?.length > 0 && (
            <div className="adm-photos">
              {u.photos.map((p) => (
                <img key={p.id} src={buildFileUrl(p.url)} alt="" loading="lazy" />
              ))}
            </div>
          )}

          <div className="adm-card" style={{ padding: 14 }}>
            <h4 className="adm-card-title"><span><Gift size={16} /> Hediye Premium</span></h4>
            <p className="adm-card-sub">Ödül, çekiliş ya da kampüs elçisi için. Gelire sayılmaz; öğrenciye bildirim gider.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select className="adm-select" value={giftDays} onChange={(e) => setGiftDays(Number(e.target.value))} aria-label="Süre">
                {[7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} gün</option>)}
              </select>
              <button type="button" className="adm-btn" disabled={busy} onClick={() => patch({ premiumDays: giftDays }, `${giftDays} gün Premium tanımlandı.`)}>
                <Gift /> {u.premiumActive ? 'Süreyi uzat' : 'Hediye et'}
              </button>
              {u.premiumActive && (
                <button type="button" className="adm-btn ghost" disabled={busy} onClick={() => patch({ revokePremium: true }, 'Premium kaldırıldı.')}>
                  Premium’u kaldır
                </button>
              )}
            </div>
          </div>

          <div className="adm-card" style={{ padding: 14 }}>
            <h4 className="adm-card-title"><span><Bell size={16} /> Kişisel bildirim</span></h4>
            {noteOpen ? (
              <form onSubmit={sendNote} className="adm-grid" style={{ gap: 8 }}>
                <input className="adm-input" required maxLength={80} value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} placeholder="Başlık" aria-label="Başlık" />
                <textarea className="adm-textarea" required maxLength={500} value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} placeholder="Mesaj" aria-label="Mesaj" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="adm-btn" type="submit" disabled={busy}>Gönder</button>
                  <button className="adm-btn ghost" type="button" onClick={() => setNoteOpen(false)}>Vazgeç</button>
                </div>
              </form>
            ) : (
              <button type="button" className="adm-btn ghost" onClick={() => setNoteOpen(true)}>
                <Bell /> Bu öğrenciye bildirim yaz
              </button>
            )}
          </div>

          <div className="adm-actions-grid">
            <Link to={`/users/${u.id}`} className="adm-btn ghost" target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Profili aç
            </Link>
            {u.studentDocStatus === 'pending' ? (
              <Link to="/admin/verification-queue" className="adm-btn ghost"><BadgeCheck /> Belgeyi incele</Link>
            ) : u.studentDocStatus !== 'approved' ? (
              <button type="button" className="adm-btn ghost" disabled={busy} onClick={grantBadge}><BadgeCheck /> Rozet ver</button>
            ) : (
              <span />
            )}
            <button type="button" className={`adm-btn ${u.isBanned ? 'ghost' : 'danger-ghost'}`} disabled={busy} onClick={toggleBan}>
              {u.isBanned ? <><UserCheck /> Askıyı kaldır</> : <><Ban /> Askıya al</>}
            </button>
            <button type="button" className="adm-btn ghost" disabled={busy} onClick={toggleAdmin}>
              {u.isAdmin ? <><ShieldOff /> Yöneticiliği kaldır</> : <><Shield /> Yönetici yap</>}
            </button>
          </div>

          {u.payments?.length > 0 && (
            <div>
              <h4 className="adm-card-title">Ödemeler</h4>
              <table className="adm-table">
                <tbody>
                  {u.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{fmtDate(p.createdAt)}</td>
                      <td>{p.provider === 'admin_gift' ? 'Hediye' : p.plan}</td>
                      <td className="num">{p.amount ? fmtMoney(p.amount) : '—'}</td>
                      <td><span className={`adm-badge ${p.status === 'success' ? 'green' : 'red'}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button type="button" className="adm-btn danger-ghost" onClick={remove} style={{ marginTop: 6 }}>
            <Trash2 /> Hesabı kalıcı olarak sil
          </button>
        </>
      )}
    </Drawer>
  );
}

export default function AdminUsers() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [universities, setUniversities] = useState([]);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState(params.get('search') || '');
  const [openId, setOpenId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const filterKey = JSON.stringify(filters);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  };

  // Arama kutusu yazmayı bitirince uygulanır
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('search') || '') !== searchText.trim()) setFilter('search', searchText.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(() => {
    adminApi
      .getUsers({ ...JSON.parse(filterKey), page, pageSize: PAGE_SIZE })
      .then((res) => setData(res.data))
      .catch((err) => toast.error(errorText(err, 'Kullanıcılar yüklenemedi.')));
  }, [filterKey, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load]);
  useEffect(() => {
    adminApi.getCampusInsights(90).then((res) => setUniversities(res.data.campuses)).catch(() => {});
  }, []);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await adminApi.exportUsers(JSON.parse(filterKey));
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kampus-kullanicilar-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('CSV indirilemedi.');
    } finally {
      setExporting(false);
    }
  }

  const activeFilterCount = FILTER_KEYS.filter((k) => k !== 'sort' && k !== 'search' && filters[k]).length;

  return (
    <div>
      <PageHead title="Kullanıcılar" sub="Öğrencileri filtrele, detayına bak, Premium hediye et ya da hesabı yönet.">
        <button type="button" className="adm-btn ghost" onClick={exportCsv} disabled={exporting}>
          <Download /> {exporting ? 'Hazırlanıyor…' : 'CSV indir'}
        </button>
      </PageHead>

      <section className="adm-card">
        <div className="adm-toolbar">
          <label className="adm-search">
            <Search />
            <input className="adm-input" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Ad, e-posta ya da bölüm ara" aria-label="Kullanıcı ara" />
          </label>
          <select className="adm-select" value={filters.university} onChange={(e) => setFilter('university', e.target.value)} aria-label="Kampüs">
            <option value="">Tüm kampüsler</option>
            {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="adm-select" value={filters.sort || 'newest'} onChange={(e) => setFilter('sort', e.target.value === 'newest' ? '' : e.target.value)} aria-label="Sıralama">
            <option value="newest">En yeni</option>
            <option value="lastSeen">Son görülen</option>
            <option value="oldest">En eski</option>
            <option value="name">Ada göre</option>
          </select>
        </div>
        <div className="adm-toolbar">
          <select className="adm-select" value={filters.premium} onChange={(e) => setFilter('premium', e.target.value)} aria-label="Premium">
            <option value="">Premium: hepsi</option>
            <option value="yes">Premium</option>
            <option value="no">Premium değil</option>
          </select>
          <select className="adm-select" value={filters.badge} onChange={(e) => setFilter('badge', e.target.value)} aria-label="Rozet">
            <option value="">Rozet: hepsi</option>
            <option value="approved">Rozetli</option>
            <option value="pending">Rozet bekliyor</option>
            <option value="none">Rozet başvurusu yok</option>
            <option value="rejected">Rozet reddedildi</option>
          </select>
          <select className="adm-select" value={filters.role} onChange={(e) => setFilter('role', e.target.value)} aria-label="Hesap durumu">
            <option value="">Hesap: hepsi</option>
            <option value="active">Aktif öğrenciler</option>
            <option value="banned">Askıdakiler</option>
            <option value="admin">Yöneticiler</option>
          </select>
          <select className="adm-select" value={filters.joined} onChange={(e) => setFilter('joined', e.target.value)} aria-label="Kayıt">
            <option value="">Kayıt: her zaman</option>
            <option value="1">Son 24 saat</option>
            <option value="7">Son 7 gün</option>
            <option value="30">Son 30 gün</option>
          </select>
          <select className="adm-select" value={filters.inactive} onChange={(e) => setFilter('inactive', e.target.value)} aria-label="Son giriş">
            <option value="">Son giriş: hepsi</option>
            <option value="7">7+ gündür girmeyen</option>
            <option value="14">14+ gündür girmeyen</option>
            <option value="30">30+ gündür girmeyen</option>
          </select>
          {activeFilterCount > 0 && (
            <button type="button" className="adm-btn ghost small" onClick={() => { setParams(new URLSearchParams(), { replace: true }); setSearchText(''); setPage(1); }}>
              Filtreleri temizle ({activeFilterCount})
            </button>
          )}
        </div>

        {!data ? (
          <Skeleton h={320} />
        ) : data.users.length === 0 ? (
          <Empty icon={Users}>Bu filtrelerle eşleşen kullanıcı yok.</Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Öğrenci</th>
                  <th className="hide-sm">Kampüs</th>
                  <th>Durum</th>
                  <th className="hide-sm">Son görülme</th>
                  <th className="hide-sm">Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr
                    key={u.id}
                    className={`clickable ${openId === u.id ? 'selected' : ''}`}
                    onClick={() => setOpenId(u.id)}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenId(u.id))}
                    aria-label={`${u.fullName} detayını aç`}
                  >
                    <td style={{ maxWidth: 280 }}><Person user={u} meta={u.email} /></td>
                    <td className="hide-sm adm-muted">
                      <span className="adm-ellipsis" style={{ display: 'block', maxWidth: 220 }}>{u.university?.name}</span>
                      <span className="adm-person-meta">{u.department || ''}</span>
                    </td>
                    <td><StatusBadges u={u} /></td>
                    <td className="hide-sm adm-muted">{timeAgo(u.lastSeenAt)}</td>
                    <td className="hide-sm adm-muted">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />}
      </section>

      {openId && <UserDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
