import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Reveal from './Reveal';
import { useI18n } from '../../i18n';

const FAQS = [
  {
    q: 'Kimler kampüs·\'e katılabilir?',
    a: 'Yalnızca aktif üniversite öğrencileri. Kayıt olurken okul e-postana gelen 6 haneli kodla hesabını doğrularsın.',
  },
  {
    q: 'Okul e-postam olmadan kayıt olabilir miyim?',
    a: "Hayır. Doğrulama kodu yalnızca seçtiğin üniversitenin okul e-postasına gönderilir; böylece herkesin gerçekten o okulda olduğundan emin oluruz. Okul e-postanı öğrenci işleri ya da bilgi işlem biriminden alabilirsin.",
  },
  {
    q: 'Verilerim ve fotoğraflarım güvende mi?',
    a: 'Keşfet ve Kart Modu yalnızca doğrulanmış öğrencileri gösterir. İstediğin kişiyi engelleyebilir, şikayet edebilir ya da hesabını dondurabilirsin. Bilgilerini üçüncü taraflara satmayız.',
  },
  {
    q: 'Sadece romantik eşleşmeler için mi?',
    a: 'Hayır. Profilinde ne aradığını seçersin: arkadaşlık, çalışma arkadaşı, etkinlik, kulüp ya da flört. Kart Modu önce aynı şeyi arayan öğrencileri gösterir.',
  },
  {
    q: 'Kullanması ücretli mi?',
    a: 'Doğrulama, keşfet, eşleşme, sohbet ve kulüpler ücretsiz. İsteğe bağlı Premium ile seni beğenenleri görebilir ve aramada diğer üniversitelerdeki öğrencilere de ulaşabilirsin.',
  },
];

export default function FAQSection() {
  const { t } = useI18n();
  const [open, setOpen] = useState(0);

  // Google zengin sonuç: SSS yapılandırılmış verisi (yalnızca bu sayfada)
  useEffect(() => {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'faq-jsonld';
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <section id="sss" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-2xl px-4">
        <Reveal className="text-center">
          <p className="landing-eyebrow">{t("SSS")}</p>
          <h2 className="landing-h2 mt-3">{t("Merak edilenler")}</h2>
        </Reveal>

        <div className="mt-12 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 0.05}>
                <div className="landing-card overflow-hidden transition-shadow">
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-[0.9063rem] font-semibold text-paper">{t(f.q)}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-paper-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <p className="px-5 pb-4 text-[0.8438rem] leading-relaxed text-paper-muted">{t(f.a)}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
