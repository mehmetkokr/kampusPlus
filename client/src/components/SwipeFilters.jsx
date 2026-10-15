import React, { useState } from 'react';
import { X } from './icons';
import Select from './Select';
import { INTENT_OPTIONS } from '../constants/intents';
import { useI18n } from '../i18n';

// Kart Modu gelişmiş filtreleri (Premium): yaş aralığı, sınıf, ne arıyor.
// Seçim bu cihazda hatırlanır; sunucu Premium olmayan istekte filtreleri yok sayar.
const STORE_KEY = 'kp-swipe-filters';
const EMPTY = { minAge: '', maxAge: '', classYear: '', intent: '' };
const AGES = Array.from({ length: 18 }, (_, i) => String(18 + i)); // 18–35

export function readSavedFilters() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return EMPTY;
  }
}

export const activeFilterCount = (f) => ['minAge', 'maxAge', 'classYear', 'intent'].filter((k) => f[k]).length - (f.minAge && f.maxAge ? 1 : 0);

export const filterParams = (f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v));

export default function SwipeFilters({ value, onApply, onClose }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  const set = (key) => (v) =>
    setDraft((d) => {
      const next = { ...d, [key]: v };
      // Alt sınır üst sınırı geçmesin
      if (next.minAge && next.maxAge && Number(next.minAge) > Number(next.maxAge)) {
        if (key === 'minAge') next.maxAge = v;
        else next.minAge = v;
      }
      return next;
    });

  function apply(next) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      // gizli sekme: yalnızca bu oturumda geçerli
    }
    onApply(next);
  }

  const ageOptions = [{ value: '', label: t('Farketmez') }, ...AGES.map((a) => ({ value: a, label: a }))];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet swipe-filters" role="dialog" aria-modal="true" aria-labelledby="swipe-filters-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="swipe-filters-title">{t('Filtreler')}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('Kapat')}>
            <X size={16} />
          </button>
        </div>

        <span className="swipe-filters-label" id="swipe-filter-age">
          {t('Yaş aralığı')}
        </span>
        <div className="swipe-filters-row" role="group" aria-labelledby="swipe-filter-age">
          <Select value={draft.minAge} onChange={set('minAge')} options={ageOptions} aria-label={t('En küçük yaş')} placeholder={t('En az')} />
          <span aria-hidden="true">–</span>
          <Select value={draft.maxAge} onChange={set('maxAge')} options={ageOptions} aria-label={t('En büyük yaş')} placeholder={t('En fazla')} />
        </div>

        <label className="swipe-filters-label" htmlFor="swipe-filter-class">
          {t('Sınıf')}
        </label>
        <Select
          id="swipe-filter-class"
          value={draft.classYear}
          onChange={set('classYear')}
          options={[
            { value: '', label: t('Farketmez') },
            { value: '1', label: t('1. Sınıf') },
            { value: '2', label: t('2. Sınıf') },
            { value: '3', label: t('3. Sınıf') },
            { value: '4', label: t('4. Sınıf') },
            { value: '5', label: t('Yüksek Lisans / Diğer') },
          ]}
        />

        <label className="swipe-filters-label" htmlFor="swipe-filter-intent">
          {t('Ne arıyor?')}
        </label>
        <Select
          id="swipe-filter-intent"
          value={draft.intent}
          onChange={set('intent')}
          options={[{ value: '', label: t('Farketmez') }, ...INTENT_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))]}
        />
        <p className="swipe-filters-note">{t('Flört tercihleri yalnızca flört modundaki öğrencilere görünür.')}</p>

        <div className="swipe-filters-actions">
          <button type="button" className="btn-secondary" onClick={() => apply(EMPTY)}>
            {t('Temizle')}
          </button>
          <button type="button" className="btn" onClick={() => apply(draft)}>
            {t('Uygula')}
          </button>
        </div>
      </div>
    </div>
  );
}
