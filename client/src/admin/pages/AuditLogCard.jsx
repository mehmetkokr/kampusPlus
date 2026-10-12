import React, { useEffect, useState } from 'react';
import { History } from '../../components/icons';
import adminApi, { errorText } from '../adminApi';
import { Empty, Pager, Skeleton, fmtDateTime, timeAgo } from '../ui';

// İşlem kaydındaki ayrıntıyı okunur kısa metne çevir
function detailText(json) {
  if (!json) return '';
  try {
    const d = JSON.parse(json);
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' · ');
  } catch {
    return json;
  }
}

// Sistem: yönetici işlem kaydı (kim, ne zaman, ne yaptı)
export default function AuditLogCard() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    adminApi
      .getAudit({ page })
      .then((r) => alive && setData(r.data))
      .catch((err) => alive && setError(errorText(err, 'İşlem kaydı yüklenemedi.')));
    return () => {
      alive = false;
    };
  }, [page]);

  return (
    <section className="adm-card" style={{ marginTop: 14 }}>
      <h2 className="adm-card-title">
        <span>
          <History size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
          Yönetici işlem kaydı
        </span>
      </h2>
      <p className="adm-card-sub">Panelden yapılan her değişiklik ve yedek indirme burada kalır. Şifre ve kod gibi gizli alanlar kaydedilmez.</p>
      {error && <div className="adm-error">{error}</div>}
      {!data ? (
        <Skeleton h={160} />
      ) : data.entries.length === 0 ? (
        <Empty icon={History}>Henüz kayıt yok.</Empty>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>İşlem</th>
                  <th className="hide-sm">Yönetici</th>
                  <th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ maxWidth: 420 }}>
                      <div style={{ fontWeight: 600 }}>
                        {e.action}
                        {e.targetId ? <span className="adm-muted"> · #{e.targetId}</span> : null}
                      </div>
                      {e.details && (
                        <div className="adm-muted" style={{ fontSize: 12.5, wordBreak: 'break-word' }}>
                          {detailText(e.details)}
                        </div>
                      )}
                    </td>
                    <td className="hide-sm adm-muted">{e.adminName}</td>
                    <td className="adm-muted" title={fmtDateTime(e.createdAt)}>
                      {timeAgo(e.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
    </section>
  );
}
