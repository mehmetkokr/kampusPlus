import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from './icons';
import { useI18n } from '../i18n';

// Profil seçim kutusu: seçilenler kutunun içinde çip olarak durur, seçenekler
// gizlidir; kutuya dokununca altında bir liste açılır (uzun listelerde arama
// ile). Dışarı tıklayınca veya Esc ile kapanır. Seçenekler düz metin
// ('Müzik') ya da { value, label } olabilir. Listede olmayan eski kayıtlar
// silinene kadar çip olarak kalır.
function foldTR(s) {
  return s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
}

const normalize = (o) => (typeof o === 'string' ? { value: o, label: o } : o);

export default function MultiSelectBox({ id, label, options, value, onChange, max, hint, placeholder }) {
  const { t } = useI18n();
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const items = useMemo(() => options.map(normalize), [options]);
  const labelOf = (v) => t(items.find((o) => o.value === v)?.label ?? v);
  const searchable = items.length > 12;
  const full = max !== undefined && value.length >= max;

  const filtered = useMemo(() => {
    const q = foldTR(query.trim());
    if (!q) return items;
    return items.filter((o) => foldTR(o.label).includes(q) || foldTR(t(o.label)).includes(q));
  }, [items, query, t]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    if (searchable) setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      setQuery('');
    };
  }, [open, searchable]);

  function toggle(v) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else if (!full) onChange([...value, v]);
  }

  return (
    <section className="pf-section" id={id} tabIndex={-1}>
      <div className="pf-section-head">
        <h3 className="pf-label">{label}</h3>
        {max !== undefined && (
          <span className={`pf-count ${full ? 'is-full' : ''}`}>
            {value.length}/{max}
          </span>
        )}
      </div>

      <div ref={rootRef} className={`pf-select ${open ? 'is-open' : ''}`}>
        {/* Kutunun tamamına dokunmak listeyi açar; ekran okuyucu ve klavye için
            açma işini içteki gerçek düğme yapar (iç içe tıklanabilir öğe olmasın) */}
        <div className="pf-select-box" onClick={() => setOpen((v) => !v)}>
          {value.map((v) => (
            <span key={v} className="pf-select-chip">
              {labelOf(v)}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(v);
                }}
                aria-label={t('{tag} etiketini kaldır', { tag: labelOf(v) })}
              >
                <X size={12} strokeWidth={2.6} />
              </button>
            </span>
          ))}
          <button
            type="button"
            className={`pf-select-toggle ${value.length === 0 ? 'is-empty' : ''}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            {value.length === 0 && <span className="pf-select-placeholder">{placeholder || t('Seçmek için dokun')}</span>}
            <ChevronDown size={18} className="pf-select-chevron" aria-hidden="true" />
          </button>
        </div>

        {open && (
          <div className="pf-select-panel">
            {searchable && (
              <label className="pf-select-search">
                <Search size={15} aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('Ara…')}
                  aria-label={t('{label} içinde ara', { label })}
                />
              </label>
            )}
            {full && <p className="pf-select-note">{t('En fazla {n} tane seçebilirsin. Eklemek için birini kaldır.', { n: max })}</p>}
            <ul className="pf-select-list" id={listId} role="listbox" aria-multiselectable="true" aria-label={label}>
              {filtered.map((o) => {
                const on = value.includes(o.value);
                return (
                  <li key={o.value} role="option" aria-selected={on}>
                    <button type="button" className={`pf-select-option ${on ? 'is-on' : ''}`} disabled={!on && full} onClick={() => toggle(o.value)}>
                      <span className="pf-select-check" aria-hidden="true">
                        {on && <Check size={13} strokeWidth={3} />}
                      </span>
                      {t(o.label)}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="pf-select-note">{t('Eşleşen seçenek yok.')}</li>}
            </ul>
            <button type="button" className="pf-select-done" onClick={() => setOpen(false)}>
              {t('Bitti')}
            </button>
          </div>
        )}
      </div>

      {hint && <p className="pf-hint">{hint}</p>}
    </section>
  );
}
