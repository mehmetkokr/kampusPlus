import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Reveal from './Reveal';

const FAQS = [
  {
    q: 'Kimler kampüs·\'e katılabilir?',
    a: 'Yalnızca aktif üniversite öğrencileri. Kayıt sırasında üniversite e-postan veya öğrenci belgenle doğrulama yapman gerekir.',
  },
  {
    q: 'Üniversitem .edu.tr e-postası vermiyorsa ne olur?',
    a: 'Sorun değil — kayıt formunda öğrenci belgeni (kimlik kartı, kayıt belgesi vb.) yükleyebilirsin. Ekibimiz 24-48 saat içinde inceleyip onaylar.',
  },
  {
    q: 'Verilerim ve fotoğraflarım güvende mi?',
    a: 'Profilini yalnızca kendi üniversitenden doğrulanmış öğrenciler görebilir. Bilgilerini hiçbir zaman üçüncü taraflarla paylaşmaz, reklamcılara satmayız.',
  },
  {
    q: 'Sadece romantik eşleşmeler için mi?',
    a: 'Hayır. Arkadaşlık, ders ortağı bulma, kulüp ve etkinlik keşfi de platformun temel parçası. Romantik bağlantı kurmak tamamen opsiyonel.',
  },
  {
    q: 'Kullanması ücretli mi?',
    a: 'Temel özelliklerin tamamı ücretsiz: doğrulama, keşfet, eşleşme ve sohbet. İleride isteğe bağlı premium özellikler ekleyebiliriz.',
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState(0);

  return (
    <section id="sss" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-2xl px-4">
        <Reveal className="text-center">
          <span className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-amber-soft">SSS</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-paper sm:text-4xl">
            Merak edilenler
          </h2>
        </Reveal>

        <div className="mt-12 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 0.05}>
                <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface/40">
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-[14.5px] font-semibold text-paper">{f.q}</span>
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
                        <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-paper-muted">{f.a}</p>
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
