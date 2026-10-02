import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../i18n';

// Apple tarzı segmented control: seçili segmentin arkasındaki gösterge
// seçenekler arasında yayla kayar. `options`: [{ value, label, badge? }]
export default function SegmentedControl({ options, value, onChange, ariaLabel }) {
  const { t } = useI18n();
  const id = useId();

  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented-item ${active ? 'active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${id}`}
                className="segmented-indicator"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            <span className="segmented-label">
              {t(opt.label)}
              {opt.badge ? <span className="pill-count">{opt.badge}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
