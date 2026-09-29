import { motion, useReducedMotion } from 'framer-motion';

// Tüm landing sayfası boyunca tutarlı scroll-reveal animasyonu.
// prefers-reduced-motion saygı görür (transform yerine sadece opacity).
export default function Reveal({
  children,
  delay = 0,
  y = 18,
  className = '',
  as = 'div',
  once = true,
}) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as] || motion.div;

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: reduceMotion ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}
