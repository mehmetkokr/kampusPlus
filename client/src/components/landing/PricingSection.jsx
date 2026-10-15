import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Crown, Heart, Rocket, Star } from '../icons';
import api from '../../api';
import Reveal from './Reveal';
import { useI18n } from '../../i18n';
import { PLAN_BADGE, PLAN_ORDER, PERIOD_LABEL, formatTL, savingVsWeekly } from '../../lib/premium';

// "Planlar" bölümü: Ücretsiz + haftalık / aylık / yıllık Premium. Yalnızca
// uygulamada gerçekten çalışan haklar yazılır; fiyat, günlük beğeni ve boost
// sayıları sunucudan gelir (/api/premium/plans). Ödeme henüz açık değilse
// Premium kartlarında "Çok yakında" görünür.
const FREE = ['Kendi kampüsünde keşfet ve Kart Modu', 'Eşleşme ve sınırsız sohbet', 'Kulüpler, akış, hikâyeler ve etkinlikler', 'Onaylı öğrenci rozeti'];
const PREMIUM = [
  "Türkiye'deki tüm üniversitelerden kişileri keşfet",
  'Seni kimlerin beğendiğini gör',
  'Gizli mod ve gelişmiş filtreler',
  'Kart Modu’nda son kararını geri al',
];

function Feature({ children, tone }) {
  return (
    <li className="flex gap-3 text-[0.9375rem] leading-snug text-paper">
      <span className={`landing-price-check ${tone}`} aria-hidden="true">
        <Check size={13} />
      </span>
      {children}
    </li>
  );
}

export default function PricingSection() {
  const { t } = useI18n();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .get('/premium/plans')
      .then((res) => alive && setInfo(res.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const plans = PLAN_ORDER.map((key) => info?.plans?.find((p) => p.key === key)).filter(Boolean);
  const open = info?.checkoutAvailable === true;

  return (
    <section id="premium" className="relative scroll-mt-20 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="landing-eyebrow">{t('Planlar')}</p>
          <h2 className="landing-h2 mt-3">
            {t('Kampüsün ücretsiz.')} <span className="landing-gradient-text">{t('Türkiye Premium’da.')}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed text-paper-muted">
            {t('Tanışmak, sohbet etmek ve kulüplere katılmak her zaman ücretsiz. Premium daha fazla beğeni, Boost ve tüm Türkiye için.')}
          </p>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Ücretsiz */}
          <Reveal className="landing-card flex flex-col p-6">
            <h3 className="text-[1.125rem] font-bold tracking-[-0.01em] text-paper">{t('Ücretsiz')}</h3>
            <p className="mt-1 text-[0.9063rem] text-paper-muted">{t('Kampüsündeki herkesle tanış.')}</p>
            <p className="mt-5 flex items-baseline gap-1.5">
              <span className="landing-price">₺0</span>
              <span className="text-[0.875rem] text-paper-muted">{t('her zaman')}</span>
            </p>
            <p className="mt-1 min-h-[1.25rem]" />
            <ul className="landing-price-perks mt-3">
              <li>
                <Heart size={15} /> {t('Günde {n} beğeni', { n: info?.freeDailyLikes ?? 5 })}
              </li>
            </ul>
            <ul className="mt-5 space-y-3">
              {FREE.map((f) => (
                <Feature key={f} tone="is-free">
                  {t(f)}
                </Feature>
              ))}
            </ul>
            <div className="mt-auto pt-7">
              <Link to="/register" className="landing-btn-secondary w-full">
                {t('Ücretsiz katıl')}
              </Link>
            </div>
          </Reveal>

          {/* Premium planları */}
          {(plans.length ? plans : PLAN_ORDER.map((key) => ({ key }))).map((p, i) => {
            const saving = savingVsWeekly(plans, p.key);
            const featured = p.key === 'monthly';
            return (
              <Reveal key={p.key} delay={(i + 1) * 0.06} className={`${featured ? 'landing-price-premium' : 'landing-card'} relative flex flex-col p-6`}>
                {PLAN_BADGE[p.key] && <span className="landing-price-badge">{t(PLAN_BADGE[p.key])}</span>}
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-[1.125rem] font-bold tracking-[-0.01em] text-paper">
                    <Crown size={18} weight="fill" className="text-amber" aria-hidden="true" />
                    {t(p.label || { weekly: 'Haftalık', monthly: 'Aylık', yearly: 'Yıllık' }[p.key])}
                  </h3>
                  {info && !open && <span className="landing-price-soon">{t('Çok yakında')}</span>}
                </div>
                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className="landing-price">{formatTL(p.amount)}</span>
                  <span className="text-[0.875rem] text-paper-muted">{t(PERIOD_LABEL[p.key])}</span>
                </p>
                <p className="mt-1 min-h-[1.25rem] text-[0.8125rem] text-paper-faint">
                  {saving ? t('Haftalığa göre %{n} daha uygun', { n: saving }) : ''}
                </p>
                <ul className="landing-price-perks mt-3">
                  <li>
                    <Heart size={15} weight="fill" /> {p.dailyLikes === null ? t('Sınırsız beğeni') : t('Günde {n} beğeni', { n: p.dailyLikes ?? '—' })}
                  </li>
                  <li>
                    <Star size={15} weight="fill" /> {t('Günde {n} Süper Beğeni', { n: p.dailySuperLikes ?? '—' })}
                  </li>
                  <li>
                    <Rocket size={15} weight="fill" /> {t('{n} Boost', { n: p.boosts ?? '—' })}
                  </li>
                </ul>
                <ul className="mt-5 space-y-3">
                  {PREMIUM.map((f) => (
                    <Feature key={f} tone="is-premium">
                      {t(f)}
                    </Feature>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <Link to="/register" className={`${featured ? 'landing-btn-primary' : 'landing-btn-secondary'} group w-full`}>
                    {open ? t('Katıl ve Premium’a geç') : t('Ücretsiz katıl')}
                    {featured && <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-[0.8438rem] leading-relaxed text-paper-faint">
          {t('Her Boost profilini {m} dakika boyunca kampüsünde en üste taşır.', { m: info?.boostMinutes ?? 30 })}{' '}
          {t('Ücretler vergiler dahildir. Premium dönem sonunda otomatik yenilenir, Ayarlar’dan istediğin an kapatabilirsin. Ayrıntılar')}{' '}
          <Link to="/mesafeli-satis-sozlesmesi" className="underline underline-offset-2 hover:text-paper">
            {t('Mesafeli Satış Sözleşmesi')}
          </Link>
          {t('’nde.')}
        </p>
      </div>
    </section>
  );
}
