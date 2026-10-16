import React, { useEffect, useState } from 'react';
import { MapPin, X, Loader2 } from './icons';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import UniversitySelect from './UniversitySelect';

// Kart Modu kampüsü (Plus ve Premium): başka bir üniversiteyi seçince Kart
// Modu'nda oradaki öğrenciler çıkar. Akış, hikâyeler ve kulüpler her zaman
// kendi kampüsünden gelir.
export default function CampusSwitchSheet({ onClose, onChanged }) {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [universities, setUniversities] = useState([]);
  const [value, setValue] = useState(String(user?.swipeUniversity?.id || user?.university?.id || ''));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/universities')
      .then((res) => setUniversities(res.data))
      .catch(() => {});
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(universityId) {
    setSaving(true);
    try {
      const res = await api.put('/premium/campus', { universityId: universityId || null });
      setUser((prev) => ({ ...prev, swipeUniversity: res.data.swipeUniversity }));
      toast.success(
        res.data.swipeUniversity
          ? t('Kart Modu artık {uni} kampüsünde.', { uni: res.data.swipeUniversity.name })
          : t('Kart Modu kendi kampüsüne döndü.')
      );
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('Kampüs değiştirilemedi.'));
    } finally {
      setSaving(false);
    }
  }

  const away = Boolean(user?.swipeUniversity);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet campus-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="campus-sheet-title">
        <div className="modal-header">
          <h3 id="campus-sheet-title">
            <MapPin size={18} aria-hidden="true" /> {t('Kart Modu kampüsü')}
          </h3>
          <button className="modal-close" onClick={onClose} aria-label={t('Kapat')}>
            <X size={16} />
          </button>
        </div>
        <p className="campus-sheet-lead">
          {t('Bir üniversite seç; Kart Modu’nda oradaki öğrenciler çıksın. Akış ve kulüpler kendi kampüsünde kalır.')}
        </p>
        <label htmlFor="campus-uni">{t('Üniversite')}</label>
        <UniversitySelect id="campus-uni" universities={universities} value={value} onChange={setValue} showDomainHint={false} />
        <div className="campus-sheet-actions">
          <button type="button" className="btn" disabled={saving || !value} onClick={() => save(Number(value))}>
            {saving ? <Loader2 size={16} className="spin" /> : null}
            {t('Bu kampüse geç')}
          </button>
          {away && (
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => save(null)}>
              {t('Kendi kampüsüme dön ({uni})', { uni: user?.university?.name || '' })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
