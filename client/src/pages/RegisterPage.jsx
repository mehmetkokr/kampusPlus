import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthBackdrop from '../components/AuthBackdrop';
import { INTENT_OPTIONS } from '../constants/intents';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [universities, setUniversities] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    universityId: '',
    department: '',
    classYear: '',
  });
  const [studentDoc, setStudentDoc] = useState(null);
  const [intents, setIntents] = useState(['friendship']);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function toggleIntent(value) {
    setIntents((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  useEffect(() => {
    api
      .get('/universities')
      .then((res) => setUniversities(res.data))
      .catch((err) => {
        console.error('Üniversiteler alınamadı:', err);
        toast.error('Üniversite listesi yüklenemedi. Sayfayı yenilemeyi dene.');
      });
    // Sadece sayfa açılışında bir kez çalışsın istiyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      formData.append('intent', (intents.length ? intents : ['friendship']).join(','));
      if (studentDoc) formData.append('studentDoc', studentDoc);

      const res = await api.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      login(res.data.token, res.data.user, true);
      navigate('/discover');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <AuthBackdrop />

      <Link to="/" className="auth-back">
        <ArrowLeft size={15} /> Anasayfa
      </Link>

      <div className="auth-content">
        <div className="auth-wordmark">
          kampüs<span className="dot">·</span>
        </div>
        <p className="auth-tagline">sadece kendi üniversitenden insanlarla tanış</p>

        <div className="auth-card">
          <h2>Hesap oluştur</h2>
          <p className="muted">Üniversite e-postanla katıl</p>

          <form onSubmit={handleSubmit}>
            <label>Ad Soyad</label>
            <input name="fullName" value={form.fullName} onChange={handleChange} required />

            <label>Üniversite E-posta Adresi</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="ornek@ogrenci.universite.edu.tr"
              required
            />

            <label>Şifre</label>
            <div className="password-field-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                minLength={6}
                placeholder="En az 6 karakter"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <label>Üniversite</label>
            <select name="universityId" value={form.universityId} onChange={handleChange} required>
              <option value="">Seçiniz...</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            <label>Bölüm (opsiyonel)</label>
            <input name="department" value={form.department} onChange={handleChange} />

            <label>Sınıf (opsiyonel)</label>
            <select name="classYear" value={form.classYear} onChange={handleChange}>
              <option value="">Seçiniz...</option>
              <option value="1">1. Sınıf</option>
              <option value="2">2. Sınıf</option>
              <option value="3">3. Sınıf</option>
              <option value="4">4. Sınıf</option>
              <option value="5">Yüksek Lisans / Diğer</option>
            </select>

            <label>Ne arıyorsun? (en az bir tane seç)</label>
            <div className="intent-select-grid">
              {INTENT_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className={`intent-toggle ${intents.includes(opt.value) ? 'active' : ''}`}
                  onClick={() => toggleIntent(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label>Öğrenci Belgesi (e-postanız okul domaini değilse gerekli)</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setStudentDoc(e.target.files[0])}
            />

            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Kaydediliyor...' : 'Kayıt Ol'}
            </button>
          </form>

          <div className="auth-trust">
            <ShieldCheck size={13} /> Üniversite e-postanla anında doğrulanır
          </div>
        </div>

        <p className="auth-foot">
          Zaten hesabın var mı? <Link to="/login">Giriş Yap</Link>
        </p>
      </div>
    </div>
  );
}
