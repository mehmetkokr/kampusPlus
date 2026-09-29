import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="container center-text" style={{ paddingTop: '80px' }}>
      <div className="empty-icon" style={{ fontSize: '48px' }}>🧭</div>
      <h2 className="page-title">Sayfa bulunamadı</h2>
      <p className="muted">Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.</p>
      <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/')}>
        Ana sayfaya dön
      </button>
    </div>
  );
}
