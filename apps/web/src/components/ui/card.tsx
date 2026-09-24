'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'glass' | 'elevated';
  hover?: boolean;
}

export function Card({
  children,
  className,
  variant = 'default',
  hover = true,
}: CardProps) {
  const variantStyles = {
    default: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700',
    gradient: 'bg-gradient-to-br from-aqua-50 dark:from-aqua-950 to-slate-50 dark:to-slate-900 border border-aqua-200 dark:border-aqua-800',
    glass: 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50',
    elevated: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg',
  };

  return (
    <div
      className={cn(
        'rounded-xl p-4 lg:p-6 transition-shadow',
        hover && 'hover:shadow-md dark:hover:shadow-xl',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 pb-4 border-b border-slate-200 dark:border-slate-700', className)}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  level?: 'h1' | 'h2' | 'h3' | 'h4';
}

export function CardTitle({ children, className, level = 'h2' }: CardTitleProps) {
  const Heading = level;

  return (
    <Heading className={cn('text-lg lg:text-xl font-semibold text-slate-900 dark:text-slate-50', className)}>
      {children}
    </Heading>
  );
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-slate-600 dark:text-slate-400', className)}>
      {children}
    </p>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn('mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-2', className)}>
      {children}
    </div>
  );
}
