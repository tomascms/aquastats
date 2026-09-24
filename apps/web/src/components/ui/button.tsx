'use client';

import { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-br from-aqua-500 to-aqua-600 text-white hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-aqua-500 dark:from-aqua-600 dark:to-aqua-700',
        secondary: 'border-2 border-aqua-500 text-aqua-700 dark:text-aqua-400 hover:bg-aqua-50 dark:hover:bg-aqua-950 active:bg-aqua-100 dark:active:bg-aqua-900 focus-visible:ring-aqua-500',
        ghost: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 focus-visible:ring-slate-500',
        danger: 'bg-danger-500 text-white hover:bg-danger-600 active:shadow-inner focus-visible:ring-danger-500',
        success: 'bg-success-500 text-white hover:bg-success-600 active:shadow-inner focus-visible:ring-success-500',
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 rounded-lg',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function Button({
  variant,
  size,
  fullWidth,
  children,
  disabled,
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {children}
    </button>
  );
}

export { buttonVariants };
