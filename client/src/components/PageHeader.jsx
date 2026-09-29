import React from 'react';
import { ArrowLeft } from 'lucide-react';

// Her menü sayfasının üstündeki cam "hero" başlığı. `tone` vurgu rengini
// belirler (amber, sky, violet, teal, rose); `children` başlığın altına
// eklenen ek içerik içindir (ör. Keşfet'teki arama kutusu).
export default function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  badge,
  actions,
  onBack,
  tone = 'amber',
  compact = false,
  children,
}) {
  return (
    <header className={`page-hero tone-${tone} ${compact ? 'is-compact' : ''}`}>
      <span className="page-hero-glow" aria-hidden="true" />
      <div className="page-hero-row">
        {onBack && (
          <button type="button" className="glass-icon-btn" onClick={onBack} aria-label="Geri">
            <ArrowLeft size={18} />
          </button>
        )}
        {Icon && (
          <span className="page-hero-icon">
            <Icon size={20} strokeWidth={2.1} />
          </span>
        )}
        <div className="page-hero-text">
          {eyebrow && <div className="page-hero-eyebrow">{eyebrow}</div>}
          <h1 className="page-hero-title">
            {title}
            {badge}
          </h1>
        </div>
        {actions && <div className="page-hero-actions">{actions}</div>}
      </div>
      {subtitle && <p className="page-hero-sub">{subtitle}</p>}
      {children}
    </header>
  );
}
