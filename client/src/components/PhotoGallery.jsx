import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, MoreHorizontal, Star, Trash2 } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useI18n } from '../i18n';
import { compressImage } from '../utils/image';

const MAX_PHOTOS = 6;

// Profil fotoğraf galerisi: en fazla 6 fotoğraf. İlk fotoğraf ana profil
// fotoğrafıdır; her fotoğrafın ⋯ menüsünden "Ana fotoğraf yap" ya da "Sil".
export default function PhotoGallery({ photos, onChange }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [menuFor, setMenuFor] = useState(null);

  async function handleAdd(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('photo', await compressImage(file));
      const res = await api.post('/profile/me/photos', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Fotoğraf eklenemedi.');
    } finally {
      setUploading(false);
    }
  }

  async function makeMain(photo) {
    setMenuFor(null);
    try {
      const res = await api.put(`/profile/me/photos/${photo.id}/main`);
      onChange(res.data);
      toast.success('Ana fotoğraf güncellendi.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'İşlem başarısız.');
    }
  }

  async function remove(photo) {
    setMenuFor(null);
    if (!await confirm('Bu fotoğrafı silmek istediğine emin misin?')) return;
    try {
      const res = await api.delete(`/profile/me/photos/${photo.id}`);
      onChange(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Fotoğraf silinemedi.');
    }
  }

  const slots = Array.from({ length: MAX_PHOTOS }, (_, i) => photos[i] || null);
  const firstEmpty = photos.length;

  return (
    <div className="photo-gallery">
      <div className="photo-gallery-head">
        <h4>{t("Fotoğrafların")}</h4>
        <span>
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>
      <p className="photo-gallery-hint">{t("İlk fotoğraf profil fotoğrafın olur. Kart Modu'nda tüm fotoğrafların gösterilir.")}</p>

      <div className="photo-gallery-grid">
        {slots.map((photo, i) =>
          photo ? (
            <div key={photo.id} className={`photo-slot filled ${i === 0 ? 'is-main' : ''}`}>
              <img src={`${API_BASE_URL}${photo.url}`} alt={`Fotoğraf ${i + 1}`} />
              {i === 0 && <span className="photo-main-badge">{t("Ana")}</span>}
              <button
                type="button"
                className="photo-slot-menu-btn"
                aria-label={t("Fotoğraf seçenekleri")}
                onClick={() => setMenuFor(menuFor === photo.id ? null : photo.id)}
              >
                <MoreHorizontal size={16} />
              </button>
              {menuFor === photo.id && (
                <div className="photo-slot-menu" role="menu">
                  {i !== 0 && (
                    <button role="menuitem" type="button" onClick={() => makeMain(photo)}>
                      <Star size={14} /> {t("Ana fotoğraf yap")}
                    </button>
                  )}
                  <button role="menuitem" type="button" className="danger" onClick={() => remove(photo)}>
                    <Trash2 size={14} /> {t("Sil")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              key={`empty-${i}`}
              type="button"
              className="photo-slot empty"
              disabled={uploading || i !== firstEmpty}
              onClick={() => fileRef.current?.click()}
              aria-label={t("Fotoğraf ekle")}
            >
              {uploading && i === firstEmpty ? <Loader2 size={20} className="spin" /> : <ImagePlus size={20} />}
            </button>
          )
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleAdd} />
    </div>
  );
}
