import React from 'react';
import { Check, Gem, Minus, ZapIcon } from './icons';
import { useI18n } from '../i18n';
import { FEATURE_ROWS, formatTL, PERIOD_LABEL, PLAN_ORDER } from '../lib/premium';
import '../styles/membership.css';

// Üyelik görselleri tek yerde: Plus şimşek, Premium elmas.

export function PlanIcon({ plan, size = 18, className = '', ...rest }) {
  const Icon = plan === 'plus' ? ZapIcon : Gem;
  return <Icon size={size} weight="fill" className={className} aria-hidden="true" {...rest} />;
}

// Profilde ve kartlarda görünen küçük rozet ("⚡ Plus" / "◆ Premium")
export function MembershipBadge({ plan, className = '' }) {
  const { t } = useI18n();
  if (!plan) return null;
  return (
    <span className={`membership-badge is-${plan} ${className}`}>
      <PlanIcon plan={plan} size={11} /> {plan === 'plus' ? t('Plus') : t('Premium')}
    </span>
  );
}

// Plus ve Premium karşılaştırma tablosu: her satır gerçekten çalışan bir hak.
// plans: sunucudan gelen plan listesi (fiyat ve sayılar oradan); current: kullanıcının planı
export function FeatureComparison({ plans = [], current = null }) {
  const { t } = useI18n();
  const byKey = Object.fromEntries(plans.map((p) => [p.key, p]));
  const cell = (row, key) => {
    const v = row[key];
    if (typeof v === 'function') return <span className="fc-value">{t(...v(byKey[key]))}</span>;
    return v ? (
      <span className="fc-yes">
        <Check size={15} aria-hidden="true" />
        <span className="sr-only">{t('Var')}</span>
      </span>
    ) : (
      <span className="fc-no">
        <Minus size={15} aria-hidden="true" />
        <span className="sr-only">{t('Yok')}</span>
      </span>
    );
  };
  return (
    <div className="fc-wrap">
      <table className="fc-table">
        <caption className="sr-only">{t('Plus ve Premium karşılaştırması')}</caption>
        <thead>
          <tr>
            <th scope="col" className="fc-feature-head">{t('Özellik')}</th>
            {PLAN_ORDER.map((key) => (
              <th key={key} scope="col" className={`fc-plan is-${key} ${current === key ? 'is-current' : ''}`}>
                <span className="fc-plan-name">
                  <PlanIcon plan={key} size={14} /> {key === 'plus' ? 'Plus' : 'Premium'}
                </span>
                <span className="fc-plan-price">
                  {formatTL(byKey[key]?.amount)}
                  <small>{t(PERIOD_LABEL[key])}</small>
                </span>
                {current === key && <span className="fc-current">{t('Planın')}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_ROWS.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                <span className="fc-label">{t(row.label)}</span>
                <span className="fc-desc">{t(row.desc)}</span>
              </th>
              <td className={current === 'plus' ? 'is-current' : ''}>{cell(row, 'plus')}</td>
              <td className={current === 'premium' ? 'is-current' : ''}>{cell(row, 'premium')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
