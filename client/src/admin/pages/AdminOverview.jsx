import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CalendarCheck,
  ChevronRight,
  Flag,
  Heart,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
  Wifi,
} from 'lucide-react';
import adminApi, { errorText } from '../adminApi';
import { CLASS_LABELS, INTENT_LABELS, Kpi, PageHead, PERIODS, Ring, Segmented, Skeleton, fmt, fmtMoney } from '../ui';
import { BarList, Funnel, LineChart } from '../charts';

const SERIES = [
  { key: 'signups', label: 'Yeni kayıt', color: 'var(--adm-c1)' },
  { key: 'matches', label: 'Eşleşme', color: 'var(--adm-c2)' },
  { key: 'messages', label: 'Mesaj', color: 'var(--adm-c3)' },
];

// Dönemi hatırla (sayfalar arası geçişte aynı kalsın)
export function usePeriod() {
  const [days, setDays] = useState(() => {
    try {
      return Number(sessionStorage.getItem('adm-days')) || 30;
    } catch {
      return 30;
    }
  });
  const set = (d) => {
    setDays(d);
    try {
      sessionStorage.setItem('adm-days', String(d));
    } catch {
      // yok say
    }
  };
  return [days, set];
}

export default function AdminOverview() {
  const [days, setDays] = usePeriod();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    adminApi
      .getOverview(days)
      .then((res) => alive && setData(res.data))
      .catch((err) => alive && setError(errorText(err, 'Genel bakış yüklenemedi.')));
    return () => {
      alive = false;
    };
  }, [days]);

  const k = data?.kpis;
  const a = data?.actions;
  const loading = !data || data.days !== days;

  return (
    <div>
      <PageHead title="Genel Bakış" sub="Büyüme, etkileşim ve gelirin özeti. Oklar bir önceki eşit dönemle karşılaştırır.">
        <Segmented label="Dönem" value={days} options={PERIODS} onChange={setDays} />
        <Link to="/admin/campaigns" className="adm-btn">
          <Megaphone /> Kampanya oluştur
        </Link>
      </PageHead>

      {error && <div className="adm-error">{error}</div>}

      <div className="adm-grid adm-grid-kpi">
        {loading ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={118} />)
        ) : (
          <>
            <Kpi icon={UserPlus} label="Yeni kayıt" kpi={k.newUsers} color="var(--adm-c1)" />
            <Kpi icon={Activity} label="Aktif öğrenci" kpi={k.activeUsers} color="var(--adm-c2)" />
            <Kpi icon={Heart} label="Eşleşme" kpi={k.matches} color="var(--adm-c1)" />
            <Kpi icon={MessageCircle} label="Mesaj" kpi={k.messages} color="var(--adm-c3)" />
            <Kpi icon={CalendarCheck} label="Kulüp katılımı" kpi={k.clubJoins} color="var(--adm-c2)" />
            <Kpi icon={Wallet} label="Gelir" kpi={k.revenue} format={fmtMoney} color="var(--adm-c1)" />
          </>
        )}
      </div>

      <div className="adm-grid adm-grid-main" style={{ marginTop: 14 }}>
        <section className="adm-card">
          <h2 className="adm-card-title">Günlük hareket</h2>
          <p className="adm-card-sub">Seriyi gizlemek ya da göstermek için üstteki etiketlere dokun.</p>
          {loading ? <Skeleton h={260} /> : <LineChart data={data.series} series={SERIES} />}
        </section>

        <section className="adm-card">
          <h2 className="adm-card-title">Bugün yapılacaklar</h2>
          <p className="adm-card-sub">Bekleyen işler ve anlık durum.</p>
          {loading ? (
            <Skeleton h={240} />
          ) : (
            <div className="adm-todo">
              <Link to="/admin/verification-queue" style={{ '--c': 'var(--adm-c3)' }}>
                <span className="ic"><ShieldCheck /></span> Onay bekleyen belge
                <span className="v">{fmt(a.pendingVerifications)}</span>
                <ChevronRight className="chev" />
              </Link>
              <Link to="/admin/reports" style={{ '--c': 'var(--adm-down)' }}>
                <span className="ic"><Flag /></span> Bekleyen şikayet
                <span className="v">{fmt(a.pendingReports)}</span>
                <ChevronRight className="chev" />
              </Link>
              <Link to="/admin/campaigns" style={{ '--c': 'var(--adm-c1)' }}>
                <span className="ic"><Megaphone /></span> Yayındaki duyuru bandı
                <span className="v">{fmt(a.activeBanners)}</span>
                <ChevronRight className="chev" />
              </Link>
              <Link to="/admin/users?joined=1" style={{ '--c': 'var(--adm-c2)' }}>
                <span className="ic"><Users /></span> Bugün katılan
                <span className="v">{fmt(a.newToday)}</span>
                <ChevronRight className="chev" />
              </Link>
              <div className="row" style={{ '--c': 'var(--adm-up)' }}>
                <span className="ic"><Wifi /></span> Şu an çevrimiçi
                <span className="v">{fmt(a.onlineNow)}</span>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="adm-grid adm-grid-2" style={{ marginTop: 14 }}>
        <section className="adm-card">
          <h2 className="adm-card-title">Aktivasyon hunisi</h2>
          <p className="adm-card-sub">Bu dönemde kayıt olanlar ilk adımları ne kadar tamamladı? En çok kaybın olduğu adım, kampanyanın hedefidir.</p>
          {loading ? <Skeleton h={280} /> : data.funnel[0].count === 0 ? <p className="adm-muted">Bu dönemde yeni kayıt yok.</p> : <Funnel steps={data.funnel} />}
        </section>

        <section className="adm-card">
          <h2 className="adm-card-title">Geri dönüş oranı</h2>
          <p className="adm-card-sub">Kayıttan 1, 7 ve 30 gün sonra uygulamayı hâlâ açan öğrencilerin oranı.</p>
          {loading ? (
            <Skeleton h={200} />
          ) : (
            <div className="adm-grid" style={{ gap: 18 }}>
              {data.retention.map((r, i) => (
                <div key={r.day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <Ring value={r.rate} label={`${r.day}. gün`} color={['var(--adm-c1)', 'var(--adm-c2)', 'var(--adm-c3)'][i]} />
                  <span className="adm-faint" style={{ textAlign: 'right' }}>
                    {r.eligible ? `${fmt(r.returned)} / ${fmt(r.eligible)} öğrenci` : 'Henüz yeterli süre geçmedi'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <h2 className="adm-section-title">Kitle profili</h2>
      <div className="adm-grid adm-grid-3">
        <section className="adm-card">
          <h3 className="adm-card-title">Ne arıyorlar?</h3>
          <p className="adm-card-sub">Kampanya mesajını bu ihtiyaçlara göre yaz.</p>
          {loading ? <Skeleton h={220} /> : <BarList items={data.audience.intents.slice(0, 8)} labelFor={(key) => INTENT_LABELS[key] || key} total={data.audience.total} />}
        </section>
        <section className="adm-card">
          <h3 className="adm-card-title">En popüler ilgi alanları</h3>
          <p className="adm-card-sub">Etkinlik ve kulüp önerileri için ipucu.</p>
          {loading ? (
            <Skeleton h={220} />
          ) : data.audience.interests.length ? (
            <BarList items={data.audience.interests.slice(0, 8)} color="var(--adm-c2)" labelFor={(key) => key.charAt(0).toLocaleUpperCase('tr-TR') + key.slice(1)} />
          ) : (
            <p className="adm-muted">Henüz ilgi alanı girilmemiş.</p>
          )}
        </section>
        <section className="adm-card">
          <h3 className="adm-card-title">Sınıf ve yaş</h3>
          <p className="adm-card-sub">
            {loading ? '…' : `Rozetli öğrenci %${data.audience.badgeRate} · Aktif Premium ${fmt(data.audience.premiumActive)}`}
          </p>
          {loading ? (
            <Skeleton h={220} />
          ) : (
            <div className="adm-grid" style={{ gap: 16 }}>
              <BarList items={data.audience.classYears} color="var(--adm-c3)" labelFor={(key) => CLASS_LABELS[key] || `${key}. sınıf`} total={data.audience.total} />
              {data.audience.ages.length > 0 && <BarList items={data.audience.ages} color="var(--adm-c1)" labelFor={(key) => `${key} yaş`} total={data.audience.total} />}
            </div>
          )}
        </section>
      </div>

      {!loading && (
        <div className="adm-grid adm-grid-kpi" style={{ marginTop: 14 }}>
          <Kpi label="Beğeni (kaydırma)" kpi={k.likes} color="var(--adm-c1)" />
          <Kpi label="Gönderi" kpi={k.posts} color="var(--adm-c3)" />
          <Kpi label="Etkinliğe katılım" kpi={k.rsvps} color="var(--adm-c2)" />
          <Kpi label="Ödeme sayısı" kpi={k.payments} color="var(--adm-c1)" />
        </div>
      )}
    </div>
  );
}
