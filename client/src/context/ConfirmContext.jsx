import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

// Tarayıcının yerleşik window.confirm penceresi bazı gömülü tarayıcılarda ve
// uygulama pencerelerinde hiç gösterilmez ve anında "iptal" döner; bu yüzden
// onay isteyen işlemler (hesabı dondur, tüm cihazlardan çık, sil, engelle)
// çalışmıyordu. Bunun yerine uygulamanın kendi onay penceresi kullanılır:
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title, message, confirmLabel, danger: true }))) return;
//
// Metin de verilebilir: await confirm('Bu fotoğraf silinsin mi?')
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { title: options } : options;
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest({
        title: opts.title || 'Emin misin?',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'Onayla',
        cancelLabel: opts.cancelLabel || 'Vazgeç',
        danger: opts.danger !== false,
      });
    });
  }, []);

  function close(result) {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <ConfirmDialog request={request} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ request, onClose }) {
  const { t } = useI18n();
  const cancelRef = useRef(null);

  useEffect(() => {
    // Güvenli varsayılan: odak "Vazgeç"te; Enter'a yanlışlıkla basmak işlemi yapmaz
    cancelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay confirm-overlay" onClick={() => onClose(false)}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={request.message ? 'confirm-message' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title">{t(request.title)}</h3>
        {request.message && <p id="confirm-message">{t(request.message)}</p>}
        <div className="confirm-actions">
          <button ref={cancelRef} type="button" className="confirm-btn cancel" onClick={() => onClose(false)}>
            {t(request.cancelLabel)}
          </button>
          <button type="button" className={`confirm-btn ${request.danger ? 'danger' : 'primary'}`} onClick={() => onClose(true)}>
            {t(request.confirmLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm, ConfirmProvider içinde kullanılmalı');
  return ctx;
}
