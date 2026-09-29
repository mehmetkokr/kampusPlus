import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function ScrollDownIndicator({ target = '#istatistikler', className = '' }) {
  const handleClick = (e) => {
    e.preventDefault();
    document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <motion.a
      href={target}
      onClick={handleClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7, delay: 1.1 }}
      className={`absolute bottom-2 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-1.5 text-paper-faint transition-colors hover:text-paper-muted sm:flex ${className}`}
      aria-label="Aşağı kaydır"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider">Kaydır</span>
      <motion.span
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-line-soft bg-surface/50 backdrop-blur"
      >
        <ChevronDown size={15} />
      </motion.span>
    </motion.a>
  );
}
