import React from 'react';
import { CLUB_ICONS, ICON_PREFIX, toneForCategory } from '../constants/clubIcons';
import { Users } from 'lucide-react';

// Kulüp simgesi: "icon:<anahtar>" değerleri kategori renginde yumuşak bir
// kutu içinde çizgi ikon olarak çizilir; eski kulüplerin emoji değerleri
// olduğu gibi gösterilir.
export default function ClubIcon({ value, category, size = 40, className = '' }) {
  const tone = toneForCategory(category);
  const style = { width: size, height: size, '--club-icon-tone': tone };

  if (typeof value === 'string' && value.startsWith(ICON_PREFIX)) {
    const Icon = CLUB_ICONS[value.slice(ICON_PREFIX.length)];
    if (Icon) {
      return (
        <span className={`club-icon-tile ${className}`} style={style} aria-hidden="true">
          <Icon size={Math.round(size * 0.5)} strokeWidth={1.9} />
        </span>
      );
    }
  }

  return (
    <span className={`club-icon-tile is-emoji ${className}`} style={{ ...style, fontSize: Math.round(size * 0.5) }} aria-hidden="true">
      {value || <Users size={Math.round(size * 0.48)} strokeWidth={1.9} />}
    </span>
  );
}
