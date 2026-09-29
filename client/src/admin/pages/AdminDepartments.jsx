import React, { useEffect, useState } from 'react';
import adminApi from '../adminApi';

export default function AdminDepartments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    adminApi
      .getDepartments()
      .then((res) => setRows(res.data))
      .catch((err) => {
        console.error('Bölümler alınamadı:', err);
        setError('Bölümler yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(
    (r) =>
      r.department.toLowerCase().includes(search.toLowerCase()) ||
      r.university.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="admin-page-title">Bölümler</h1>
      <p className="admin-page-sub">
        Öğrencilerin profillerine girdiği bölümler, üniversiteye göre gruplanmış halde. Bölüm alanı şu an serbest
        metin olduğu için burada sadece görüntüleme var; yazım farklılıkları (örn. "Bilgisayar Müh." / "Bilgisayar
        Mühendisliği") ayrı satır olarak görünebilir.
      </p>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <div className="admin-toolbar">
          <input
            className="admin-input"
            placeholder="Bölüm veya üniversite ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="admin-loading">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">Kayıtlı bölüm bulunamadı.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Bölüm</th>
                  <th>Üniversite</th>
                  <th>Öğrenci Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td>{r.department}</td>
                    <td>{r.university.name}</td>
                    <td>
                      <span className="admin-badge admin-badge-amber">{r.studentCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
