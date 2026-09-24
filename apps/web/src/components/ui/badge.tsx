'use client';

import { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50',
        aqua: 'bg-aqua-100 dark:bg-aqua-900/30 text-aqua-700 dark:text-aqua-300',
        coral: 'bg-coral-100 dark:bg-coral-900/30 text-coral-700 dark:text-coral-300',
        gold: 'bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-300',
        success: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300',
        warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300',
        danger: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300',
        info: 'bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300',

        // Zone badges
        'zone-z1': 'bg-zone-z1/10 text-zone-z1 dark:text-zone-z1 font-bold',
        'zone-z2': 'bg-zone-z2/10 text-zone-z2 dark:text-zone-z2 font-bold',
        'zone-z3': 'bg-zone-z3/10 text-zone-z3 dark:text-zone-z3 font-bold',
        'zone-z4': 'bg-zone-z4/10 text-zone-z4 dark:text-zone-z4 font-bold',
        'zone-z5': 'bg-zone-z5/10 text-zone-z5 dark:text-zone-z5 font-bold',
        'zone-z6': 'bg-zone-z6/10 text-zone-z6 dark:text-zone-z6 font-bold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({
  variant,
  children,
  icon,
  className,
  dot,
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  );
}

export { badgeVariants };
