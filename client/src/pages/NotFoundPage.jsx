import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="container center-text" style={{ paddingTop: '80px' }}>
      <div className="empty-icon is-glyph is-large"><Compass size={34} strokeWidth={1.7} /></div>
      <h2 className="page-title">{t("Sayfa bulunamadı")}</h2>
      <p className="muted">{t("Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.")}</p>
      <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/')}>
        {t("Ana sayfaya dön")}
      </button>
    </div>
  );
}
