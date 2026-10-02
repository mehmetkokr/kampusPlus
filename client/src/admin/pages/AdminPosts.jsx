import React, { useEffect, useState, useCallback } from 'react';
import { Search, Trash2, Heart, MessageCircle } from 'lucide-react';
import adminApi from '../adminApi';
import { API_BASE_URL } from '../../config';
import { useConfirm } from '../../context/ConfirmContext';

export default function AdminPosts() {
  const confirm = useConfirm();
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 20;

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getPosts({ search, page, pageSize })
      .then((res) => {
        setPosts(res.data.posts);
        setTotal(res.data.total);
      })
      .catch((err) => {
        console.error('İlanlar alınamadı:', err);
        setError('İlanlar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!await confirm('Bu ilan kalıcı olarak silinsin mi?')) return;
    try {
      await adminApi.deletePost(id);
      load();
    } catch (err) {
      alert('İlan silinemedi.');
    }
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div>
      <h1 className="admin-page-title">İlanlar</h1>
      <p className="admin-page-sub">Toplam {total} ilan. (Kullanıcıların akışta paylaştığı gönderiler.)</p>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
          <input className="admin-input" placeholder="Açıklama veya yazar ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="admin-btn" type="submit"><Search size={14} /></button>
        </form>

        {loading ? (
          <div className="admin-loading">Yükleniyor...</div>
        ) : posts.length === 0 ? (
          <div className="admin-empty">İlan bulunamadı.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Görsel</th>
                  <th>Açıklama</th>
                  <th>Yazar</th>
                  <th>Etkileşim</th>
                  <th>Tarih</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.imageUrl ? (
                        <img
                          src={`${API_BASE_URL}${p.imageUrl}`}
                          alt=""
                          style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
                        />
                      ) : (
                        <span className="muted" style={{ fontSize: 11 }}>Metin</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 260 }}>{p.caption || <span className="muted">—</span>}</td>
                    <td>{p.author?.fullName}<br /><span className="admin-page-sub" style={{ margin: 0 }}>{p.author?.email}</span></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 10 }}>
                        <Heart size={13} /> {p._count?.likes ?? 0}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MessageCircle size={13} /> {p._count?.comments ?? 0}
                      </span>
                    </td>
                    <td>{new Date(p.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td>
                      <button className="admin-btn admin-btn-small admin-btn-danger" onClick={() => handleDelete(p.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-pagination">
          <span>Sayfa {page} / {totalPages}</span>
          <div className="admin-row-actions">
            <button className="admin-btn admin-btn-outline admin-btn-small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Önceki</button>
            <button className="admin-btn admin-btn-outline admin-btn-small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sonraki</button>
          </div>
        </div>
      </div>
    </div>
  );
}
