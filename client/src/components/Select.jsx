import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from './icons';
import '../styles/select.css';

// Tarayıcının hazır <select> açılır listesi yerine, uygulamanın görünümüne
// uyan seçim kutusu (iOS açılır menüsü gibi). Liste body'ye taşınır
// (portal): kart, pencere ya da cam yüzeyin içinde kırpılmaz; aşağıda yer
// yoksa yukarı açılır.
// Klavye: ↑/↓ gezinme, Enter/Boşluk seçme, Esc kapatma, Home/End, harfle arama.
// options: [{ value, label }]; value her zaman metin olarak karşılaştırılır.
export default function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Seçiniz…',
  disabled = false,
  invalid = false,
  className = '',
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}) {
  const autoId = useId();
  const buttonId = id || `sel-${autoId}`;
  const listId = `${buttonId}-list`;
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const typed = useRef({ text: '', at: 0 });

  const selectedIndex = options.findIndex((o) => String(o.value) === String(value ?? ''));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const listHeight = Math.min(options.length * 44 + 12, 300);
    const below = window.innerHeight - r.bottom;
    const up = below < listHeight + 12 && r.top > below;
    setPos({
      left: r.left,
      width: r.width,
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      up,
    });
  }, [options.length]);

  function openList(startIndex = selectedIndex >= 0 ? selectedIndex : 0) {
    if (disabled) return;
    place();
    setActive(startIndex);
    setOpen(true);
  }
  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }
  function choose(i) {
    const opt = options[i];
    if (!opt || opt.disabled) return;
    onChange?.(opt.value);
    close();
  }

  // Açıkken: dışarı tıklama kapatır, kaydırma/boyut değişimi konumu günceller
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!listRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) close(false);
    };
    const onMove = () => place();
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  // Etkin seçenek görünür alanda kalsın
  useLayoutEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function move(delta) {
    setActive((i) => {
      let n = i;
      for (let k = 0; k < options.length; k += 1) {
        n = (n + delta + options.length) % options.length;
        if (!options[n].disabled) return n;
      }
      return i;
    });
  }

  function onKeyDown(e) {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        // Harfle arama: yazılan harflerle başlayan ilk seçenek
        if (e.key.length === 1) {
          const now = Date.now();
          typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLocaleLowerCase('tr'), at: now };
          const hit = options.findIndex((o) => String(o.label).toLocaleLowerCase('tr').startsWith(typed.current.text));
          if (hit >= 0) setActive(hit);
        }
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className={`ui-select ${open ? 'is-open' : ''} ${invalid ? 'is-invalid' : ''} ${selected ? '' : 'is-placeholder'} ${className}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="ui-select-value">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className="ui-select-chevron" />
      </button>
      {open &&
        pos &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={buttonId}
            className={`ui-select-list ${pos.up ? 'is-up' : ''}`}
            style={{ left: pos.left, width: Math.max(pos.width, 180), top: pos.top, bottom: pos.bottom }}
          >
            {options.map((o, i) => {
              const isSel = i === selectedIndex;
              return (
                <li
                  key={String(o.value)}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={o.disabled || undefined}
                  className={`ui-select-option ${i === active ? 'is-active' : ''} ${isSel ? 'is-selected' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  // Odak düğmede kalsın (pointerdown'da varsayılan odak kaybı engellenir)
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                >
                  <span>{o.label}</span>
                  {isSel && <Check size={16} className="ui-select-check" />}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
