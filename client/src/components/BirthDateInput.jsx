import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n';

// Doğum tarihi alanı: Gün / Ay / Yıl kutularına elle yazılır (otomatik bir
// sonraki kutuya geçer, "12.05.2004" yapıştırılabilir) ya da takvim düğmesiyle
// ay/yıl seçilip güne dokunulur. Dışarıya yalnızca geçerli ve yaş sınırına
// uyan tarih "YYYY-MM-DD" olarak verilir; aksi halde boş metin.
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'];
const pad = (n) => String(n).padStart(2, '0');

function splitISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? { y: m[1], m: m[2], d: m[3] } : { y: '', m: '', d: '' };
}

function ageOn(date, now = new Date()) {
  let age = now.getFullYear() - date.getFullYear();
  const md = now.getMonth() - date.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < date.getDate())) age--;
  return age;
}

export default function BirthDateInput({ id, value, onChange, minAge = 18, maxAge = 100, required = false }) {
  const { t, lang } = useI18n();
  const groupId = useId();
  const initial = splitISO(value);
  const [d, setD] = useState(initial.d);
  const [m, setM] = useState(initial.m);
  const [y, setY] = useState(initial.y);
  const [open, setOpen] = useState(false);
  const dayRef = useRef(null);
  const monRef = useRef(null);
  const yearRef = useRef(null);
  const wrapRef = useRef(null);

  const thisYear = new Date().getFullYear();
  const maxYear = thisYear - minAge;
  const minYear = thisYear - maxAge;

  // Girilen değerlerden tarih ve hata durumu
  const status = useMemo(() => {
    if (!d && !m && !y) return { iso: '', error: '' };
    if (d.length < 1 || m.length < 1 || y.length < 4) return { iso: '', error: '' };
    const dn = Number(d);
    const mn = Number(m);
    const yn = Number(y);
    const date = new Date(yn, mn - 1, dn);
    if (date.getFullYear() !== yn || date.getMonth() !== mn - 1 || date.getDate() !== dn) {
      return { iso: '', error: t('Geçerli bir tarih gir.') };
    }
    const age = ageOn(date);
    if (age < minAge) return { iso: '', error: t('kampüs· {n} yaş ve üzeri içindir.', { n: minAge }) };
    if (age > maxAge) return { iso: '', error: t('Geçerli bir doğum yılı gir.') };
    return { iso: `${yn}-${pad(mn)}-${pad(dn)}`, error: '', age };
  }, [d, m, y, minAge, maxAge, t]);

  useEffect(() => {
    if (status.iso !== value) onChange(status.iso);
  }, [status.iso]); // eslint-disable-line react-hooks/exhaustive-deps

  // Takvim: dışarı tıklayınca / Esc ile kapanır
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function onPaste(e) {
    const text = e.clipboardData.getData('text').trim();
    const match = /^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4})$/.exec(text) || /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return;
    e.preventDefault();
    if (match[1].length === 4) {
      setY(match[1]); setM(match[2]); setD(match[3]);
    } else {
      setD(pad(match[1])); setM(pad(match[2])); setY(match[3]);
    }
    yearRef.current?.focus();
  }

  function digitsOnly(v, max) {
    return v.replace(/\D/g, '').slice(0, max);
  }

  function onDay(e) {
    const v = digitsOnly(e.target.value, 2);
    setD(v);
    if (v.length === 2 || Number(v) > 3) monRef.current?.focus();
  }
  function onMonth(e) {
    const v = digitsOnly(e.target.value, 2);
    setM(v);
    if (v.length === 2 || Number(v) > 1) yearRef.current?.focus();
  }
  function onYear(e) {
    setY(digitsOnly(e.target.value, 4));
  }
  function backspaceTo(prevRef) {
    return (e) => {
      if (e.key === 'Backspace' && !e.target.value) prevRef.current?.focus();
    };
  }
  // Tek haneli gün/ay kutudan çıkınca başına 0 eklenir (5 → 05)
  const padOnBlur = (setter) => (e) => {
    const v = e.target.value;
    if (v.length === 1 && v !== '0') setter(pad(v));
  };

  // ---------- Takvim ----------
  const [viewYear, setViewYear] = useState(Number(y) || maxYear);
  const [viewMonth, setViewMonth] = useState(m ? Number(m) - 1 : 0);
  useEffect(() => {
    if (open) {
      setViewYear(Number(y) && Number(y) >= minYear && Number(y) <= maxYear ? Number(y) : maxYear);
      setViewMonth(m && Number(m) >= 1 && Number(m) <= 12 ? Number(m) - 1 : 0);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const years = useMemo(() => {
    const list = [];
    for (let yr = maxYear; yr >= minYear; yr--) list.push(yr);
    return list;
  }, [maxYear, minYear]);

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const offset = (first.getDay() + 6) % 7; // Pazartesi başlangıçlı
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [viewYear, viewMonth]);

  function stepMonth(delta) {
    let mm = viewMonth + delta;
    let yy = viewYear;
    if (mm < 0) { mm = 11; yy -= 1; }
    if (mm > 11) { mm = 0; yy += 1; }
    if (yy < minYear || yy > maxYear) return;
    setViewMonth(mm);
    setViewYear(yy);
  }

  function pick(day) {
    setD(pad(day));
    setM(pad(viewMonth + 1));
    setY(String(viewYear));
    setOpen(false);
  }

  function isDisabled(day) {
    return ageOn(new Date(viewYear, viewMonth, day)) < minAge;
  }

  const selected = status.iso ? splitISO(status.iso) : null;
  const monthNames = lang === 'en'
    ? Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en-GB', { month: 'long' }))
    : MONTHS_TR;
  const dayNames = lang === 'en' ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : DAYS_TR;

  return (
    <div className={`birth-input ${status.error ? 'has-error' : ''}`} ref={wrapRef}>
      <div className="birth-fields" role="group" aria-labelledby={groupId} onPaste={onPaste}>
        <span id={groupId} className="sr-only">{t('Doğum Tarihi')}</span>
        <label className="birth-seg">
          <span>{t('Gün')}</span>
          <input
            id={id}
            ref={dayRef}
            value={d}
            onChange={onDay}
            onBlur={padOnBlur(setD)}
            inputMode="numeric"
            autoComplete="bday-day"
            placeholder="GG"
            aria-label={t('Gün')}
            required={required}
          />
        </label>
        <span className="birth-sep" aria-hidden="true">.</span>
        <label className="birth-seg">
          <span>{t('Ay')}</span>
          <input
            ref={monRef}
            value={m}
            onChange={onMonth}
            onBlur={padOnBlur(setM)}
            onKeyDown={backspaceTo(dayRef)}
            inputMode="numeric"
            autoComplete="bday-month"
            placeholder="AA"
            aria-label={t('Ay')}
            required={required}
          />
        </label>
        <span className="birth-sep" aria-hidden="true">.</span>
        <label className="birth-seg is-year">
          <span>{t('Yıl')}</span>
          <input
            ref={yearRef}
            value={y}
            onChange={onYear}
            onKeyDown={backspaceTo(monRef)}
            inputMode="numeric"
            autoComplete="bday-year"
            placeholder="YYYY"
            aria-label={t('Yıl')}
            required={required}
          />
        </label>
        <button
          type="button"
          className="birth-cal-btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t('Takvimden seç')}
        >
          <CalendarDays size={18} />
        </button>
      </div>

      {status.error ? (
        <p className="birth-error" role="alert">{status.error}</p>
      ) : status.age ? (
        <p className="birth-age">{t('{n} yaşındasın', { n: status.age })}</p>
      ) : null}

      {open && (
        <div className="birth-cal" role="dialog" aria-label={t('Takvimden seç')}>
          <div className="birth-cal-head">
            <button type="button" onClick={() => stepMonth(-1)} aria-label={t('Önceki ay')}>
              <ChevronLeft size={18} />
            </button>
            <select value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))} aria-label={t('Ay')}>
              {monthNames.map((name, i) => (
                <option key={name} value={i}>{name}</option>
              ))}
            </select>
            <select value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))} aria-label={t('Yıl')}>
              {years.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
            <button type="button" onClick={() => stepMonth(1)} aria-label={t('Sonraki ay')}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="birth-cal-grid">
            {dayNames.map((n) => (
              <span key={n} className="birth-cal-dow">{n}</span>
            ))}
            {cells.map((day, i) =>
              day ? (
                <button
                  key={i}
                  type="button"
                  className={`birth-cal-day ${
                    selected && Number(selected.d) === day && Number(selected.m) === viewMonth + 1 && Number(selected.y) === viewYear ? 'is-selected' : ''
                  }`}
                  disabled={isDisabled(day)}
                  onClick={() => pick(day)}
                >
                  {day}
                </button>
              ) : (
                <span key={i} />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
