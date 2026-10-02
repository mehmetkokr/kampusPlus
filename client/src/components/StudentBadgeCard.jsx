import React, { useRef, useState } from 'react';
import { BadgeCheck, Clock, FileText, Loader2, Upload, X } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';

const DISMISS_KEY = 'kp-badge-card-dismissed';

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

// "Onaylı öğrenci" rozeti (yeşil tik) için belge yükleme kartı.
// variant="home": Keşfet'te kısa çağrı (onaylıysa hiç görünmez, oturum boyunca kapatılabilir)
// variant="profile": profilde tam kart (tüm durumlar)
export default function StudentBadgeCard({ user, setUser, variant = 'profile' }) {
  const { t } = useI18n();
  const toast = useToast();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!user) return null;
  const status = user.studentDocStatus || 'none';
  if (variant === 'home' && (status === 'approved' || dismissed)) return null;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('studentDoc', file);
      const res = await api.post('/profile/verification-document', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser((prev) => ({
        ...prev,
        studentDocStatus: res.data.studentDocStatus,
        verificationStatus: res.data.verificationStatus,
        rejectionReason: null,
      }));
      toast.success('Belgen incelemeye alındı. Sonucu bildirim ve e-posta ile haber vereceğiz.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Belge yüklenemedi.');
    } finally {
      setUploading(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // depolama kapalıysa yalnızca bu görünümde gizlenir
    }
  }

  const fileInput = (
    <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={handleFile} />
  );

  const uploadButton = (label) => (
    <button type="button" className="btn badge-card-btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
      {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
      {uploading ? t("Yükleniyor…") : label}
    </button>
  );

  if (status === 'approved') {
    return (
      <div className="badge-card is-approved" id="student-badge">
        <span className="badge-card-icon">
          <BadgeCheck size={20} />
        </span>
        <div>
          <strong>{t("Onaylı öğrencisin")}</strong>
          <p>{t("Öğrenci belgen onaylandı; isminin yanında yeşil tik görünüyor.")}</p>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="badge-card is-pending" id="student-badge">
        <span className="badge-card-icon">
          <Clock size={20} />
        </span>
        <div>
          <strong>{t("Belgen inceleniyor")}</strong>
          <p>{t("Ekibimiz belgeni kontrol ediyor. Sonucu bildirim ve e-posta ile haber vereceğiz.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`badge-card ${variant === 'home' ? 'is-home' : ''} ${status === 'rejected' ? 'is-rejected' : ''}`} id="student-badge">
      {variant === 'home' && (
        <button type="button" className="badge-card-close" onClick={dismiss} aria-label={t("Şimdilik gizle")}>
          <X size={16} />
        </button>
      )}
      <div className="badge-card-head">
        <span className="badge-card-icon">
          <BadgeCheck size={20} />
        </span>
        <div>
          <strong>{status === 'rejected' ? t("Belgen onaylanmadı") : t("Onaylı öğrenci ol")}</strong>
          <p>
            {status === 'rejected'
              ? user.rejectionReason || t("Belge okunamadı ya da güncel değildi. Yeni bir belgeyle tekrar dene.")
              : t("Aktif öğrenci belgeni yükle, isminin yanında yeşil tik görünsün. Diğer öğrenciler seninle daha güvenle iletişime geçer.")}
          </p>
        </div>
      </div>

      {variant === 'profile' && (
        <ul className="badge-card-options">
          <li>
            <FileText size={16} />
            <span>
              <strong>{t("e-Devlet öğrenci belgesi")}</strong>
              <small>{t("turkiye.gov.tr → \"Öğrenci Belgesi Sorgulama\"dan barkodlu PDF")}</small>
            </span>
          </li>
        </ul>
      )}

      <div className="badge-card-actions">
        {uploadButton(t(status === 'rejected' ? 'Yeni belge yükle' : 'Belge yükle'))}
        <small>{t("Yalnızca e-Devlet barkodlu öğrenci belgesi (PDF). Belgen yalnızca inceleme ekibine görünür.")}</small>
      </div>
      {fileInput}
    </div>
  );
}
