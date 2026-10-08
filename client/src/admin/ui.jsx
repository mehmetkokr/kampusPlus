// Yönetim panelinin ortak arayüz parçaları
import React, { useEffect } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, X } from 'lucide-react';
import { buildFileUrl } from '../api';

const nf = new Intl.NumberFormat('tr-TR');
export const fmt = (n) => (n === null || n === undefined ? '-' : nf.format(n));
export const fmtMoney = (n) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n || 0);
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';

export function timeAgo(d) {
  if (!d) return 'hiç';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'az önce';
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} gün önce`;
  return fmtDate(d);
}

export const PERIODS = [
  { value: 7, label: '7 gün' },
  { value: 30, label: '30 gün' },
  { value: 90, label: '90 gün' },
];

export { INTENT_OPTIONS, INTENT_LABEL as INTENT_LABELS } from '../constants/intents';

export const CLASS_LABELS = { 1: '1. sınıf', 2: '2. sınıf', 3: '3. sınıf', 4: '4. sınıf', 5: 'Y. lisans / diğer' };

export function PageHead({ title, sub, children }) {
  return (
    <header className="adm-page-head">
      <div>
        <h1 className="adm-title">{title}</h1>
        {sub && <p className="adm-sub">{sub}</p>}
      </div>
      {children && <div className="adm-head-actions">{children}</div>}
    </header>
  );
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="adm-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Delta({ change, previous }) {
  if (change === null) return <span className="adm-delta up">Yeni</span>;
  if (!change) return <span className="adm-delta"><Minus /> %0</span>;
  const up = change > 0;
  return (
    <span className={`adm-delta ${up ? 'up' : 'down'}`} title={`Önceki dönem: ${fmt(previous)}`}>
      {up ? <ArrowUpRight /> : <ArrowDownRight />}%{Math.abs(change).toLocaleString('tr-TR')}
    </span>
  );
}

export function Kpi({ icon: Icon, label, value, kpi, color, format = fmt, children }) {
  return (
    <div className="adm-card adm-kpi" style={{ '--kpi-color': color }}>
      <span className="adm-kpi-label">
        {Icon && <Icon />} {label}
      </span>
      <span className="adm-kpi-value">{format(value ?? kpi?.value)}</span>
      <div className="adm-kpi-foot">
        {kpi ? (
          <>
            <Delta change={kpi.change} previous={kpi.previous} />
            <span className="adm-delta-note">{kpi.change === null ? 'önceki dönemde yoktu' : 'önceki döneme göre'}</span>
          </>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ h = 120, style }) {
  return <div className="adm-skeleton" style={{ height: h, ...style }} aria-hidden="true" />;
}

export function Empty({ icon: Icon, children }) {
  return (
    <div className="adm-empty">
      {Icon && <Icon />}
      <div>{children}</div>
    </div>
  );
}

export function Avatar({ user, size }) {
  const initials = (user?.fullName || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('tr-TR');
  return user?.photoUrl ? (
    <img className={`adm-avatar ${size || ''}`} src={buildFileUrl(user.photoUrl)} alt="" loading="lazy" />
  ) : (
    <span className={`adm-avatar ${size || ''}`} aria-hidden="true">{initials}</span>
  );
}

export function Person({ user, meta }) {
  return (
    <span className="adm-person">
      <Avatar user={user} />
      <span style={{ minWidth: 0 }}>
        <span className="adm-person-name">{user?.fullName}</span>
        {meta && <span className="adm-person-meta">{meta}</span>}
      </span>
    </span>
  );
}

// Sağdan kayan panel (Esc ve arka plana tıklama ile kapanır)
export function Drawer({ title, onClose, children, actions }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="adm-drawer-head">
          <h3>{title}</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {actions}
            <button type="button" className="adm-btn ghost small icon" onClick={onClose} aria-label="Kapat">
              <X />
            </button>
          </div>
        </div>
        <div className="adm-drawer-body">{children}</div>
      </aside>
    </>
  );
}

// Basit sayfalama
export function Pager({ page, total, pageSize, onPage }) {
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  return (
    <div className="adm-pager">
      <span>
        {fmt(total)} kayıt · Sayfa {page} / {pages}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="adm-btn ghost small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Önceki
        </button>
        <button type="button" className="adm-btn ghost small" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Sonraki
        </button>
      </div>
    </div>
  );
}
