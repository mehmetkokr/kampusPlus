import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// shadcn/ui Badge (JavaScript). Renkler index.css @theme içindeki
// primary / secondary / destructive / foreground / border belirteçlerinden
// gelir; bunlar uygulamanın açık-koyu mod paletine bağlıdır.
const badgeVariants = cva(
  // [&>svg]: simgeli rozetlerde (badge-12) simge rozetin içine sığsın
  'inline-flex shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
