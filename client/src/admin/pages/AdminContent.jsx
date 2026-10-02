import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, FileText, Heart, MessageCircle, Search, Trash2, Users } from 'lucide-react';
import adminApi, { errorText } from '../adminApi';
import { Empty, PageHead, Pager, Segmented, Skeleton, fmt, fmtDate, fmtDateTime } from '../ui';
import { buildFileUrl } from '../../api';
import ClubIcon from '../../components/ClubIcon';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

const TABS = [
  { value: 'posts', label: 'Gönderiler' },
  { value: 'clubs', label: 'Kulüpler' },
  { value: 'events', label: 'Etkinlikler' },
];

function useRemove() {
  const toast = useToast();
  const confirm = useConfirm();
  return async (what, fn, after) => {
    const ok = await confirm({ title: `${what} silinsin mi?`, message: 'Bu işlem geri alınamaz.', confirmLabel: 'Sil', danger: true });
    if (!ok) return;
    try {
      const res = await fn();
      toast.success(res.data?.message || 'Silindi.');
      after();
    } catch (err) {
      toast.error(errorText(err, 'Silinemedi.'));
    }
  };
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="adm-toolbar">
      <label className="adm-search">
        <Search />
        <input className="adm-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </label>
    </div>
  );
}

function Posts() {
  const remove = useRemove();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    adminApi.getPosts({ search: query, page, pageSize: 20 }).then((res) => setData(res.data)).catch(() => setData({ posts: [], total: 0 }));
  }, [query, page]);
  useEffect(load, [load]);

  return (
    <section className="adm-card">
      <SearchBox value={search} onChange={setSearch} placeholder="Açıklama ya da yazar ara" />
      {!data ? (
        <Skeleton h={240} />
      ) : data.posts.length === 0 ? (
        <Empty icon={FileText}>Gönderi yok.</Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Gönderi</th><th className="hide-sm">Yazar</th><th className="num">Etkileşim</th><th className="hide-sm">Tarih</th><th /></tr>
            </thead>
            <tbody>
              {data.posts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="adm-person">
                      {p.imageUrl ? <img className="adm-avatar" style={{ borderRadius: 8 }} src={buildFileUrl(p.imageUrl)} alt="" loading="lazy" /> : <span className="adm-avatar" style={{ borderRadius: 8 }}><FileText size={14} /></span>}
                      <span className="adm-ellipsis">{p.caption || <span className="adm-faint">Açıklamasız</span>}</span>
                    </span>
                  </td>
                  <td className="hide-sm">
                    {p.author?.fullName}
                    <span className="adm-person-meta">{p.author?.university?.name}</span>
                  </td>
                  <td className="num adm-muted" style={{ whiteSpace: 'nowrap' }}>
                    <Heart size={12} /> {fmt(p._count.likes)} · <MessageCircle size={12} /> {fmt(p._count.comments)}
                  </td>
                  <td className="hide-sm adm-muted">{fmtDate(p.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="adm-btn danger-ghost small icon" aria-label="Gönderiyi sil" onClick={() => remove('Gönderi', () => adminApi.deletePost(p.id), load)}>
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > 20 && <Pager page={page} total={data.total} pageSize={20} onPage={setPage} />}
    </section>
  );
}

function Clubs() {
  const remove = useRemove();
  const [search, setSearch] = useState('');
  const [list, setList] = useState(null);

  const load = useCallback(() => {
    adminApi.getClubs({ search: search.trim() }).then((res) => setList(res.data)).catch(() => setList([]));
  }, [search]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <section className="adm-card">
      <SearchBox value={search} onChange={setSearch} placeholder="Kulüp ya da üniversite ara" />
      {!list ? (
        <Skeleton h={240} />
      ) : list.length === 0 ? (
        <Empty icon={Users}>Kulüp yok.</Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Kulüp</th><th className="hide-sm">Kurucu</th><th className="num">Üye</th><th className="num hide-sm">Etkinlik</th><th className="num hide-sm">Mesaj</th><th /></tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="adm-person">
                      <ClubIcon value={c.iconEmoji} category={c.category} size={34} />
                      <span style={{ minWidth: 0 }}>
                        <span className="adm-person-name">{c.name}</span>
                        <span className="adm-person-meta">{c.category} · {c.university?.name}</span>
                      </span>
                    </span>
                  </td>
                  <td className="hide-sm adm-muted">{c.creator?.fullName}<span className="adm-person-meta">{fmtDate(c.createdAt)}</span></td>
                  <td className="num">{fmt(c._count.memberships)}</td>
                  <td className="num hide-sm">{fmt(c._count.events)}</td>
                  <td className="num hide-sm">{fmt(c._count.messages)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="adm-btn danger-ghost small icon" aria-label={`${c.name} sil`} onClick={() => remove(`${c.name} kulübü (üyelikler, sohbet ve etkinlikler dahil)`, () => adminApi.deleteClub(c.id), load)}>
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Events() {
  const remove = useRemove();
  const [scope, setScope] = useState('upcoming');
  const [list, setList] = useState(null);
  const load = useCallback(() => {
    setList(null);
    adminApi.getEvents(scope).then((res) => setList(res.data)).catch(() => setList([]));
  }, [scope]);
  useEffect(load, [load]);

  return (
    <section className="adm-card">
      <div className="adm-toolbar">
        <Segmented label="Zaman" value={scope} options={[{ value: 'upcoming', label: 'Yaklaşan' }, { value: 'past', label: 'Geçmiş' }]} onChange={setScope} />
      </div>
      {!list ? (
        <Skeleton h={200} />
      ) : list.length === 0 ? (
        <Empty icon={CalendarDays}>{scope === 'upcoming' ? 'Yaklaşan etkinlik yok.' : 'Geçmiş etkinlik yok.'}</Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Etkinlik</th><th className="hide-sm">Kulüp</th><th>Tarih</th><th className="num">Katılım</th><th /></tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="adm-person-name">{e.title}</span>
                    {e.location && <span className="adm-person-meta">{e.location}</span>}
                  </td>
                  <td className="hide-sm adm-muted">{e.club?.name}<span className="adm-person-meta">{e.club?.university?.name}</span></td>
                  <td className="adm-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.startsAt)}</td>
                  <td className="num">{fmt(e._count.rsvps)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="adm-btn danger-ghost small icon" aria-label={`${e.title} sil`} onClick={() => remove(`"${e.title}" etkinliği`, () => adminApi.deleteEvent(e.id), load)}>
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminContent() {
  const [tab, setTab] = useState('posts');
  return (
    <div>
      <PageHead title="İçerik" sub="Gönderileri, kulüpleri ve etkinlikleri gözden geçir; kurallara aykırı olanları kaldır.">
        <Segmented label="İçerik türü" value={tab} options={TABS} onChange={setTab} />
      </PageHead>
      {tab === 'posts' && <Posts />}
      {tab === 'clubs' && <Clubs />}
      {tab === 'events' && <Events />}
    </div>
  );
}
