'use client';

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    icon?: string;
  };
  icon?: ReactNode;
  variant?: 'default' | 'aqua' | 'coral' | 'gold' | 'success';
  size?: 'sm' | 'md' | 'lg';
  hint?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  icon,
  variant = 'default',
  size = 'md',
  hint,
}: MetricCardProps) {
  const variantStyles = {
    default: 'from-slate-50 dark:from-slate-900 to-slate-100 dark:to-slate-800 border-slate-200 dark:border-slate-700',
    aqua: 'from-aqua-50 dark:from-aqua-950 to-aqua-100 dark:to-aqua-900 border-aqua-200 dark:border-aqua-800',
    coral: 'from-coral-50 dark:from-coral-950 to-coral-100 dark:to-coral-900 border-coral-200 dark:border-coral-800',
    gold: 'from-gold-50 dark:from-gold-950 to-gold-100 dark:to-gold-900 border-gold-200 dark:border-gold-800',
    success: 'from-success-50 dark:from-success-950 to-success-100 dark:to-success-900 border-success-200 dark:border-success-800',
  };

  const sizeStyles = {
    sm: 'p-3',
    md: 'p-4 lg:p-6',
    lg: 'p-6 lg:p-8',
  };

  const valueSize = {
    sm: 'text-lg lg:text-xl',
    md: 'text-2xl lg:text-3xl',
    lg: 'text-4xl lg:text-5xl',
  };

  return (
    <Card
      className={cn(
        `bg-gradient-to-br ${variantStyles[variant]}`,
        sizeStyles[size]
      )}
    >
      <CardContent className="space-y-2 lg:space-y-3">
        {/* Header com label e icon */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-400">
            {label}
          </p>
          {icon && <div className="text-xl opacity-60">{icon}</div>}
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-1.5">
          <span className={cn('font-bold tracking-tight text-slate-900 dark:text-slate-50', valueSize[size])}>
            {value}
          </span>
          {unit && <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{unit}</span>}
        </div>

        {/* Trend */}
        {trend && (
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs font-semibold', trend.isPositive ? 'text-success-600' : 'text-danger-600')}>
              {trend.icon || (trend.isPositive ? '↓' : '↑')}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
            {hint && <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
