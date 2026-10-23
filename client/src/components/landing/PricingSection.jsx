import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Heart, Rocket, Star } from '../icons';
import { FeatureComparison, PlanIcon } from '../Membership';
import api from '../../api';
import Reveal from './Reveal';
import { useI18n } from '../../i18n';
import { PLAN_BADGE, PLAN_HIGHLIGHTS, PLAN_ORDER, PERIOD_LABEL, formatTL } from '../../lib/premium';

// "Planlar" bölümü: iki ücretli üyelik, Plus (temel) ve Premium (kapsamlı).
// Yalnızca uygulamada gerçekten çalışan haklar yazılır; fiyat, günlük beğeni
// ve boost sayıları sunucudan gelir (/api/premium/plans). Ödeme henüz açık
// değilse kartlarda "Çok yakında" görünür.
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
            {t('İki üyelik,')} <span className="landing-gradient-text">{t('sana uygun olanı seç.')}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed text-paper-muted">
            {t('Uygulamanın temeli herkese açık: kayıt, eşleşme, sohbet, akış ve kulüpler. Plus ile Kart Modu’nu başka üniversitelere taşırsın; Premium ile seni beğenenleri görür, sınırsız beğenir ve destelerde öne çıkarsın.')}
          </p>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-3xl items-stretch gap-4 md:grid-cols-2">
          {(plans.length ? plans : PLAN_ORDER.map((key) => ({ key }))).map((p, i) => {
            const featured = p.key === 'premium';
            return (
              <Reveal key={p.key} delay={i * 0.06} className={`${featured ? 'landing-price-premium' : 'landing-card'} relative flex flex-col p-6`}>
                {PLAN_BADGE[p.key] && <span className="landing-price-badge">{t(PLAN_BADGE[p.key])}</span>}
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-[1.125rem] font-bold tracking-[-0.01em] text-paper">
                    <PlanIcon plan={p.key} size={18} className={featured ? 'text-brand' : ''} />
                    {t(p.label || { plus: 'Plus', premium: 'Premium' }[p.key])}
                  </h3>
                  {info && !open && <span className="landing-price-soon">{t('Çok yakında')}</span>}
                </div>
                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className="landing-price">{formatTL(p.amount)}</span>
                  <span className="text-[0.875rem] text-paper-muted">{t(PERIOD_LABEL[p.key])}</span>
                </p>
                <ul className="landing-price-perks mt-4">
                  <li>
                    <Heart size={15} weight="fill" /> {p.dailyLikes === null ? t('Sınırsız beğeni') : t('Günde {n} beğeni', { n: p.dailyLikes ?? '—' })}
                  </li>
                  <li>
                    <Star size={15} weight="fill" /> {t('Günde {n} Süper Beğeni', { n: p.dailySuperLikes ?? '—' })}
                  </li>
                  <li>
                    <Rocket size={15} weight="fill" /> {t('Ayda {n} Boost', { n: p.boosts ?? '—' })}
                  </li>
                </ul>
                <ul className="mt-5 space-y-3">
                  {PLAN_HIGHLIGHTS[p.key].map((f) => (
                    <Feature key={f} tone="is-premium">
                      {t(f)}
                    </Feature>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <Link to="/register" className={`${featured ? 'landing-btn-primary' : 'landing-btn-secondary'} group w-full`}>
                    {open ? t('Katıl ve {plan}’a geç', { plan: t(p.label || '') }) : t('Hemen katıl')}
                    {featured && <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
        {/* Ayrıntılı karşılaştırma: her satır uygulamada çalışan bir hak */}
        <Reveal className="mx-auto mt-12 max-w-3xl">
          <h3 className="text-center text-[1.125rem] font-bold tracking-[-0.01em] text-paper">{t('Plus ve Premium karşılaştırması')}</h3>
          <FeatureComparison plans={plans} />
        </Reveal>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[0.8438rem] leading-relaxed text-paper-faint">
          {t('Her Boost profilini {m} dakika boyunca kampüsünde en üste taşır.', { m: info?.boostMinutes ?? 30 })}{' '}
          {t('Ücretler vergiler dahildir. Üyelik 30 gün sürer ve aynı planla her ay yenilenir; yenilemeyi Ayarlar’dan istediğin an kapatabilirsin, üyeliğin dönem sonuna kadar devam eder. Ayrıntılar')}{' '}
          <Link to="/mesafeli-satis-sozlesmesi" className="underline underline-offset-2 hover:text-paper">
            {t('Mesafeli Satış Sözleşmesi')}
          </Link>
          {t('’nde.')}
        </p>
      </div>
    </section>
  );
}
