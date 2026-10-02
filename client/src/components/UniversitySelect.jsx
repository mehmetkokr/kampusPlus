import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, GraduationCap, Search, X } from 'lucide-react';
import { useI18n } from '../i18n';

// Türkçe karakterlere duyarsız karşılaştırma: "istanbul" → "İstanbul", "odtu" → "ODTÜ"
function fold(text) {
  return (text || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function Highlight({ text, query }) {
  const q = fold(query.trim());
  if (!q) return text;
  const idx = fold(text).indexOf(q);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// Aranabilir üniversite seçici (combobox). Klavye: ↑/↓ gez, Enter seç, Esc kapat.
export default function UniversitySelect({ universities, value, onChange, id, required }) {
  const { t } = useI18n();
  const autoId = useId();
  const inputId = id || `uni-${autoId}`;
  const listId = `${inputId}-list`;
  const selected = universities.find((u) => String(u.id) === String(value)) || null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return universities;
    const words = q.split(/\s+/);
    return universities
      .filter((u) => {
        const hay = fold(`${u.name} ${u.emailDomain || ''}`);
        return words.every((w) => hay.includes(w));
      })
      // Adın başıyla eşleşenler önce gelsin
      .sort((a, b) => Number(!fold(a.name).startsWith(q)) - Number(!fold(b.name).startsWith(q)));
  }, [universities, query]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => setActive(0), [query]);

  // Etkin seçeneği görünür tut
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(u) {
    onChange(String(u.id));
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={`uni-select ${open ? 'is-open' : ''}`} ref={wrapRef}>
      <div className="uni-select-field" onClick={() => { setOpen(true); inputRef.current?.focus(); }}>
        {open || !selected ? <Search size={16} className="uni-select-lead" /> : <GraduationCap size={16} className="uni-select-lead" />}
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
          autoComplete="off"
          placeholder={selected ? selected.name : t("Üniversiteni ara (örn. İTÜ, Boğaziçi)")}
          value={open ? query : selected ? selected.name : ''}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={selected && !open ? 'has-value' : ''}
        />
        {selected && !open ? (
          <button
            type="button"
            className="uni-select-clear"
            aria-label={t("Seçimi temizle")}
            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(true); inputRef.current?.focus(); }}
          >
            <X size={15} />
          </button>
        ) : (
          <ChevronDown size={16} className="uni-select-chevron" aria-hidden="true" />
        )}
      </div>

      {/* Tarayıcının "zorunlu alan" doğrulaması için gizli alan */}
      {required && <input tabIndex={-1} aria-hidden="true" className="uni-select-required" value={value || ''} onChange={() => {}} required />}

      {selected && !open && selected.emailDomain && (
        <p className="field-hint uni-select-domain">
          {t("Doğrulama kodu yalnızca")} <strong>@{selected.emailDomain}</strong> {t("uzantılı okul e-postana gönderilir.")}
        </p>
      )}

      {open && (
        <ul className="uni-select-list" id={listId} role="listbox" ref={listRef}>
          {results.length === 0 && <li className="uni-select-empty">{t('"{q}" ile eşleşen üniversite yok', { q: query })}</li>}
          {results.map((u, i) => (
            <li
              key={u.id}
              id={`${listId}-${u.id}`}
              data-index={i}
              role="option"
              aria-selected={String(u.id) === String(value)}
              className={`${i === active ? 'is-active' : ''} ${String(u.id) === String(value) ? 'is-selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(u)}
            >
              <span className="uni-select-name">
                <Highlight text={u.name} query={query} />
              </span>
              {u.emailDomain && <span className="uni-select-meta">@{u.emailDomain}</span>}
              {String(u.id) === String(value) && <Check size={15} className="uni-select-check" />}
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">{open ? `${results.length} üniversite listeleniyor` : ''}</span>
    </div>
  );
}
