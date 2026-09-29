import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import adminApi from '../adminApi';

export default function AdminSettings() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handlePromote(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      // Kullanıcıyı e-postayla bulmak için basitçe kullanıcı listesinden arıyoruz
      const res = await adminApi.getUsers({ search: email, pageSize: 1 });
      const found = res.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!found) {
        setError('Bu e-posta ile kayıtlı bir kullanıcı bulunamadı.');
        return;
      }
      await adminApi.updateUser(found.id, { isAdmin: true });
      setMessage(`${found.fullName} artık admin.`);
      setEmail('');
    } catch (err) {
      setError('İşlem başarısız oldu.');
    }
  }

  return (
    <div>
      <h1 className="admin-page-title">Ayarlar</h1>
      <p className="admin-page-sub">Hesap bilgilerin ve admin yönetimi.</p>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>Hesabım</h3>
        <div className="admin-modal-body" style={{ maxWidth: 400 }}>
          <div>
            <span className="admin-field-label">Ad Soyad</span>
            {user?.fullName}
          </div>
          <div>
            <span className="admin-field-label">E-posta</span>
            {user?.email}
          </div>
          <div>
            <span className="admin-field-label">Yetki</span>
            <span className="admin-badge admin-badge-amber">Admin</span>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>Yeni Admin Ekle</h3>
        <p className="admin-page-sub" style={{ marginBottom: 12 }}>
          Bir kullanıcıyı e-posta adresiyle admin yapabilirsin (kullanıcının sitede zaten kayıtlı olması gerekir).
        </p>
        {message && <div className="admin-badge admin-badge-teal" style={{ marginBottom: 12 }}>{message}</div>}
        {error && <div className="admin-error">{error}</div>}
        <form className="admin-toolbar" onSubmit={handlePromote}>
          <input
            className="admin-input"
            type="email"
            placeholder="ornek@universite.edu.tr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="admin-btn" type="submit"><UserPlus size={14} /> Admin Yap</button>
        </form>
      </div>
    </div>
  );
}
