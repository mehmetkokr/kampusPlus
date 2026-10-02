import React, { useCallback, useEffect, useState } from 'react';
import { Info, Shield, ShieldOff, UserPlus } from 'lucide-react';
import adminApi, { errorText } from '../adminApi';
import { PageHead, Person, Skeleton, fmtDate, timeAgo } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

export default function AdminSettings() {
  const toast = useToast();
  const confirm = useConfirm();
  const [admins, setAdmins] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi
      .getAdmins()
      .then((res) => setAdmins(res.data))
      .catch((err) => toast.error(errorText(err, 'Yöneticiler yüklenemedi.')));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);

  async function add(e) {
    e.preventDefault();
    const ok = await confirm({
      title: `${email} yönetici yapılsın mı?`,
      message: 'Bu panele ve tüm öğrenci verilerine erişebilir. Yalnızca güvendiğin kişileri ekle.',
      confirmLabel: 'Yönetici yap',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await adminApi.addAdmin(email.trim());
      toast.success(res.data.message);
      setEmail('');
      load();
    } catch (err) {
      toast.error(errorText(err, 'Yönetici eklenemedi.'));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(a) {
    const ok = await confirm({ title: `${a.fullName} yöneticilikten çıkarılsın mı?`, confirmLabel: 'Çıkar', danger: true });
    if (!ok) return;
    try {
      await adminApi.updateUser(a.id, { isAdmin: false });
      toast.success('Yönetici yetkisi kaldırıldı.');
      load();
    } catch (err) {
      toast.error(errorText(err, 'Yetki kaldırılamadı.'));
    }
  }

  return (
    <div>
      <PageHead title="Ayarlar" sub="Panele kimlerin erişebileceğini yönet." />

      <div className="adm-grid adm-grid-main" style={{ alignItems: 'start' }}>
        <section className="adm-card">
          <h2 className="adm-card-title"><span><Shield size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Yöneticiler</span></h2>
          <p className="adm-card-sub">Yönetici hesapları öğrenci listelerinde (Keşfet, arama, Kart Modu) görünmez.</p>
          {!admins ? (
            <Skeleton h={140} />
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr><th>Yönetici</th><th className="hide-sm">Eklenme</th><th className="hide-sm">Son görülme</th><th /></tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td><Person user={a} meta={a.email} /></td>
                      <td className="hide-sm adm-muted">{fmtDate(a.createdAt)}</td>
                      <td className="hide-sm adm-muted">{timeAgo(a.lastSeenAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {a.isMe ? (
                          <span className="adm-badge amber">Sen</span>
                        ) : (
                          <button type="button" className="adm-btn danger-ghost small" onClick={() => revoke(a)}>
                            <ShieldOff /> Çıkar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="adm-card">
          <h2 className="adm-card-title">Yönetici ekle</h2>
          <p className="adm-card-sub">Kişinin uygulamada kayıtlı bir hesabı olmalı.</p>
          <form onSubmit={add} className="adm-grid" style={{ gap: 10 }}>
            <input className="adm-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@ogr.universite.edu.tr" aria-label="E-posta" />
            <button className="adm-btn" type="submit" disabled={busy}>
              <UserPlus /> Yönetici yap
            </button>
          </form>
          <div className="adm-note" style={{ marginTop: 16 }}>
            <Info />
            <span>
              Öğrenci hesaplarından ayrı bir yönetici hesabı açmak için sunucu klasöründe <code>npm run admin:create</code> komutunu kullan. Şifreyi orada sen belirlersin.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
