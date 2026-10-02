import React from 'react';
import { Lock } from 'lucide-react';

// Premium olmayan kullanıcılara diğer üniversitelerden birinin "var olduğunu"
// gösteren ama kimliğini açmayan kilitli kart. Tıklanınca paywall açılır.
export default function LockedUserCard({ onClick, title = 'Premium ile Görüntüle', subtitle = 'Farklı bir üniversiteden' }) {
  return (
    <div className="locked-card" onClick={onClick}>
      <div className="locked-card-blur">
        <div className="locked-card-avatar-placeholder" />
        <div style={{ flex: 1 }}>
          <div className="locked-card-line short" />
          <div className="locked-card-line tiny" />
        </div>
      </div>
      <div className="locked-card-overlay">
        <div className="locked-card-overlay-icon">
          <Lock size={16} />
        </div>
        <div className="locked-card-overlay-title">{title}</div>
        <div className="locked-card-overlay-sub">{subtitle}</div>
      </div>
    </div>
  );
}
