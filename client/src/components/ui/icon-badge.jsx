import { CheckIcon, StarIcon, ZapIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// badge-12 biçiminde tek rozetler. Ekran okuyucu için anlamlı bir ad taşır.
//   <VerifiedBadge />            onaylı öğrenci (dolu, mavi, check)
//   <PremiumBadge />             Premium (ikincil, star)
//   <FeaturedBadge />            öne çıkan (çerçeveli, zap)
// size: "sm" (16px) | "md" (20px, varsayılan) | "lg" (24px)
const SIZES = {
  sm: 'size-4 [&>svg]:size-2.5',
  md: 'size-5 [&>svg]:size-3',
  lg: 'size-6 [&>svg]:size-3.5',
};

function IconBadge({ icon: Icon, variant, label, size = 'md', className }) {
  return (
    <Badge variant={variant} role="img" aria-label={label} title={label} className={cn('rounded-full p-0 align-middle', SIZES[size], className)}>
      <Icon strokeWidth={3} aria-hidden="true" />
    </Badge>
  );
}

export function VerifiedBadge({ label = 'Onaylı öğrenci', ...props }) {
  return <IconBadge icon={CheckIcon} label={label} {...props} />;
}

export function PremiumBadge({ label = 'Premium', ...props }) {
  return <IconBadge icon={StarIcon} variant="secondary" label={label} {...props} />;
}

export function FeaturedBadge({ label = 'Öne çıkan', ...props }) {
  return <IconBadge icon={ZapIcon} variant="outline" label={label} {...props} />;
}
