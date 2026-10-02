import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, Copy, FlaskConical, Info, Mail, Megaphone, PanelTop, Send, Trash2, Users, XCircle } from 'lucide-react';
import adminApi, { errorText } from '../adminApi';
import { CLASS_LABELS, INTENT_LABELS, INTENT_OPTIONS, PageHead, Skeleton, fmt, fmtDateTime } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

const EMPTY_AUDIENCE = {
  universityIds: [],
  classYears: [],
  intents: [],
  premium: 'any',
  badge: 'any',
  inactiveDays: null,
  joinedWithinDays: null,
  incompleteProfile: false,
};

// Hazır kitleler: pazarlamada en sık kullanılan bölümler
const PRESETS = [
  { key: 'all', label: 'Tüm öğrenciler', audience: {} },
  { key: 'new', label: 'Yeni gelenler (7 gün)', audience: { joinedWithinDays: 7 } },
  { key: 'sleep', label: 'Uyuyanlar (14+ gün girmeyen)', audience: { inactiveDays: 14 } },
  { key: 'incomplete', label: 'Profili eksik olanlar', audience: { incompleteProfile: true } },
  { key: 'free', label: 'Premium olmayanlar', audience: { premium: 'no' } },
  { key: 'nobadge', label: 'Rozeti olmayanlar', audience: { badge: 'no' } },
];

// Hazır mesaj şablonları
const TEMPLATES = [
  {
    label: 'Hoş geldin',
    title: 'Kampüsüne hoş geldin 👋',
    body: 'Seninle aynı okulda okuyan öğrenciler seni bekliyor. Kart Modu ile ilk tanışmanı bugün yap!',
    link: '/discover/swipe',
    preset: 'new',
  },
  {
    label: 'Seni özledik',
    title: 'Kampüste neler oluyor, kaçırma',
    body: 'Sen yokken yeni öğrenciler katıldı ve kulüplerde yeni etkinlikler açıldı. Bir göz at!',
    link: '/discover',
    preset: 'sleep',
  },
  {
    label: 'Profilini tamamla',
    title: 'Profilini tamamla, 3 kat daha fazla eşleş',
    body: 'Fotoğrafı ve ilgi alanları olan profiller çok daha fazla ilgi görüyor. 1 dakikanı ayır.',
    link: '/profile',
    preset: 'incomplete',
  },
  {
    label: 'Etkinlik duyurusu',
    title: 'Bu hafta kampüste',
    body: 'Kulüplerde bu hafta yeni etkinlikler var. Arkadaşlarınla katıl, yeni insanlarla tanış.',
    link: '/clubs',
    preset: 'all',
  },
  {
    label: 'Premium fırsatı',
    title: 'Premium’u keşfet',
    body: 'Seni kimlerin beğendiğini gör, diğer kampüslerdeki öğrencilerle tanış. Sınırlı süre için özel fiyat!',
    link: '/settings',
    preset: 'free',
  },
];

const LINKS = [
  { value: '', label: 'Bağlantı yok' },
  { value: '/discover', label: 'Keşfet' },
  { value: '/discover/swipe', label: 'Kart Modu' },
  { value: '/clubs', label: 'Kulüpler' },
  { value: '/feed', label: 'Akış' },
  { value: '/matches', label: 'Eşleşmeler' },
  { value: '/profile', label: 'Profil' },
  { value: '/settings', label: 'Ayarlar / Premium' },
];

const CHANNELS = [
  { key: 'notification', icon: Bell, label: 'Uygulama bildirimi', desc: 'Zil simgesine ve Bildirimler sayfasına düşer, çevrimiçi olanlara anında gider.' },
  { key: 'banner', icon: PanelTop, label: 'Duyuru bandı', desc: 'Uygulamanın üstünde, öğrenci kapatana ya da süre bitene kadar görünür.' },
  { key: 'email', icon: Mail, label: 'E-posta', desc: 'Öğrencinin okul e-postasına gider. Ticari tanıtım için öğrenci onayı gerekir.' },
];

function describeAudience(a, uniName) {
  const parts = [];
  if (a.universityIds?.length) parts.push(a.universityIds.map(uniName).join(', '));
  if (a.classYears?.length) parts.push(a.classYears.map((c) => CLASS_LABELS[c]).join(', '));
  if (a.intents?.length) parts.push(a.intents.map((i) => INTENT_LABELS[i] || i).join(', '));
  if (a.premium === 'yes') parts.push('Premium');
  if (a.premium === 'no') parts.push('Premium değil');
  if (a.badge === 'yes') parts.push('Rozetli');
  if (a.badge === 'no') parts.push('Rozetsiz');
  if (a.joinedWithinDays) parts.push(`Son ${a.joinedWithinDays} günde katılan`);
  if (a.inactiveDays) parts.push(`${a.inactiveDays}+ gündür girmeyen`);
  if (a.incompleteProfile) parts.push('Profili eksik');
  return parts.length ? parts.join(' · ') : 'Tüm öğrenciler';
}

function toggleIn(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function AdminCampaigns() {
  const toast = useToast();
  const confirm = useConfirm();
  const formRef = useRef(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [channels, setChannels] = useState(['notification']);
  const [bannerDays, setBannerDays] = useState(7);
  const [audience, setAudience] = useState(EMPTY_AUDIENCE);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [campuses, setCampuses] = useState([]);
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState('');

  const loadCampaigns = useCallback(() => {
    adminApi
      .getCampaigns()
      .then((res) => setCampaigns(res.data))
      .catch((err) => setError(errorText(err, 'Kampanyalar yüklenemedi.')));
  }, []);

  useEffect(() => {
    loadCampaigns();
    adminApi
      .getCampusInsights(30)
      .then((res) => setCampuses(res.data.campuses))
      .catch(() => {});
  }, [loadCampaigns]);

  // Kitle değişince eşleşen öğrenci sayısını (kısa bir gecikmeyle) yeniden hesapla
  useEffect(() => {
    setPreviewLoading(true);
    const t = setTimeout(() => {
      adminApi
        .previewAudience(audience)
        .then((res) => setPreview(res.data))
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [audience]);

  const uniName = useCallback((id) => campuses.find((c) => c.id === id)?.name || `#${id}`, [campuses]);
  const activePreset = useMemo(
    () => PRESETS.find((p) => JSON.stringify({ ...EMPTY_AUDIENCE, ...p.audience }) === JSON.stringify(audience))?.key,
    [audience]
  );
  const set = (patch) => setAudience((a) => ({ ...a, ...patch }));

  function applyTemplate(tpl) {
    setTitle(tpl.title);
    setBody(tpl.body);
    setLink(tpl.link);
    const preset = PRESETS.find((p) => p.key === tpl.preset);
    if (preset) setAudience({ ...EMPTY_AUDIENCE, ...preset.audience });
  }

  function reuse(c) {
    setTitle(c.title);
    setBody(c.body);
    setLink(c.link || '');
    setChannels(c.channels.filter((ch) => ch !== 'email'));
    setAudience({ ...EMPTY_AUDIENCE, ...c.audience });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const valid = title.trim() && body.trim() && channels.length > 0;
  const payload = () => ({ title, body, link, channels, bannerDays, audience });

  async function sendTest() {
    if (!valid) return toast.error('Başlık, mesaj ve en az bir kanal gerekli.');
    try {
      const res = await adminApi.sendCampaign({ ...payload(), test: true });
      toast.success(res.data.message);
    } catch (err) {
      toast.error(errorText(err, 'Test gönderilemedi.'));
    }
  }

  async function send() {
    if (!valid) return toast.error('Başlık, mesaj ve en az bir kanal gerekli.');
    const count = preview?.count ?? 0;
    if (!count) return toast.error('Bu filtrelerle eşleşen öğrenci yok.');
    const ok = await confirm({
      title: `${fmt(count)} öğrenciye gönderilsin mi?`,
      message: `${channels.map((c) => CHANNELS.find((x) => x.key === c).label).join(', ')} · ${describeAudience(audience, uniName)}${
        channels.includes('email') ? '\n\nGönderilen e-postalar geri alınamaz.' : ''
      }`,
      confirmLabel: 'Gönder',
    });
    if (!ok) return;
    setSending(true);
    try {
      const res = await adminApi.sendCampaign(payload());
      toast.success(res.data.message);
      setTitle('');
      setBody('');
      setLink('');
      loadCampaigns();
    } catch (err) {
      toast.error(errorText(err, 'Kampanya gönderilemedi.'));
    } finally {
      setSending(false);
    }
  }

  async function stopBanner(c) {
    try {
      const res = await adminApi.stopBanner(c.id);
      toast.success(res.data.message);
      loadCampaigns();
    } catch (err) {
      toast.error(errorText(err, 'Bant kaldırılamadı.'));
    }
  }

  async function withdraw(c) {
    const ok = await confirm({
      title: 'Kampanya geri çekilsin mi?',
      message: 'Öğrencilerin bildirimlerinden ve duyuru bandından kaldırılır. Gönderilmiş e-postalar geri alınamaz.',
      confirmLabel: 'Geri çek',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await adminApi.deleteCampaign(c.id);
      toast.success(res.data.message);
      loadCampaigns();
    } catch (err) {
      toast.error(errorText(err, 'Kampanya geri çekilemedi.'));
    }
  }

  const now = new Date();
  return (
    <div>
      <PageHead title="Kampanyalar" sub="Doğru öğrenciye doğru mesajı gönder: kitleyi seç, mesajı yaz, kanalı belirle. Önce kendine test gönderebilirsin." />

      {error && <div className="adm-error">{error}</div>}

      <div className="adm-composer" ref={formRef}>
        <section className="adm-card">
          <div className="adm-step">
            <div className="adm-step-head"><span className="n">1</span> Kime?</div>
            <div className="adm-chips" aria-label="Hazır kitleler">
              {PRESETS.map((p) => (
                <button key={p.key} type="button" className={`adm-chip ${activePreset === p.key ? 'on' : ''}`} onClick={() => setAudience({ ...EMPTY_AUDIENCE, ...p.audience })}>
                  {activePreset === p.key && <Check />} {p.label}
                </button>
              ))}
            </div>

            <details>
              <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 650, color: 'var(--text-muted)', minHeight: 32, display: 'flex', alignItems: 'center' }}>
                Kitleyi daralt (kampüs, sınıf, ilgi…)
              </summary>
              <div className="adm-grid" style={{ gap: 14, marginTop: 10 }}>
                <div className="adm-field">
                  <span>Kampüs</span>
                  <div className="adm-chips">
                    {campuses.length === 0 && <small>Henüz öğrencisi olan kampüs yok.</small>}
                    {campuses.map((c) => (
                      <button key={c.id} type="button" className={`adm-chip ${audience.universityIds.includes(c.id) ? 'on' : ''}`} onClick={() => set({ universityIds: toggleIn(audience.universityIds, c.id) })}>
                        {c.name} <span className="adm-faint">{fmt(c.users)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="adm-field">
                  <span>Sınıf</span>
                  <div className="adm-chips">
                    {[1, 2, 3, 4, 5].map((y) => (
                      <button key={y} type="button" className={`adm-chip ${audience.classYears.includes(y) ? 'on' : ''}`} onClick={() => set({ classYears: toggleIn(audience.classYears, y) })}>
                        {CLASS_LABELS[y]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="adm-field">
                  <span>Ne arıyor?</span>
                  <div className="adm-chips">
                    {INTENT_OPTIONS.map((o) => (
                      <button key={o.value} type="button" className={`adm-chip ${audience.intents.includes(o.value) ? 'on' : ''}`} onClick={() => set({ intents: toggleIn(audience.intents, o.value) })}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="adm-grid adm-grid-2" style={{ gap: 10 }}>
                  <label className="adm-field">
                    <span>Premium</span>
                    <select className="adm-select" value={audience.premium} onChange={(e) => set({ premium: e.target.value })}>
                      <option value="any">Fark etmez</option>
                      <option value="yes">Yalnızca Premium</option>
                      <option value="no">Premium olmayanlar</option>
                    </select>
                  </label>
                  <label className="adm-field">
                    <span>Onaylı rozet</span>
                    <select className="adm-select" value={audience.badge} onChange={(e) => set({ badge: e.target.value })}>
                      <option value="any">Fark etmez</option>
                      <option value="yes">Rozeti olanlar</option>
                      <option value="no">Rozeti olmayanlar</option>
                    </select>
                  </label>
                  <label className="adm-field">
                    <span>Kayıt zamanı</span>
                    <select className="adm-select" value={audience.joinedWithinDays || ''} onChange={(e) => set({ joinedWithinDays: Number(e.target.value) || null })}>
                      <option value="">Fark etmez</option>
                      <option value="1">Son 24 saat</option>
                      <option value="7">Son 7 gün</option>
                      <option value="30">Son 30 gün</option>
                    </select>
                  </label>
                  <label className="adm-field">
                    <span>Son giriş</span>
                    <select className="adm-select" value={audience.inactiveDays || ''} onChange={(e) => set({ inactiveDays: Number(e.target.value) || null })}>
                      <option value="">Fark etmez</option>
                      <option value="3">3+ gündür girmeyen</option>
                      <option value="7">7+ gündür girmeyen</option>
                      <option value="14">14+ gündür girmeyen</option>
                      <option value="30">30+ gündür girmeyen</option>
                    </select>
                  </label>
                </div>
                <button type="button" className={`adm-chip ${audience.incompleteProfile ? 'on' : ''}`} style={{ alignSelf: 'flex-start' }} onClick={() => set({ incompleteProfile: !audience.incompleteProfile })}>
                  {audience.incompleteProfile && <Check />} Yalnızca profili eksik olanlar (fotoğraf ya da ilgi alanı yok)
                </button>
              </div>
            </details>

            <div className="adm-audience-count" aria-live="polite">
              <Users size={22} color="var(--amber-soft)" />
              <div>
                <strong>{previewLoading && !preview ? '…' : fmt(preview?.count ?? 0)}</strong> <span>öğrenci</span>
                <span style={{ display: 'block' }}>{describeAudience(audience, uniName)}</span>
              </div>
            </div>
          </div>

          <div className="adm-step">
            <div className="adm-step-head"><span className="n">2</span> Ne diyeceksin?</div>
            <div className="adm-chips" aria-label="Hazır şablonlar">
              {TEMPLATES.map((t) => (
                <button key={t.label} type="button" className="adm-chip" onClick={() => applyTemplate(t)}>
                  {t.label}
                </button>
              ))}
            </div>
            <label className="adm-field">
              <span>Başlık <span className="adm-count">{title.length}/80</span></span>
              <input className="adm-input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="ör. Bahar Şenliği bu cuma!" />
            </label>
            <label className="adm-field">
              <span>Mesaj <span className="adm-count">{body.length}/500</span></span>
              <textarea className="adm-textarea" value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} placeholder="Kısa, net ve öğrenciye fayda anlatan bir mesaj yaz." />
            </label>
            <label className="adm-field">
              <span>Dokununca açılacak sayfa</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select className="adm-select" value={LINKS.some((l) => l.value === link) ? link : 'custom'} onChange={(e) => setLink(e.target.value === 'custom' ? 'https://' : e.target.value)}>
                  {LINKS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                  <option value="custom">Dış bağlantı (https://…)</option>
                </select>
                {!LINKS.some((l) => l.value === link) && (
                  <input className="adm-input" style={{ flex: 1, minWidth: 200 }} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://instagram.com/…" />
                )}
              </div>
            </label>
          </div>

          <div className="adm-step">
            <div className="adm-step-head"><span className="n">3</span> Hangi kanaldan?</div>
            <div className="adm-grid" style={{ gap: 8 }}>
              {CHANNELS.map((c) => {
                const on = channels.includes(c.key);
                return (
                  <button key={c.key} type="button" className={`adm-channel ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setChannels((prev) => toggleIn(prev, c.key))}>
                    <span className="box">{on && <Check />}</span>
                    <span>
                      <b><c.icon size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{c.label}</b>
                      <small>{c.desc}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            {channels.includes('banner') && (
              <label className="adm-field" style={{ maxWidth: 260 }}>
                <span>Bant ne kadar görünsün?</span>
                <select className="adm-select" value={bannerDays} onChange={(e) => setBannerDays(Number(e.target.value))}>
                  {[1, 3, 7, 14, 30].map((d) => (
                    <option key={d} value={d}>{d} gün</option>
                  ))}
                </select>
              </label>
            )}
            {channels.includes('email') && (
              <div className="adm-note">
                <Info />
                <span>
                  Ticari tanıtım içeren e-postalar için öğrencinin önceden onay vermiş olması gerekir (6563 sayılı Kanun / İYS). Hesap güvenliği ve hizmet bilgilendirmeleri bu kapsamda değildir.
                  E-posta sunucusu ayarlı değilse e-postalar yalnızca sunucu konsoluna yazılır.
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="adm-btn" disabled={!valid || sending || !preview?.count} onClick={send}>
                <Send /> {sending ? 'Gönderiliyor…' : `${fmt(preview?.count ?? 0)} öğrenciye gönder`}
              </button>
              <button type="button" className="adm-btn ghost" disabled={!valid} onClick={sendTest}>
                <FlaskConical /> Kendime test gönder
              </button>
            </div>
          </div>
        </section>

        <aside className="adm-preview" aria-label="Önizleme">
          <div className="adm-card">
            <h3 className="adm-card-title">Önizleme</h3>
            <p className="adm-card-sub">Öğrencinin göreceği hâli.</p>
            <div className="adm-phone">
              <div className="adm-phone-time">{now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="adm-push">
                <span className="app">k</span>
                <div style={{ minWidth: 0 }}>
                  <div className="top"><span>kampüs·</span><span>şimdi</span></div>
                  <b>{title || 'Kampanya başlığı'}</b>
                  <p>{body || 'Mesajın burada görünecek.'}</p>
                </div>
              </div>
            </div>
            {channels.includes('banner') && (
              <>
                <p className="adm-card-sub" style={{ margin: '14px 0 8px' }}>Uygulamanın üstündeki bant:</p>
                <div className="adm-banner-preview">
                  <Megaphone />
                  <div style={{ minWidth: 0 }}>
                    <b>{title || 'Kampanya başlığı'}</b>
                    <span>{body || 'Mesajın burada görünecek.'}</span>
                  </div>
                </div>
              </>
            )}
            {preview?.sample?.length > 0 && (
              <p className="adm-faint" style={{ marginTop: 14 }}>
                Örnek alıcılar: {preview.sample.map((s) => s.fullName).join(', ')}
                {preview.count > preview.sample.length ? ` ve ${fmt(preview.count - preview.sample.length)} kişi daha` : ''}
              </p>
            )}
          </div>
        </aside>
      </div>

      <h2 className="adm-section-title">Gönderilenler</h2>
      <section className="adm-card">
        {campaigns === null ? (
          <Skeleton h={160} />
        ) : campaigns.length === 0 ? (
          <div className="adm-empty">
            <Megaphone />
            <div>Henüz kampanya gönderilmedi. İlk kampanyanı yukarıdan oluştur.</div>
          </div>
        ) : (
          campaigns.map((c) => (
            <article className="adm-campaign" key={c.id}>
              <div style={{ minWidth: 0 }}>
                <h4>{c.title}</h4>
                <p>{c.body}</p>
                <div className="adm-campaign-meta">
                  {c.channels.map((ch) => (
                    <span key={ch} className="adm-badge">{CHANNELS.find((x) => x.key === ch)?.label || ch}</span>
                  ))}
                  {c.bannerActive && <span className="adm-badge green">Bant yayında · {fmtDateTime(c.bannerUntil)} bitiyor</span>}
                  <span className="adm-faint">{describeAudience(c.audience, uniName)} · {fmtDateTime(c.createdAt)}{c.createdBy ? ` · ${c.createdBy.fullName}` : ''}</span>
                </div>
              </div>
              <div className="adm-campaign-stats">
                <div><b>{fmt(c.recipientCount)}</b><span>alıcı</span></div>
                {c.channels.includes('notification') && <div><b>%{c.readRate.toLocaleString('tr-TR')}</b><span>okundu ({fmt(c.readCount)})</span></div>}
                {c.channels.includes('email') && <div><b>{fmt(c.emailCount)}</b><span>e-posta</span></div>}
              </div>
              <div className="adm-campaign-actions">
                <button type="button" className="adm-btn ghost small" onClick={() => reuse(c)}>
                  <Copy /> Yeniden kullan
                </button>
                {c.bannerActive && (
                  <button type="button" className="adm-btn ghost small" onClick={() => stopBanner(c)}>
                    <XCircle /> Bandı kaldır
                  </button>
                )}
                <button type="button" className="adm-btn danger-ghost small" onClick={() => withdraw(c)}>
                  <Trash2 /> Geri çek
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
