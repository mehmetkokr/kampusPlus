import React, { useEffect, useState } from 'react';
import { BellRing, Eye, MousePointerClick, Smartphone, UserPlus, Users } from 'lucide-react';
import adminApi, { errorText } from '../adminApi';
import { Kpi, PageHead, PERIODS, Segmented, Skeleton, fmt } from '../ui';
import { BarList, Funnel, LineChart } from '../charts';
import { usePeriod } from './AdminOverview';

const SERIES = [
  { key: 'visitors', label: 'Tekil ziyaretçi', color: 'var(--adm-c1)' },
  { key: 'users', label: 'Giriş yapmış öğrenci', color: 'var(--adm-c2)' },
];

// Sayfa yollarının okunur adları
const PAGE_LABELS = {
  '/': 'Tanıtım sayfası',
  '/login': 'Giriş',
  '/register': 'Kayıt',
  '/welcome': 'Hoş geldin',
  '/discover': 'Keşfet',
  '/discover/swipe': 'Kart Modu',
  '/feed': 'Akış',
  '/clubs': 'Kulüpler',
  '/clubs/:id': 'Kulüp detayı',
  '/matches': 'Sohbetler',
  '/chat/:id': 'Sohbet',
  '/profile': 'Profilim',
  '/settings': 'Ayarlar',
  '/notifications': 'Bildirimler',
  '/users/:id': 'Profil görüntüleme',
  '/forgot-password': 'Şifremi unuttum',
};

export default function AdminAnalytics() {
  const [days, setDays] = usePeriod();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    adminApi
      .getAnalytics(days)
      .then((res) => alive && setData(res.data))
      .catch((err) => alive && setError(errorText(err, 'Analitik yüklenemedi.')));
    return () => {
      alive = false;
    };
  }, [days]);

  const loading = !data || data.days !== days;
  const k = data?.kpis;
  const p = data?.premium;

  return (
    <div>
      <PageHead
        title="Analitik"
        sub="Ziyaretçilerin sitede nasıl ilerlediği. Veriler kendi sunucumuzda tutulur; IP ve cihaz bilgisi kaydedilmez."
      >
        <Segmented label="Dönem" value={days} options={PERIODS} onChange={setDays} />
      </PageHead>

      {error && <div className="adm-error">{error}</div>}

      <div className="adm-grid adm-grid-kpi">
        {loading ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={104} />)
        ) : (
          <>
            <Kpi icon={Users} label="Tekil ziyaretçi" value={k.visitors} />
            <Kpi icon={Eye} label="Sayfa görüntüleme" value={k.pageViews} />
            <Kpi icon={UserPlus} label="Yeni hesap" value={k.signups} />
            <Kpi icon={MousePointerClick} label="Aktif öğrenci" value={k.activeUsers} />
            <Kpi icon={BellRing} label="Bildirimi açık öğrenci" value={k.pushUsers} />
            <Kpi icon={Smartphone} label="Ana ekrana yükleme" value={k.pwaInstalls} />
          </>
        )}
      </div>

      <section className="adm-card" style={{ marginTop: 14 }}>
        <h2 className="adm-card-title">Günlük ziyaret</h2>
        <p className="adm-card-sub">Siteyi açan tekil ziyaretçiler ve bunlardan giriş yapmış öğrenciler.</p>
        {loading ? <Skeleton h={260} /> : <LineChart data={data.series} series={SERIES} />}
      </section>

      <div className="adm-grid adm-grid-2" style={{ marginTop: 14 }}>
        <section className="adm-card">
          <h2 className="adm-card-title">Kayıt hunisi</h2>
          <p className="adm-card-sub">Ziyaretten ilk beğeniye kadar. En çok kaybın olduğu adım, iyileştirilecek ilk yerdir.</p>
          {loading ? (
            <Skeleton h={280} />
          ) : data.funnel[0].count === 0 ? (
            <p className="adm-muted">Bu dönemde henüz ziyaret kaydı yok.</p>
          ) : (
            <Funnel steps={data.funnel} />
          )}
        </section>

        <section className="adm-card">
          <h2 className="adm-card-title">En çok açılan sayfalar</h2>
          <p className="adm-card-sub">Görüntülenme sayısı; yüzde, toplam görüntülenmeye oranı.</p>
          {loading ? (
            <Skeleton h={280} />
          ) : data.pages.length === 0 ? (
            <p className="adm-muted">Henüz kayıt yok.</p>
          ) : (
            <BarList
              items={data.pages.map((pg) => ({ key: pg.path, count: pg.views }))}
              labelFor={(path) => PAGE_LABELS[path] || path}
              color="var(--adm-c2)"
              total={k.pageViews}
            />
          )}
        </section>
      </div>

      <section className="adm-card" style={{ marginTop: 14 }}>
        <h2 className="adm-card-title">Premium dönüşümü</h2>
        <p className="adm-card-sub">Premium penceresini gören, satın almaya tıklayan ve ödemesi tamamlanan öğrenciler.</p>
        {loading ? (
          <Skeleton h={140} />
        ) : (
          <Funnel
            steps={[
              { key: 'view', label: 'Premium penceresini gördü', count: p.paywallViews, rate: 100 },
              { key: 'click', label: 'Satın almaya tıkladı', count: p.checkoutClicks, rate: p.paywallViews ? Math.round((p.checkoutClicks / p.paywallViews) * 1000) / 10 : 0 },
              { key: 'buy', label: 'Ödeme tamamlandı', count: p.purchases, rate: p.paywallViews ? Math.round((p.purchases / p.paywallViews) * 1000) / 10 : 0 },
            ]}
          />
        )}
        {!loading && p.paywallViews === 0 && <p className="adm-muted" style={{ marginTop: 8 }}>Bu dönemde Premium penceresi açılmadı.</p>}
      </section>

      {!loading && (
        <p className="adm-muted" style={{ marginTop: 14, fontSize: 13 }}>
          Ziyaretçi, tarayıcıda üretilen rastgele bir kimlikle sayılır; aynı kişi farklı cihazlarda ayrı sayılabilir. Olaylar 180 gün saklanır. Toplam {fmt(k.pageViews)} görüntüleme.
        </p>
      )}
    </div>
  );
}
