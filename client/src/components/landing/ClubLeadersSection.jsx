import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, Crown, Shield, Users } from 'lucide-react';
import Reveal from './Reveal';
import { useI18n } from '../../i18n';

// Kulüp başkanlarına yönelik bölüm: kampüs uygulamaları kulüplerle büyür.
// Solda neler yapılabildiği, sağda örnek bir kulüp/etkinlik kartı.
const FEATURES = [
  { icon: Crown, title: 'Başkan ve yöneticiler', desc: 'Kulübü sen kurarsın; istediğin üyeyi yönetici yapıp etkinlik açma yetkisi verirsin.' },
  { icon: BellRing, title: 'Etkinlik bildirimi', desc: 'Yeni etkinlik açtığında tüm üyelere anında bildirim gider. WhatsApp grubunda kaybolmaz.' },
  { icon: Users, title: 'Kim geliyor, gör', desc: 'Katılım listesini tek dokunuşla gör; kaç kişi geleceğini önceden bil.' },
  { icon: Shield, title: 'Kulüp içi düzen', desc: 'Kulüp sohbeti yalnızca üyelere açık. Kuralları bozanı kulüpten çıkarabilir ya da engelleyebilirsin.' },
];

export default function ClubLeadersSection() {
  const { t } = useI18n();
  return (
    <section id="kulupler" className="relative py-24 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <p className="landing-eyebrow">{t('Kulüp başkanları için')}</p>
          <h2 className="landing-h2 mt-3">{t('Kulübünü tek yerden yönet.')}</h2>
          <p className="mt-4 max-w-md text-[1.0625rem] leading-relaxed text-paper-muted">
            {t('Duyurular, etkinlikler ve üye listesi farklı gruplara dağılmasın. Kulübünü ücretsiz kur, üyelerini davet et.')}
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-dim text-amber">
                  <f.icon size={17} strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[0.9375rem] font-bold text-paper">{t(f.title)}</p>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-paper-muted">{t(f.desc)}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/register" className="landing-btn-primary group mt-9 w-full sm:w-auto">
            {t('Kulübünü ücretsiz kur')}
            <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>

        {/* Örnek kulüp etkinliği kartı (uygulamadaki görünüm) */}
        <Reveal delay={0.15} className="relative mx-auto w-full max-w-md">
          <div className="landing-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8e8e93]/15 text-[#7d7390]">
                <Crown size={22} />
              </span>
              <div>
                <p className="font-bold text-paper">{t('Satranç Kulübü')}</p>
                <p className="text-[0.8125rem] text-paper-muted">{t('Akademik')} · 42 {t('üye')}</p>
              </div>
              <span className="ml-auto rounded-full bg-[#ff9500]/15 px-2.5 py-1 text-[0.6875rem] font-bold text-[#9a7a2c]">
                {t('Başkan')}
              </span>
            </div>
            <div className="mt-5 rounded-2xl border border-line-soft bg-surface-2 p-4">
              <div className="flex gap-3">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface text-center shadow-sm">
                  <span className="text-[1.25rem] font-bold leading-none text-amber">09</span>
                  <span className="text-[0.625rem] font-bold uppercase text-paper-muted">{t('Eki')}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-paper">{t('Bahar turnuvası')}</p>
                  <p className="text-[0.8125rem] text-paper-muted">{t('Kütüphane, 2. kat · 18:00')}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <span className="flex h-9 items-center justify-center gap-1.5 rounded-full border border-line bg-surface text-[0.8125rem] font-bold text-paper">
                  <span className="flex -space-x-1.5">
                    {['#007aff', '#34c759', '#5856d6'].map((c) => (
                      <span key={c} className="h-5 w-5 rounded-full border-2 border-surface" style={{ background: c }} />
                    ))}
                  </span>
                  18 {t('katılımcı')}
                </span>
                <span className="flex h-9 items-center justify-center rounded-full bg-paper text-[0.8125rem] font-bold text-ink">
                  {t('Katıl')}
                </span>
              </div>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[0.8125rem] text-paper-muted">
              <BellRing size={14} className="text-amber" /> {t('42 üyeye bildirim gönderildi')}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
