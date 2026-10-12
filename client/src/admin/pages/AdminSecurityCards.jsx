import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Trash2, X } from '../../components/icons';
import adminApi, { errorText } from '../adminApi';
import { Skeleton } from '../ui';
import { useToast } from '../../context/ToastContext';

// Ayarlar: yöneticinin kendi hesabı için iki adımlı doğrulama (TOTP)
export function TwoFactorCard() {
  const toast = useToast();
  const [state, setState] = useState(null); // { enabled, required }
  const [setup, setSetup] = useState(null); // { qr, secret }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi
      .get2fa()
      .then((r) => setState(r.data))
      .catch(() => setState({ enabled: false, required: false }));
  }, []);
  useEffect(load, [load]);

  async function start() {
    setBusy(true);
    try {
      const res = await adminApi.setup2fa();
      setSetup(res.data);
      setCode('');
    } catch (err) {
      toast.error(errorText(err, 'Kurulum başlatılamadı.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = state.enabled ? await adminApi.disable2fa(code) : await adminApi.enable2fa(code);
      toast.success(res.data.message);
      setSetup(null);
      setCode('');
      load();
    } catch (err) {
      toast.error(errorText(err, 'Kod doğrulanamadı.'));
    } finally {
      setBusy(false);
    }
  }

  const codeInput = (
    <input
      className="adm-input"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      placeholder="6 haneli kod"
      aria-label="Doğrulama kodu"
      style={{ letterSpacing: '0.25em', textAlign: 'center' }}
    />
  );

  return (
    <section className="adm-card">
      <h2 className="adm-card-title">
        <span>
          <KeyRound size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
          İki adımlı doğrulama
        </span>
        {state && <span className={`adm-badge ${state.enabled ? 'green' : 'red'}`}>{state.enabled ? 'Açık' : 'Kapalı'}</span>}
      </h2>
      <p className="adm-card-sub">
        Panel tüm öğrenci verilerine ve belgelere erişir. Açınca girişte şifrenin yanında telefonundaki kimlik doğrulama uygulamasının (Google
        Authenticator, 1Password vb.) kodu da istenir.
      </p>
      {!state ? (
        <Skeleton h={80} />
      ) : state.enabled ? (
        <form onSubmit={confirmCode} className="adm-grid" style={{ gap: 10 }}>
          {state.required ? (
            <p className="adm-muted" style={{ margin: 0 }}>
              Bu sunucuda yöneticiler için zorunlu; kapatılamaz.
            </p>
          ) : (
            <>
              {codeInput}
              <button className="adm-btn danger-ghost" type="submit" disabled={busy || code.length !== 6}>
                Kapatmak için kodu doğrula
              </button>
            </>
          )}
        </form>
      ) : setup ? (
        <form onSubmit={confirmCode} className="adm-grid" style={{ gap: 12, justifyItems: 'start' }}>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 14, fontWeight: 400 }}>
            <li>Kimlik doğrulama uygulamasında “Hesap ekle” ile QR kodu tara.</li>
            <li>Uygulamanın gösterdiği 6 haneli kodu yaz.</li>
          </ol>
          <img src={setup.qr} alt="İki adımlı doğrulama QR kodu" width={180} height={180} style={{ borderRadius: 12, background: '#fff', padding: 6 }} />
          <p className="adm-muted" style={{ margin: 0, fontSize: 13 }}>
            QR okutamıyorsan anahtarı elle gir: <code style={{ wordBreak: 'break-all' }}>{setup.secret}</code>
          </p>
          {codeInput}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="adm-btn" type="submit" disabled={busy || code.length !== 6}>
              <ShieldCheck /> Doğrula ve aç
            </button>
            <button className="adm-btn ghost" type="button" onClick={() => setSetup(null)}>
              <X /> Vazgeç
            </button>
          </div>
        </form>
      ) : (
        <>
          {state.required && (
            <div className="adm-error" style={{ marginBottom: 12 }}>
              Panele devam etmek için iki adımlı doğrulamayı açman gerekiyor.
            </div>
          )}
          <button className="adm-btn" type="button" onClick={start} disabled={busy}>
            <ShieldCheck /> Kurulumu başlat
          </button>
          <p className="adm-muted" style={{ marginTop: 12, fontSize: 13 }}>
            Telefonunu kaybedersen sunucu klasöründe <code>npm run admin:reset-2fa -- e-posta</code> ile kapatılabilir.
          </p>
        </>
      )}
    </section>
  );
}

// Ayarlar: yasaklı kelimeler (metinlerde yıldızlanır)
export function BannedWordsCard() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi
      .getBannedWords()
      .then((r) => setData(r.data))
      .catch((err) => toast.error(errorText(err, 'Kelimeler yüklenemedi.')));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await adminApi.addBannedWord(word);
      toast.success(res.data.message);
      setWord('');
      load();
    } catch (err) {
      toast.error(errorText(err, 'Kelime eklenemedi.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(w) {
    try {
      await adminApi.deleteBannedWord(w.id);
      load();
    } catch (err) {
      toast.error(errorText(err, 'Kelime kaldırılamadı.'));
    }
  }

  return (
    <section className="adm-card">
      <h2 className="adm-card-title">Yasaklı kelimeler</h2>
      <p className="adm-card-sub">
        Mesaj, gönderi, yorum, biyografi ve kulüp metinlerinde bu kelimeler ilk harfi kalacak şekilde yıldızlanır. Yaygın küfürlerden oluşan{' '}
        {data ? data.defaults : '…'} köklü varsayılan liste her zaman açıktır; buraya ekledikleriniz ona eklenir.
      </p>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          className="adm-input"
          style={{ flex: 1 }}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Kelime"
          aria-label="Yasaklanacak kelime"
          maxLength={40}
        />
        <button className="adm-btn" type="submit" disabled={busy || word.trim().length < 2}>
          Ekle
        </button>
      </form>
      {!data ? (
        <Skeleton h={60} />
      ) : data.words.length === 0 ? (
        <p className="adm-muted" style={{ margin: 0 }}>
          Henüz ek kelime yok.
        </p>
      ) : (
        <div className="adm-chips">
          {data.words.map((w) => (
            <span key={w.id} className="adm-chip" style={{ cursor: 'default' }}>
              {w.word}
              <button
                type="button"
                onClick={() => remove(w)}
                aria-label={`${w.word} kelimesini kaldır`}
                style={{ border: 0, background: 'none', padding: 2, cursor: 'pointer', color: 'inherit', display: 'grid' }}
              >
                <Trash2 size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
