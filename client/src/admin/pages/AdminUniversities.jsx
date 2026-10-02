import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import adminApi from '../adminApi';
import { useConfirm } from '../../context/ConfirmContext';

export default function AdminUniversities() {
  const confirm = useConfirm();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');

  function load() {
    setLoading(true);
    adminApi
      .getUniversities()
      .then((res) => setList(res.data))
      .catch((err) => {
        console.error('Üniversiteler alınamadı:', err);
        setError('Üniversiteler yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await adminApi.createUniversity({ name: newName.trim(), emailDomain: newDomain.trim() || null });
      setNewName('');
      setNewDomain('');
      setShowAdd(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Üniversite eklenemedi.');
    }
  }

  function startEdit(u) {
    setEditingId(u.id);
    setEditName(u.name);
    setEditDomain(u.emailDomain || '');
  }

  async function saveEdit(id) {
    try {
      await adminApi.updateUniversity(id, { name: editName.trim(), emailDomain: editDomain.trim() || null });
      setEditingId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Güncellenemedi.');
    }
  }

  async function handleDelete(u) {
    if (!await confirm(`"${u.name}" silinsin mi?`)) return;
    try {
      await adminApi.deleteUniversity(u.id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Silinemedi.');
    }
  }

  const filtered = list.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h1 className="admin-page-title">Üniversiteler</h1>
      <p className="admin-page-sub">Toplam {list.length} üniversite kayıtlı.</p>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <div className="admin-toolbar">
          <input className="admin-input" placeholder="Üniversite ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="admin-btn" onClick={() => setShowAdd((s) => !s)}>
            <Plus size={14} /> Yeni Üniversite
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="admin-toolbar" style={{ marginBottom: 16 }}>
            <input className="admin-input" placeholder="Üniversite adı" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <input className="admin-input" placeholder="E-posta domaini (örn. itu.edu.tr) - opsiyonel" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
            <button className="admin-btn" type="submit">Ekle</button>
          </form>
        )}

        {loading ? (
          <div className="admin-loading">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">Üniversite bulunamadı.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>E-posta Domaini</th>
                  <th>Öğrenci</th>
                  <th>Kulüp</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    {editingId === u.id ? (
                      <>
                        <td><input className="admin-input" value={editName} onChange={(e) => setEditName(e.target.value)} /></td>
                        <td><input className="admin-input" value={editDomain} onChange={(e) => setEditDomain(e.target.value)} /></td>
                        <td>{u._count?.users ?? 0}</td>
                        <td>{u._count?.clubs ?? 0}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button className="admin-btn admin-btn-small" onClick={() => saveEdit(u.id)}><Check size={14} /></button>
                            <button className="admin-btn admin-btn-outline admin-btn-small" onClick={() => setEditingId(null)}><X size={14} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{u.name}</td>
                        <td>{u.emailDomain || '—'}</td>
                        <td>{u._count?.users ?? 0}</td>
                        <td>{u._count?.clubs ?? 0}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button className="admin-btn admin-btn-small admin-btn-outline" onClick={() => startEdit(u)}><Pencil size={14} /></button>
                            <button className="admin-btn admin-btn-small admin-btn-danger" onClick={() => handleDelete(u)}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </>
                    )}
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
