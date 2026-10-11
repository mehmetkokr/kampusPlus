import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n';
import { reportError } from '../lib/telemetry';

// Yeni sürüm yayınlanınca açık sekmedeki eski sayfa artık var olmayan bir
// parçayı istemeye çalışabilir; bu durumda sayfa bir kez kendiliğinden yenilenir.
const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const RELOAD_FLAG = 'kp-chunk-reload';

function Fallback({ onRetry }) {
  const { t } = useI18n();
  return (
    <div role="alert" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 360 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px' }}>{t('Bir şeyler ters gitti')}</h1>
        <p className="muted" style={{ margin: '0 0 20px', lineHeight: 1.5 }}>
          {t('Bu ekran açılırken bir sorun çıktı. Ekibimize otomatik olarak bildirildi.')}
        </p>
        <button type="button" className="btn-primary" onClick={onRetry} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <RotateCcw size={16} aria-hidden="true" /> {t('Sayfayı yenile')}
        </button>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (CHUNK_ERROR.test(error?.message || '')) {
      let reloaded = false;
      try {
        reloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {
        // depolama yoksa döngüye girmemek için yenileme yapılmaz
        reloaded = true;
      }
      if (!reloaded) {
        window.location.reload();
        return;
      }
    }
    reportError(error, { componentStack: info?.componentStack });
  }

  componentDidUpdate(prevProps) {
    // Başka sayfaya geçilince hata ekranı kapanır
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error) return <Fallback onRetry={() => window.location.reload()} />;
    return this.props.children;
  }
}
