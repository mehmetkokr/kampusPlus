import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ConfirmProvider } from './context/ConfirmContext.jsx';
import { PhotoEditorProvider } from './context/PhotoEditorContext.jsx';
import { I18nProvider } from './i18n';
import { installTelemetry } from './lib/telemetry';
import { registerServiceWorker } from './lib/pwa';
import { hideSplashWhenReady } from './lib/splash';
import './index.css';
import './styles/glass.css';
import './styles/campus-sky.css';
import './styles/photo-editor.css';

// Dil, hesabın tercihine bağlı olduğundan I18nProvider AuthProvider'ın
// içinde; bildirim ve onay pencereleri de çevrilebilsin diye onların dışında.
installTelemetry();
registerServiceWorker();
hideSplashWhenReady();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <I18nProvider>
          <ToastProvider>
            <ConfirmProvider>
              <PhotoEditorProvider>
                <App />
              </PhotoEditorProvider>
            </ConfirmProvider>
          </ToastProvider>
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
