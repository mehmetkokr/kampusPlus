import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from './Reveal';

export default function CTASection() {
  return (
    <section className="relative px-4 py-20">
      <Reveal className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-line-soft bg-gradient-to-br from-surface-2 via-surface to-surface-2 px-8 py-16 text-center shadow-2xl">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-amber/20 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-teal/20 blur-[100px]" />

        <h2 className="relative font-display text-3xl font-bold text-paper sm:text-4xl">
          Kampüsünde seni bekleyenler var.
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-[14.5px] text-paper-muted">
          Üniversite e-postanla bir dakikadan kısa sürede katıl, doğrulamanı tamamla ve keşfetmeye
          başla.
        </p>
        <Link
          to="/register"
          className="group relative mt-8 inline-flex items-center gap-2 rounded-full bg-amber px-7 py-3.5 text-[14.5px] font-bold text-ink transition-transform hover:scale-[1.03] hover:bg-amber-soft active:scale-[0.98]"
        >
          Hemen Katıl
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Reveal>
    </section>
  );
}
