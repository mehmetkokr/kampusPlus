import React, { useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { MAX_TAGS } from '../constants/tags';

// Seçmeli etiket alanı: kutuya dokununca seçenekler alanın altında açılır,
// kişi birden fazlasını seçer; seçilenler kutunun içinde çip olarak görünür.
// Elle yazma yok, yalnızca listede arama var. Listede olmayan eski kayıtlar
// (eskiden serbest yazılmış değerler) silinene kadar çip olarak kalır.
function foldTR(s) {
  return s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
}

export default function TagPicker({ id, label, options, value, onChange, max = MAX_TAGS }) {
  const { t } = useI18n();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = foldTR(query.trim());
    if (!q) return options;
    return options.filter((o) => foldTR(o).includes(q) || foldTR(t(o)).includes(q));
  }, [options, query, t]);

  const full = value.length >= max;

  function toggle(tag) {
    if (value.includes(tag)) onChange(value.filter((v) => v !== tag));
    else if (!full) onChange([...value, tag]);
  }

  return (
    <div className={`tag-picker ${open ? 'is-open' : ''}`}>
      <div className="tag-picker-head">
        <label htmlFor={id}>{label}</label>
        <span className="tag-picker-count">
          {value.length}/{max}
        </span>
      </div>

      <div className="tag-picker-field">
        {value.map((tag) => (
          <span key={tag} className="tag-chip">
            {t(tag)}
            <button type="button" onClick={() => toggle(tag)} aria-label={t('{tag} kaldır', { tag: t(tag) })}>
              <X size={12} strokeWidth={2.6} />
            </button>
          </span>
        ))}
        <button
          id={id}
          type="button"
          className="tag-picker-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          {value.length === 0 ? t('Seçmek için dokun') : t('Ekle')}
          <ChevronDown size={16} className="tag-picker-chevron" />
        </button>
      </div>

      {open && (
        <div className="tag-picker-panel" id={panelId}>
          <div className="tag-picker-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Listede ara')}
              aria-label={t('Listede ara')}
            />
          </div>
          {full && <p className="tag-picker-note">{t('En fazla {n} seçim yapabilirsin.', { n: max })}</p>}
          <div className="tag-picker-options" role="group" aria-label={label}>
            {filtered.map((o) => {
              const on = value.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  className={`tag-option ${on ? 'is-on' : ''}`}
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => toggle(o)}
                >
                  {on && <Check size={13} strokeWidth={2.8} />}
                  {t(o)}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="tag-picker-note">{t('Sonuç bulunamadı.')}</p>}
          </div>
          <button
            type="button"
            className="tag-picker-done"
            onClick={() => {
              setOpen(false);
              setQuery('');
            }}
          >
            {t('Bitti')}
          </button>
        </div>
      )}
    </div>
  );
}
