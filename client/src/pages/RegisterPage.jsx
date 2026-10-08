import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Eye, EyeOff, Check, Mail, RotateCw } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthBackdrop from '../components/AuthBackdrop';
import CubeLoader from '../components/CubeLoader';
import UniversitySelect from '../components/UniversitySelect';
import { minDuration } from '../utils/wait';
import { toTitleCaseTR, normalizeEmail } from '../utils/text';
import { useI18n } from '../i18n';
import ThemeToggle from '../components/ThemeToggle';

const PASSWORD_MIN = 8;
const CODE_LENGTH = 6;

// Basit şifre gücü: uzunluk + harf/rakam/sembol çeşitliliği
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= PASSWORD_MIN) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[a-zçğıöşü]/.test(pw) && /[A-ZÇĞİÖŞÜ]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/.test(pw)) score += 1;
  const labels = ['Çok zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü', 'Çok güçlü'];
  return { score, label: labels[score] };
}

export default function RegisterPage() {
  const { t: tx } = useI18n();
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState('details'); // details | code
  const [universities, setUniversities] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    universityId: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false); // hesap oluşturuluyor
  const [sending, setSending] = useState(false); // kod gönderiliyor

  // Doğrulama kodu adımı
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(''));
  const [codeError, setCodeError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [devConsole, setDevConsole] = useState(false);
  const codeRefs = useRef([]);

  useEffect(() => {
    api
      .get('/universities')
      .then((res) => setUniversities(res.data))
      .catch(() => toast.error('Üniversite listesi yüklenemedi. Sayfayı yenilemeyi dene.'));
    // Sadece sayfa açılışında bir kez çalışsın istiyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Kodu tekrar gönder" geri sayımı
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Alandan çıkınca adı Türkçe harf kurallarıyla, e-postayı küçük harfle düzelt
  function handleBlur(e) {
    const { name, value } = e.target;
    if (name === 'fullName') setForm((f) => ({ ...f, fullName: toTitleCaseTR(value) }));
    if (name === 'email') setForm((f) => ({ ...f, email: normalizeEmail(value) }));
  }

  const strength = passwordStrength(form.password);
  const selectedUni = universities.find((u) => String(u.id) === String(form.universityId));
  const emailDomain = normalizeEmail(form.email).split('@')[1] || '';
  const uniDomain = selectedUni?.emailDomain?.toLowerCase();
  const domainMismatch =
    uniDomain && emailDomain && emailDomain !== uniDomain && !emailDomain.endsWith('.' + uniDomain);

  // 1. adım → e-postaya kod gönder
  async function sendCode(e) {
    e?.preventDefault();
    if (!form.universityId) return toast.error('Lütfen üniversiteni seç.');
    if (domainMismatch) {
      document.getElementById('reg-email')?.focus();
      return toast.error(tx('Doğrulama kodu yalnızca okul e-postana gönderilir. @{domain} ile biten adresini gir.', { domain: selectedUni.emailDomain }));
    }
    if (form.password.length < PASSWORD_MIN) return toast.error(tx('Şifre en az {n} karakter olmalı.', { n: PASSWORD_MIN }));

    setSending(true);
    try {
      const res = await api.post('/auth/register/send-code', {
        email: normalizeEmail(form.email),
        universityId: form.universityId,
      });
      setDevConsole(!!res.data.devConsole);
      setResendIn(res.data.resendInSec || 60);
      setCode(Array(CODE_LENGTH).fill(''));
      setCodeError('');
      setStep('code');
      setTimeout(() => codeRefs.current[0]?.focus(), 50);
    } catch (err) {
      const retry = err.response?.data?.retryAfter;
      if (retry) {
        // Kod zaten gönderilmiş; kod adımına geç, geri sayımı sunucuya göre ayarla
        setResendIn(retry);
        setStep('code');
      }
      toast.error(err.response?.data?.error || 'Doğrulama kodu gönderilemedi.');
    } finally {
      setSending(false);
    }
  }

  function setDigit(i, v) {
    const digits = v.replace(/\D/g, '');
    // Otomatik doldurma (iOS/Android "one-time-code") ya da hızlı yazım tek
    // kutuya birden çok rakam bırakabilir: bunları sıradaki kutulara dağıt.
    // Dolu kutuya tek rakam yazıldıysa (ör. "25") yalnızca yenisini al.
    const spread = digits.length > 2 || (digits.length === 2 && !code[i]);
    const chunk = spread ? digits.slice(0, CODE_LENGTH - i) : digits.slice(-1);
    setCode((prev) => {
      const next = [...prev];
      if (!chunk) next[i] = '';
      [...chunk].forEach((d, k) => {
        next[i + k] = d;
      });
      return next;
    });
    setCodeError('');
    if (chunk) codeRefs.current[Math.min(i + chunk.length, CODE_LENGTH - 1)]?.focus();
  }

  function onCodeKeyDown(i, e) {
    if (e.key === 'Backspace' && !code[i] && i > 0) codeRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) codeRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) codeRefs.current[i + 1]?.focus();
  }

  function onCodePaste(e) {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!digits) return;
    e.preventDefault();
    const next = Array(CODE_LENGTH).fill('').map((_, i) => digits[i] || '');
    setCode(next);
    codeRefs.current[Math.min(digits.length, CODE_LENGTH - 1)]?.focus();
  }

  // 2. adım → kodla birlikte hesabı oluştur
  async function register(e) {
    e.preventDefault();
    const joined = code.join('');
    if (joined.length !== CODE_LENGTH) return setCodeError(tx('6 haneli kodun tamamını gir.'));

    setLoading(true);
    const waitSuccess = minDuration(1400);
    const waitError = minDuration(600);
    try {
      const res = await api.post('/auth/register', {
        ...form,
        fullName: toTitleCaseTR(form.fullName),
        email: normalizeEmail(form.email),
        code: joined,
      });
      await waitSuccess();
      login(res.data.token, res.data.user, true);
      // Yeni hesap: başlangıç adımları (seni tanıyalım, fotoğraf, ilgi alanları, takip)
      navigate('/welcome');
    } catch (err) {
      await waitError();
      const data = err.response?.data || {};
      if (data.codeError) {
        setCodeError(data.error);
        if (data.codeError !== 'invalid') setResendIn(0); // süresi doldu / kilitlendi → hemen yeni kod istenebilsin
        setCode(Array(CODE_LENGTH).fill(''));
        codeRefs.current[0]?.focus();
      } else {
        toast.error(data.error || 'Kayıt sırasında bir hata oluştu.');
        // Kod dışı bir hata (ör. e-posta alındı) → bilgileri düzeltmek için geri dön
        if (err.response?.status === 400 || err.response?.status === 409) setStep('details');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <AuthBackdrop />
      {loading && <CubeLoader mode="overlay" label={tx("Hesabın oluşturuluyor")} />}

      <ThemeToggle className="auth-theme-toggle" />

      <Link to="/" className="auth-back">
        <ArrowLeft size={15} /> {tx("Anasayfa")}
      </Link>

      <div className="auth-content">
        <div className="auth-wordmark">
          {tx("kampüs")}<span className="dot">·</span>
        </div>
        <p className="auth-tagline">{tx("sadece kendi üniversitenden insanlarla tanış")}</p>

        <ol className="register-steps" aria-label={tx("Kayıt adımları")}>
          <li className={step === 'details' ? 'is-current' : 'is-done'}>
            <span>{step === 'details' ? '1' : <Check size={12} strokeWidth={3} />}</span> {tx("Bilgilerin")}
          </li>
          <li className={step === 'code' ? 'is-current' : ''}>
            <span>2</span> {tx("E-posta doğrulama")}
          </li>
          <li>
            <span>3</span> {tx("Profilin")}
          </li>
        </ol>

        <div className="auth-card">
          {step === 'details' ? (
            <>
              <h2>{tx("Hesap oluştur")}</h2>
              <p className="muted">{tx("Üniversite e-postanla katıl")}</p>

              <form onSubmit={sendCode}>
                <label htmlFor="reg-name">{tx("Ad Soyad")}</label>
                <input id="reg-name" name="fullName" value={form.fullName} onChange={handleChange} onBlur={handleBlur} autoComplete="name" required />

                <label htmlFor="reg-uni">{tx("Üniversite")}</label>
                <UniversitySelect
                  id="reg-uni"
                  universities={universities}
                  value={form.universityId}
                  onChange={(v) => setForm((f) => ({ ...f, universityId: v }))}
                  required
                />

                <label htmlFor="reg-email">{tx("Üniversite E-posta Adresi")}</label>
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="email"
                  aria-invalid={!!domainMismatch}
                  aria-describedby="reg-email-hint"
                  className={domainMismatch ? 'is-invalid' : ''}
                  placeholder={selectedUni?.emailDomain ? `ornek@${selectedUni.emailDomain}` : tx("ornek@ogrenci.universite.edu.tr")}
                  required
                />
                {domainMismatch ? (
                  <p id="reg-email-hint" className="field-hint field-hint-warn">
                    {tx('Bu adres @{domain} ile bitmiyor. Doğrulama kodu yalnızca okul e-postana gönderilir.', { domain: selectedUni.emailDomain })}
                  </p>
                ) : (
                  <p id="reg-email-hint" className="field-hint">
                    {selectedUni?.emailDomain
                      ? tx('Doğrulama kodu bu adrese gönderilir. Yalnızca @{domain} uzantılı okul e-postası kabul edilir.', { domain: selectedUni.emailDomain })
                      : tx('Önce üniversiteni seç; doğrulama kodu yalnızca okul e-postana gönderilir.')}
                  </p>
                )}

                <label htmlFor="reg-pass">{tx("Şifre")}</label>
                <div className="password-field-wrap">
                  <input
                    id="reg-pass"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    minLength={PASSWORD_MIN}
                    placeholder={tx('En az {n} karakter', { n: PASSWORD_MIN })}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? tx("Şifreyi gizle") : tx("Şifreyi göster")}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {form.password && (
                  <div className={`pw-strength s-${strength.score}`} aria-live="polite">
                    <span className="pw-strength-bar">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <i key={n} className={n <= strength.score ? 'on' : ''} />
                      ))}
                    </span>
                    {tx(strength.label)}
                  </div>
                )}

                <p className="field-hint register-next-note">{tx("Doğum tarihi, bölüm ve ne aradığın gibi bilgileri e-postanı doğruladıktan sonra soracağız.")}</p>

                <button className="btn" type="submit" disabled={sending}>
                  {sending ? tx("Kod gönderiliyor…") : tx("Devam et")}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={register} className="code-step">
              <span className="code-step-icon" aria-hidden="true">
                <Mail size={22} />
              </span>
              <h2>{tx("E-postanı doğrula")}</h2>
              <p className="muted">
                {tx('{email} adresine 6 haneli bir kod gönderdik. Kod 10 dakika geçerli.', { email: normalizeEmail(form.email) })}
              </p>

              <div className="code-inputs" onPaste={onCodePaste}>
                {code.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (codeRefs.current[i] = el)}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onCodeKeyDown(i, e)}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    aria-label={tx('Kodun {n}. hanesi', { n: i + 1 })}
                    className={codeError ? 'is-invalid' : ''}
                  />
                ))}
              </div>
              {codeError && <p className="error-text code-error">{codeError}</p>}

              {devConsole && (
                <p className="field-hint code-dev-note">
                  {tx("Geliştirme ortamı: e-posta sunucusu (SMTP) ayarlı olmadığı için kod, sunucu konsoluna yazıldı.")}
                </p>
              )}

              <button className="btn" type="submit" disabled={loading || code.join('').length !== CODE_LENGTH}>
                {tx("Hesabı oluştur")}
              </button>

              <div className="code-actions">
                <button type="button" className="link-btn" disabled={resendIn > 0 || sending} onClick={sendCode}>
                  <RotateCw size={14} /> {resendIn > 0 ? `Kodu tekrar gönder (${resendIn} sn)` : tx("Kodu tekrar gönder")}
                </button>
                <button type="button" className="link-btn" onClick={() => setStep('details')}>
                  <ArrowLeft size={14} /> {tx("Bilgileri düzenle")}
                </button>
              </div>
            </form>
          )}

          <div className="auth-trust">
            <ShieldCheck size={13} /> {tx("Yalnızca doğrulanmış üniversite öğrencileri")}
          </div>
        </div>

        <p className="auth-foot">
          {tx("Zaten hesabın var mı?")} <Link to="/login">{tx("Giriş Yap")}</Link>
        </p>
      </div>
    </div>
  );
}
