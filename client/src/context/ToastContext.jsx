import React, { createContext, useContext, useCallback, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useI18n } from '../i18n';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const { t: translate } = useI18n();
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'error', duration = 4000) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration) {
        setTimeout(() => removeToast(id), duration);
      }
      return id;
    },
    [removeToast]
  );

  const toast = {
    error: (msg, duration) => showToast(msg, 'error', duration),
    success: (msg, duration) => showToast(msg, 'success', duration),
    info: (msg, duration) => showToast(msg, 'info', duration),
  };

  const ICONS = {
    error: <XCircle size={18} />,
    success: <CheckCircle2 size={18} />,
    info: <Info size={18} />,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">{ICONS[t.type]}</span>
            <span className="toast-message">{typeof t.message === 'string' ? translate(t.message) : t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)} aria-label={translate('Kapat')}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
