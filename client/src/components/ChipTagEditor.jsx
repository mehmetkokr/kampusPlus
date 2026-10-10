import React, { useId, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { MAX_TAGS } from '../constants/tags';

// Profil etiketleri: seçilenler çarpılı çipler; "Ekle +" altta bir arama ve
// seçenek listesi açar. Listede olmayan eski kayıtlar silinene kadar çip
// olarak kalır. Başlığın sağında doluluk (ör. 6/10).
function foldTR(s) {
  return s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
}

export default function ChipTagEditor({ id, label, options, value, onChange, max = MAX_TAGS }) {
  const { t } = useI18n();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const full = value.length >= max;

  const available = useMemo(() => {
    const q = foldTR(query.trim());
    return options.filter((o) => !value.includes(o) && (!q || foldTR(o).includes(q) || foldTR(t(o)).includes(q)));
  }, [options, value, query, t]);

  function add(tag) {
    if (full) return;
    onChange([...value, tag]);
    setQuery('');
    searchRef.current?.focus();
  }

  return (
    <section className="pf-section" id={id} tabIndex={-1}>
      <div className="pf-section-head">
        <h3 className="pf-label">{label}</h3>
        <span className={`pf-count ${full ? 'is-full' : ''}`}>
          {value.length}/{max}
        </span>
      </div>
      <div className="pf-chips">
        {value.map((tag) => (
          <span key={tag} className="pf-chip is-tag">
            {t(tag)}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== tag))} aria-label={t('{tag} etiketini kaldır', { tag: t(tag) })}>
              <X size={14} strokeWidth={2.4} />
            </button>
          </span>
        ))}
        <button
          type="button"
          className={`pf-chip is-add ${open ? 'is-open' : ''}`}
          onClick={() => {
            setOpen((v) => !v);
            setTimeout(() => searchRef.current?.focus(), 30);
          }}
          aria-expanded={open}
          aria-controls={panelId}
          disabled={full && !open}
        >
          {t('Ekle')} <Plus size={15} strokeWidth={2.4} />
        </button>
      </div>

      {open && (
        <div className="pf-add-panel" id={panelId}>
          <label className="pf-search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Ara…')}
              aria-label={t('{label} içinde ara', { label })}
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            />
          </label>
          {full ? (
            <p className="pf-hint">{t('En fazla {n} tane seçebilirsin. Eklemek için birini kaldır.', { n: max })}</p>
          ) : available.length === 0 ? (
            <p className="pf-hint">{t('Eşleşen seçenek yok.')}</p>
          ) : (
            <div className="pf-chips pf-options">
              {available.map((o) => (
                <button key={o} type="button" className="pf-chip" onClick={() => add(o)}>
                  <Plus size={13} strokeWidth={2.4} /> {t(o)}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="pf-link" onClick={() => setOpen(false)}>
            {t('Bitti')}
          </button>
        </div>
      )}
    </section>
  );
}
