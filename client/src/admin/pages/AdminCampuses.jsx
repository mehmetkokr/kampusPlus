import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, GraduationCap, Megaphone, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import adminApi, { errorText } from '../adminApi';
import { Kpi, PageHead, PERIODS, Segmented, Skeleton, Empty, fmt } from '../ui';
import { BarList } from '../charts';
import { usePeriod } from './AdminOverview';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

const TABS = [
  { value: 'performance', label: 'Performans' },
  { value: 'universities', label: 'Üniversite listesi' },
  { value: 'departments', label: 'Bölümler' },
];

const SORTS = {
  users: { label: 'Öğrenci', get: (c) => c.users },
  newUsers: { label: 'Yeni', get: (c) => c.newUsers },
  activeRate: { label: 'Aktiflik', get: (c) => c.activeRate },
  matches: { label: 'Eşleşme', get: (c) => c.matches },
  clubs: { label: 'Kulüp', get: (c) => c.clubs },
};

function Performance() {
  const [days, setDays] = usePeriod();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('users');

  useEffect(() => {
    setData(null);
    adminApi
      .getCampusInsights(days)
      .then((res) => setData(res.data))
      .catch((err) => setError(errorText(err, 'Kampüs verileri yüklenemedi.')));
  }, [days]);

  const rows = useMemo(() => (data ? [...data.campuses].sort((a, b) => SORTS[sort].get(b) - SORTS[sort].get(a)) : []), [data, sort]);
  const top = rows.slice(0, 8).map((c) => ({ key: c.name, count: c.users }));

  return (
    <>
      <div className="adm-toolbar" style={{ justifyContent: 'space-between' }}>
        <Segmented label="Dönem" value={days} options={PERIODS} onChange={setDays} />
      </div>
      {error && <div className="adm-error">{error}</div>}
      <div className="adm-grid adm-grid-kpi">
        {!data ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={100} />)
        ) : (
          <>
            <Kpi icon={GraduationCap} label="Canlı kampüs" value={data.liveUniversities} color="var(--adm-c1)">
              <span className="adm-delta-note">{fmt(data.totalUniversities)} üniversiteden</span>
            </Kpi>
            <Kpi label="Toplam öğrenci" value={data.totalUsers} color="var(--adm-c2)" />
            <Kpi label={`Son ${days} günde katılan`} value={data.campuses.reduce((s, c) => s + c.newUsers, 0)} color="var(--adm-c3)" />
            <Kpi
              label="Yayılma"
              value={data.totalUniversities ? Math.round((data.liveUniversities / data.totalUniversities) * 1000) / 10 : 0}
              format={(v) => `%${v.toLocaleString('tr-TR')}`}
              color="var(--adm-c1)"
            >
              <span className="adm-delta-note">üniversitelerin öğrencisi var</span>
            </Kpi>
          </>
        )}
      </div>

      <div className="adm-grid adm-grid-main" style={{ marginTop: 14 }}>
        <section className="adm-card">
          <div className="adm-card-title">
            Kampüs tablosu
            <select className="adm-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sıralama">
              {Object.entries(SORTS).map(([k, v]) => (
                <option key={k} value={k}>{v.label} sırasına göre</option>
              ))}
            </select>
          </div>
          <p className="adm-card-sub">Aktiflik: dönemde uygulamayı kullanan öğrencilerin oranı. Düşük aktiflik, o kampüse kampanya fırsatıdır.</p>
          {!data ? (
            <Skeleton h={220} />
          ) : rows.length === 0 ? (
            <Empty icon={GraduationCap}>Henüz hiçbir kampüste öğrenci yok.</Empty>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Kampüs</th>
                    <th className="num">Öğrenci</th>
                    <th className="num">Yeni</th>
                    <th className="num">Aktiflik</th>
                    <th className="num hide-sm">Eşleşme</th>
                    <th className="num hide-sm">Kulüp</th>
                    <th className="num hide-sm">Etkinlik</th>
                    <th className="num hide-sm">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/admin/users?university=${c.id}`} style={{ color: 'inherit', fontWeight: 650 }}>{c.name}</Link>
                        <span className="adm-person-meta">@{c.emailDomain}</span>
                      </td>
                      <td className="num">{fmt(c.users)}</td>
                      <td className="num">{c.newUsers ? `+${fmt(c.newUsers)}` : '-'}</td>
                      <td className="num">
                        <span className={`adm-badge ${c.activeRate >= 50 ? 'green' : c.activeRate >= 20 ? 'amber' : 'red'}`}>%{c.activeRate}</span>
                      </td>
                      <td className="num hide-sm">{fmt(c.matches)}</td>
                      <td className="num hide-sm">{fmt(c.clubs)}</td>
                      <td className="num hide-sm">{fmt(c.upcomingEvents)}</td>
                      <td className="num hide-sm">{fmt(c.premium)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="adm-card">
          <h2 className="adm-card-title">En büyük kampüsler</h2>
          <p className="adm-card-sub">Öğrenci sayısına göre.</p>
          {!data ? <Skeleton h={200} /> : top.length ? <BarList items={top} /> : <p className="adm-muted">Veri yok.</p>}
          <Link to="/admin/campaigns" className="adm-btn ghost" style={{ marginTop: 16, width: '100%' }}>
            <Megaphone /> Bir kampüse kampanya gönder
          </Link>
        </section>
      </div>
    </>
  );
}

function Universities() {
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState(null);
  const [search, setSearch] = useState('');
  const [onlyLive, setOnlyLive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', emailDomain: '' });
  const [editing, setEditing] = useState(null); // { id, name, emailDomain }

  const load = () =>
    adminApi
      .getUniversities()
      .then((res) => setList(res.data))
      .catch((err) => toast.error(errorText(err, 'Üniversiteler yüklenemedi.')));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return (list || []).filter(
      (u) =>
        (!onlyLive || u._count.users > 0) &&
        (!q || u.name.toLocaleLowerCase('tr-TR').includes(q) || (u.emailDomain || '').includes(q))
    );
  }, [list, search, onlyLive]);

  async function add(e) {
    e.preventDefault();
    try {
      await adminApi.createUniversity(form);
      toast.success(`${form.name} eklendi.`);
      setForm({ name: '', emailDomain: '' });
      setAdding(false);
      load();
    } catch (err) {
      toast.error(errorText(err, 'Üniversite eklenemedi.'));
    }
  }

  async function save() {
    try {
      await adminApi.updateUniversity(editing.id, { name: editing.name, emailDomain: editing.emailDomain });
      toast.success('Kaydedildi.');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(errorText(err, 'Kaydedilemedi.'));
    }
  }

  async function remove(u) {
    const ok = await confirm({ title: `${u.name} silinsin mi?`, message: 'Öğrencisi ya da kulübü olan üniversite silinemez.', confirmLabel: 'Sil', danger: true });
    if (!ok) return;
    try {
      await adminApi.deleteUniversity(u.id);
      toast.success('Silindi.');
      load();
    } catch (err) {
      toast.error(errorText(err, 'Silinemedi.'));
    }
  }

  return (
    <section className="adm-card">
      <div className="adm-toolbar">
        <label className="adm-search">
          <Search />
          <input className="adm-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Üniversite ya da alan adı ara" aria-label="Üniversite ara" />
        </label>
        <button type="button" className={`adm-chip ${onlyLive ? 'on' : ''}`} onClick={() => setOnlyLive((v) => !v)}>
          {onlyLive && <Check />} Yalnızca öğrencisi olanlar
        </button>
        <button type="button" className="adm-btn" onClick={() => setAdding((v) => !v)}>
          <Plus /> Üniversite ekle
        </button>
      </div>

      {adding && (
        <form onSubmit={add} className="adm-toolbar adm-note" style={{ alignItems: 'flex-end' }}>
          <label className="adm-field" style={{ flex: 2, minWidth: 200 }}>
            <span>Ad</span>
            <input className="adm-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ör. Örnek Üniversitesi" />
          </label>
          <label className="adm-field" style={{ flex: 1, minWidth: 160 }}>
            <span>Okul e-posta alan adı</span>
            <input className="adm-input" required value={form.emailDomain} onChange={(e) => setForm({ ...form, emailDomain: e.target.value })} placeholder="ornek.edu.tr" />
          </label>
          <button className="adm-btn" type="submit">Ekle</button>
        </form>
      )}

      <p className="adm-faint">Kayıt kodu yalnızca bu alan adıyla (ve alt alan adlarıyla) biten adreslere gönderilir.</p>

      {list === null ? (
        <Skeleton h={300} />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Üniversite</th>
                <th>Alan adı</th>
                <th className="num">Öğrenci</th>
                <th className="num hide-sm">Kulüp</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((u) =>
                editing?.id === u.id ? (
                  <tr key={u.id} className="selected">
                    <td><input className="adm-input" style={{ width: '100%' }} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Ad" /></td>
                    <td><input className="adm-input" value={editing.emailDomain || ''} onChange={(e) => setEditing({ ...editing, emailDomain: e.target.value })} aria-label="Alan adı" /></td>
                    <td className="num">{fmt(u._count.users)}</td>
                    <td className="num hide-sm">{fmt(u._count.clubs)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button type="button" className="adm-btn small icon" onClick={save} aria-label="Kaydet"><Check /></button>{' '}
                      <button type="button" className="adm-btn ghost small icon" onClick={() => setEditing(null)} aria-label="Vazgeç"><X /></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td className="adm-muted">{u.emailDomain || '-'}</td>
                    <td className="num">{fmt(u._count.users)}</td>
                    <td className="num hide-sm">{fmt(u._count.clubs)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button type="button" className="adm-btn ghost small icon" onClick={() => setEditing({ id: u.id, name: u.name, emailDomain: u.emailDomain })} aria-label={`${u.name} düzenle`}><Pencil /></button>{' '}
                      <button type="button" className="adm-btn danger-ghost small icon" onClick={() => remove(u)} aria-label={`${u.name} sil`}><Trash2 /></button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          {rows.length === 0 && <Empty>Eşleşen üniversite yok.</Empty>}
        </div>
      )}
    </section>
  );
}

function Departments() {
  const [list, setList] = useState(null);
  const [search, setSearch] = useState('');
  useEffect(() => {
    adminApi.getDepartments().then((res) => setList(res.data)).catch(() => setList([]));
  }, []);
  const rows = (list || []).filter((d) => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return !q || d.department.toLocaleLowerCase('tr-TR').includes(q) || d.university.name.toLocaleLowerCase('tr-TR').includes(q);
  });
  return (
    <section className="adm-card">
      <div className="adm-toolbar">
        <label className="adm-search">
          <Search />
          <input className="adm-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Bölüm ya da üniversite ara" aria-label="Bölüm ara" />
        </label>
      </div>
      <p className="adm-faint">Öğrencilerin kayıtta yazdığı bölümler, öğrenci sayısına göre.</p>
      {list === null ? (
        <Skeleton h={200} />
      ) : rows.length === 0 ? (
        <Empty>Bölüm bulunamadı.</Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Bölüm</th><th>Üniversite</th><th className="num">Öğrenci</th></tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={`${d.university.id}-${d.department}`}>
                  <td style={{ fontWeight: 600 }}>{d.department}</td>
                  <td className="adm-muted">{d.university.name}</td>
                  <td className="num">{fmt(d.studentCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminCampuses() {
  const [tab, setTab] = useState('performance');
  return (
    <div>
      <PageHead title="Kampüsler" sub="Hangi kampüs büyüyor, hangisi sessiz? Büyümeyi kampüs kampüs izle.">
        <Segmented label="Görünüm" value={tab} options={TABS} onChange={setTab} />
      </PageHead>
      {tab === 'performance' && <Performance />}
      {tab === 'universities' && <Universities />}
      {tab === 'departments' && <Departments />}
    </div>
  );
}
