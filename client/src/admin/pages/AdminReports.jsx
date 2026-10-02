import React, { useCallback, useEffect, useState } from 'react';
import { Ban, CheckCircle2, Flag, Trash2, XCircle } from 'lucide-react';
import adminApi, { errorText, refreshCounts } from '../adminApi';
import { Empty, PageHead, Pager, Segmented, Skeleton, timeAgo } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

const STATUS = [
  { value: 'pending', label: 'Bekleyen' },
  { value: 'resolved', label: 'Çözülen' },
  { value: 'dismissed', label: 'Reddedilen' },
  { value: '', label: 'Tümü' },
];

const STATUS_BADGE = {
  pending: ['amber', 'Bekliyor'],
  reviewed: ['blue', 'İncelendi'],
  resolved: ['green', 'Çözüldü'],
  dismissed: ['', 'Reddedildi'],
};

const TYPE_LABEL = {
  user: 'Profil',
  post: 'Gönderi',
  comment: 'Yorum',
  message: 'Özel mesaj',
  club: 'Kulüp',
  club_message: 'Kulüp mesajı',
  story: 'Hikâye',
};

const REASON_LABEL = {
  spam: 'Spam',
  harassment: 'Taciz / zorbalık',
  inappropriate_content: 'Uygunsuz içerik',
  fake_profile: 'Sahte profil',
  other: 'Diğer',
};

const DELETABLE = ['post', 'comment', 'message', 'club_message', 'story', 'club'];

function targetText(r) {
  if (!r.target) return <span className="adm-faint">İçerik silinmiş</span>;
  switch (r.targetType) {
    case 'user':
      return `${r.target.fullName} (${r.target.email})`;
    case 'post':
      return r.target.caption || 'Açıklamasız gönderi';
    case 'story':
      return 'Fotoğraflı hikâye';
    case 'club':
      return r.target.name;
    default:
      return r.target.content || 'Medya mesajı';
  }
}

export default function AdminReports() {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    adminApi
      .getReports({ status, page, pageSize: 20 })
      .then((res) => setData(res.data))
      .catch((err) => toast.error(errorText(err, 'Şikayetler yüklenemedi.')));
  }, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);

  async function act(r, action) {
    const prompts = {
      ban_user: {
        title: `${r.owner?.fullName || 'Kullanıcı'} askıya alınsın mı?`,
        message: 'Hesaba giriş yapamaz ve listelerden kalkar. Kullanıcılar sayfasından geri alabilirsin.',
        confirmLabel: 'Askıya al',
        danger: true,
      },
      delete_content: {
        title: `${TYPE_LABEL[r.targetType]} silinsin mi?`,
        message: 'İçerik kalıcı olarak silinir.',
        confirmLabel: 'Sil',
        danger: true,
      },
    };
    if (prompts[action] && !(await confirm(prompts[action]))) return;
    setBusyId(r.id);
    try {
      const res = await adminApi.reportAction(r.id, action);
      refreshCounts();
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(errorText(err, 'İşlem yapılamadı.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHead title="Şikayetler" sub="Öğrencilerin bildirdiği profil ve içerikler. Tek tıkla içeriği sil, sahibini askıya al ya da şikayeti reddet.">
        <Segmented
          label="Durum"
          value={status}
          options={STATUS}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </PageHead>

      <section className="adm-card">
        {!data ? (
          <Skeleton h={260} />
        ) : data.reports.length === 0 ? (
          <Empty icon={Flag}>{status === 'pending' ? 'Bekleyen şikayet yok.' : 'Bu durumda şikayet yok.'}</Empty>
        ) : (
          data.reports.map((r) => {
            const [cls, label] = STATUS_BADGE[r.status] || ['', r.status];
            const open = r.status === 'pending' || r.status === 'reviewed';
            return (
              <article className="adm-campaign" key={r.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-campaign-meta" style={{ marginBottom: 6 }}>
                    <span className={`adm-badge ${cls}`}>{label}</span>
                    <span className="adm-badge">{TYPE_LABEL[r.targetType] || r.targetType}</span>
                    <span className="adm-badge red">{REASON_LABEL[r.reason] || r.reason}</span>
                    <span className="adm-faint">{timeAgo(r.createdAt)}</span>
                  </div>
                  <h4 className="adm-ellipsis" style={{ maxWidth: '100%' }}>{targetText(r)}</h4>
                  {r.description && <p>“{r.description}”</p>}
                  <span className="adm-faint">
                    Bildiren: {r.reporter?.fullName || 'silinmiş hesap'}
                    {r.owner && r.targetType !== 'user' ? ` · İçerik sahibi: ${r.owner.fullName}` : ''}
                    {r.previousReports > 1 ? ` · Bu kişi hakkında toplam ${r.previousReports} profil şikayeti var` : ''}
                    {r.owner?.isBanned ? ' · Sahibi askıda' : ''}
                  </span>
                </div>
                <div />
                {open && (
                  <div className="adm-campaign-actions">
                    {DELETABLE.includes(r.targetType) && r.target && (
                      <button type="button" className="adm-btn danger-ghost small" disabled={busyId === r.id} onClick={() => act(r, 'delete_content')}>
                        <Trash2 /> İçeriği sil
                      </button>
                    )}
                    {r.owner && !r.owner.isBanned && (
                      <button type="button" className="adm-btn danger-ghost small" disabled={busyId === r.id} onClick={() => act(r, 'ban_user')}>
                        <Ban /> Sahibini askıya al
                      </button>
                    )}
                    <button type="button" className="adm-btn ghost small" disabled={busyId === r.id} onClick={() => act(r, 'dismiss')}>
                      <XCircle /> Şikayeti reddet
                    </button>
                  </div>
                )}
                {!open && r.reviewedAt && (
                  <div className="adm-campaign-actions adm-faint">
                    <CheckCircle2 size={14} /> {timeAgo(r.reviewedAt)} karar verildi
                  </div>
                )}
              </article>
            );
          })
        )}
        {data && data.total > 20 && <Pager page={page} total={data.total} pageSize={20} onPage={setPage} />}
      </section>
    </div>
  );
}
