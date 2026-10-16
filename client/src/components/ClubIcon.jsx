import React from 'react';
import { CLUB_ICONS, ICON_PREFIX, tonesForCategory } from '../constants/clubIcons';
import { Users } from './icons';

// Kulüp simgesi: uygulama simgesi gibi, kategori renginde geçişli kutu üzerinde
// beyaz dolu ikon. Eski kulüplerin emoji değerleri olduğu gibi gösterilir.
export default function ClubIcon({ value, category, size = 40, className = '' }) {
  const [tone, tone2] = tonesForCategory(category);
  const style = { width: size, height: size, '--club-icon-tone': tone, '--club-icon-tone-2': tone2 };
  const glyph = Math.round(size * 0.54);

  if (typeof value === 'string' && value.startsWith(ICON_PREFIX)) {
    const Icon = CLUB_ICONS[value.slice(ICON_PREFIX.length)];
    if (Icon) {
      return (
        <span className={`club-icon-tile ${className}`} style={style} aria-hidden="true">
          <Icon size={glyph} weight="fill" />
        </span>
      );
    }
  }

  if (!value) {
    return (
      <span className={`club-icon-tile ${className}`} style={style} aria-hidden="true">
        <Users size={glyph} weight="fill" />
      </span>
    );
  }

  return (
    <span className={`club-icon-tile is-emoji ${className}`} style={{ ...style, fontSize: Math.round(size * 0.5) }} aria-hidden="true">
      {value}
    </span>
  );
}
