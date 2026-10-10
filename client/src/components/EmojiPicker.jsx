import React, { useMemo, useState } from 'react';
import { useI18n } from '../i18n';

// Kategorili emoji seçici: üstte sekmeler, altta ızgara. Son kullanılanlar
// tarayıcıda hatırlanır (en fazla 24). Güncel Unicode emojileri dahil
// (🥹 🫠 🫶 🫡 🩷 🪩 🧋 …); eski sistemlerde gösterilemeyenler kare görünebilir.
const RECENT_KEY = 'kp-recent-emoji';
const MAX_RECENT = 24;

export const EMOJI_CATEGORIES = [
  {
    key: 'faces',
    icon: '😀',
    label: 'Yüzler',
    items: [
      '😀', '😄', '😁', '😆', '🤣', '😂', '🥹', '😊', '🙂', '🙃', '🫠', '😉', '😌', '😍', '🥰', '😘',
      '😋', '😛', '😜', '🤪', '😎', '🤓', '🥸', '🤩', '🥳', '🤗', '🫡', '🤭', '🫢', '🫣', '🤫', '🤔',
      '🫤', '😐', '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😴', '🤤', '😪', '😵‍💫', '🤯', '🥱',
      '😳', '🥺', '🥲', '😢', '😭', '😤', '😠', '🤬', '😱', '😨', '🫨', '🤠', '😇', '🤡', '👻', '💀',
    ],
  },
  {
    key: 'hands',
    icon: '👋',
    label: 'El hareketleri',
    items: [
      '👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆',
      '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏',
      '💪', '🦾', '✍️', '💅', '🫂', '🧠', '👀', '🫦',
    ],
  },
  {
    key: 'hearts',
    icon: '❤️',
    label: 'Kalpler',
    items: [
      '❤️', '🩷', '🧡', '💛', '💚', '💙', '🩵', '💜', '🤎', '🖤', '🩶', '🤍', '❤️‍🔥', '❤️‍🩹', '💕', '💞',
      '💓', '💗', '💖', '💘', '💝', '💟', '💌', '💋', '😻', '🫶',
    ],
  },
  {
    key: 'campus',
    icon: '🎓',
    label: 'Kampüs',
    items: [
      '🎓', '📚', '📖', '📝', '✏️', '🖊️', '📎', '📌', '🗂️', '📅', '⏰', '💻', '🖥️', '📱', '🎧', '🔬',
      '🧪', '🧮', '📐', '🗺️', '🏛️', '🏫', '🎒', '☕', '🧋', '🍵', '🚌', '🚲', '🛴', '💡', '🧠', '🏆',
    ],
  },
  {
    key: 'fun',
    icon: '🎉',
    label: 'Etkinlik',
    items: [
      '🎉', '🥳', '🎊', '🪩', '🎈', '🎂', '🎁', '🎶', '🎵', '🎤', '🎸', '🥁', '🎹', '🎬', '🎮', '🕹️',
      '🎲', '♟️', '🎯', '🎨', '📸', '🎭', '🎟️', '⚽', '🏀', '🏐', '🎾', '🏓', '🏃', '🧘', '🏊', '🚴',
    ],
  },
  {
    key: 'food',
    icon: '🍕',
    label: 'Yemek',
    items: [
      '🍕', '🍔', '🌯', '🌮', '🥙', '🧆', '🍟', '🍝', '🍜', '🍣', '🥗', '🥪', '🥐', '🥯', '🧇', '🥞',
      '🍩', '🍪', '🍫', '🍰', '🧁', '🍦', '🍉', '🍓', '🍒', '🥑', '🌶️', '🍿', '🥤', '🧃', '🍻', '🍷',
    ],
  },
  {
    key: 'nature',
    icon: '🌿',
    label: 'Doğa',
    items: [
      '🌸', '🌼', '🌻', '🌷', '🌹', '🌿', '🍀', '🌱', '🌵', '🍂', '🌊', '🏔️', '🏕️', '🌅', '🌙', '⭐',
      '🌈', '☀️', '⛅', '🌧️', '❄️', '🔥', '🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🦋', '🐢', '🐬', '🦄',
    ],
  },
  {
    key: 'symbols',
    icon: '✨',
    label: 'Semboller',
    items: [
      '✨', '💫', '⚡', '💥', '💯', '✅', '☑️', '❌', '❓', '❗', '‼️', '💬', '💭', '🗯️', '🔔', '📣',
      '🚀', '🎯', '📈', '🏁', '🆕', '🆒', '🔝', '♻️', '🌍', '🇹🇷', '🏳️‍🌈', '☮️', '♾️', '🔒', '🧿', '🪬',
    ],
  },
];

function readRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export default function EmojiPicker({ onPick, className = '' }) {
  const { t } = useI18n();
  const [recent, setRecent] = useState(readRecent);
  const [active, setActive] = useState(() => (readRecent().length ? 'recent' : 'faces'));

  const tabs = useMemo(
    () => [...(recent.length ? [{ key: 'recent', icon: '🕘', label: 'Son kullanılanlar', items: recent }] : []), ...EMOJI_CATEGORIES],
    [recent]
  );
  const current = tabs.find((c) => c.key === active) || tabs[0];

  function pick(em) {
    onPick(em);
    const next = [em, ...recent.filter((x) => x !== em)].slice(0, MAX_RECENT);
    // Son kullanılanlar sekmesindeyken liste yerinden oynamasın; kaydedip sonra göster
    if (active !== 'recent') setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // depolama kapalıysa yalnızca bu oturumda
    }
  }

  return (
    <div className={`emoji-picker ${className}`.trim()}>
      <div className="emoji-picker-tabs" role="tablist" aria-label={t('Emoji kategorileri')}>
        {tabs.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={c.key === current.key}
            aria-label={t(c.label)}
            title={t(c.label)}
            className={c.key === current.key ? 'on' : ''}
            onClick={() => setActive(c.key)}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <p className="emoji-picker-title">{t(current.label)}</p>
      <div className="emoji-picker-grid" role="tabpanel" aria-label={t(current.label)}>
        {current.items.map((em) => (
          <button key={em} type="button" onClick={() => pick(em)} aria-label={em}>
            {em}
          </button>
        ))}
      </div>
    </div>
  );
}
