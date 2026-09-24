'use client';

import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      icon,
      iconPosition = 'left',
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full space-y-1">
        {label && (
          <label className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
            {label}
            {props.required && <span className="text-danger-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 placeholder-slate-500 dark:placeholder-slate-400 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua-500 focus-visible:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              icon && iconPosition === 'left' && 'pl-10',
              icon && iconPosition === 'right' && 'pr-10',
              error && 'border-danger-500 focus-visible:ring-danger-500',
              className
            )}
            {...props}
          />

          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none">
              {icon}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-danger-500 font-medium">{error}</p>
        )}

        {hint && !error && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
