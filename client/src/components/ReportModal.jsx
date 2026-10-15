import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X as CloseIcon } from './icons';
import api from '../api';
import { useI18n } from '../i18n';
import Select from './Select';

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Taciz / Zorbalık' },
  { value: 'inappropriate_content', label: 'Uygunsuz İçerik' },
  { value: 'fake_profile', label: 'Sahte Profil' },
  { value: 'other', label: 'Diğer' },
];

// targetType: "user" | "post" | "message" | "club_message" | "story"
export default function ReportModal({ targetType, targetId, onClose }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('spam');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/reports', { targetType, targetId, reason, description });
      setDone(true);
    } catch (err) {
      console.error('Şikayet gönderilemedi:', err);
      setError(err.response?.data?.error || 'Şikayet gönderilemedi, tekrar dene.');
    } finally {
      setSubmitting(false);
    }
  }

  // Sayfa katmanından bağımsız açılsın: cam efektli kartların içinde kalmasın
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t("Şikayet Et")}</h3>
          <button className="modal-close" onClick={onClose}><CloseIcon /></button>
        </div>

        {done ? (
          <div style={{ padding: '20px 4px' }}>
            <p>{t("Şikayetin alındı, ekibimiz inceleyecek. Teşekkürler.")}</p>
            <button className="btn" onClick={onClose} style={{ marginTop: 12 }}>{t("Kapat")}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && <p className="error-text">{error}</p>}
            <div>
              <label htmlFor="report-reason" className="muted" style={{ fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>{t("Sebep")}</label>
              <Select
                id="report-reason"
                value={reason}
                onChange={setReason}
                options={REASONS.map((r) => ({ value: r.value, label: t(r.label) }))}
              />
            </div>
            <div>
              <label className="muted" style={{ fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>{t("Açıklama (opsiyonel)")}</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("Daha fazla ayrıntı ekleyebilirsin...")}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? t("Gönderiliyor...") : t("Şikayeti Gönder")}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
