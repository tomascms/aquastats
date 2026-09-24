import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Brand - Aqua
        aqua: {
          50: '#f0fafb',
          100: '#d4f1f5',
          200: '#a8e3eb',
          300: '#7dd5e1',
          400: '#51c7d7',
          500: '#0ea5e9', // Brand primary
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c3d66',
        },

        // Accent - Coral (for PRs/records)
        coral: {
          50: '#fff5f5',
          100: '#ffebeb',
          200: '#ffd6d6',
          300: '#ffc2c2',
          400: '#ff8d8d',
          500: '#ff6b6b', // Accent primary
          600: '#ff5252',
          700: '#ff3838',
          800: '#ff1f1f',
          900: '#dd0d0d',
        },

        // Accent - Gold (for achievements)
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24', // Accent secondary
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },

        // Neutral - Slate
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },

        // Semantic Colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#10b981', // Primary success
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },

        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // Primary warning
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },

        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444', // Primary danger
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },

        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#3b82f6', // Primary info
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },

        // Training Zones
        zone: {
          z1: '#10b981', // Green - EN1 (Aerobic Low)
          z2: '#84cc16', // Lime - EN2 (Aerobic Medium)
          z3: '#eab308', // Yellow - EN3 (Threshold)
          z4: '#f97316', // Orange - SP1 (Tolerance)
          z5: '#ef4444', // Red - SP2 (VO2 Max)
          z6: '#991b1b', // Dark Red - SP3 (Velocity)
        },

        // UI Semantic
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          muted: 'var(--bg-muted)',
        },

        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-muted)',
          mist: 'var(--mist)',
          sand: 'var(--sand)',
        },

        border: {
          DEFAULT: 'var(--border-color)',
          light: 'var(--border-light)',
        },
      },

      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },

      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem', fontWeight: '400' }],
        sm: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        base: ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        lg: ['1.125rem', { lineHeight: '1.75rem', fontWeight: '500' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700' }],
      },

      borderRadius: {
        xs: '0.25rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },

      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },

      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },

      animation: {
        'fade-in': 'fadeIn 200ms ease-in-out',
        'slide-in-up': 'slideInUp 300ms ease-out',
        'slide-in-down': 'slideInDown 300ms ease-out',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },

      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
        slower: '500ms',
      },
    },
  },
  plugins: [
    require('tailwindcss/plugin')(function ({ addBase, addComponents, theme }: any) {
      addBase({
        html: {
          '@apply scroll-smooth': {},
        },
        body: {
          '@apply bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50': {},
          transition: 'background-color 200ms ease-in-out',
        },
      });

      addComponents({
        '.btn': {
          '@apply inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },

        '.btn-primary': {
          '@apply btn bg-gradient-to-br from-aqua-500 to-aqua-600 text-white hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-aqua-500': {},
        },

        '.btn-secondary': {
          '@apply btn border-2 border-aqua-500 text-aqua-700 dark:text-aqua-400 hover:bg-aqua-50 dark:hover:bg-aqua-950 active:bg-aqua-100 dark:active:bg-aqua-900 focus-visible:ring-aqua-500': {},
        },

        '.btn-ghost': {
          '@apply btn text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 focus-visible:ring-slate-500': {},
        },

        '.btn-danger': {
          '@apply btn bg-danger-500 text-white hover:bg-danger-600 active:shadow-inner focus-visible:ring-danger-500': {},
        },

        '.btn-sm': {
          '@apply h-8 px-3 text-xs': {},
        },

        '.btn-md': {
          '@apply h-10 px-4 text-sm': {},
        },

        '.btn-lg': {
          '@apply h-12 px-6 text-base': {},
        },

        '.card': {
          '@apply rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow p-4 lg:p-6': {},
        },

        '.card-gradient': {
          '@apply card bg-gradient-to-br from-aqua-50 dark:from-aqua-950 to-slate-50 dark:to-slate-900 border-aqua-200 dark:border-aqua-800': {},
        },

        '.input': {
          '@apply w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 placeholder-slate-500 dark:placeholder-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua-500 focus-visible:border-transparent disabled:opacity-50 disabled:cursor-not-allowed': {},
        },

        '.label': {
          '@apply block text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2': {},
        },

        '.badge': {
          '@apply inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50': {},
        },

        '.badge-aqua': {
          '@apply bg-aqua-100 dark:bg-aqua-900/30 text-aqua-700 dark:text-aqua-300': {},
        },

        '.badge-coral': {
          '@apply bg-coral-100 dark:bg-coral-900/30 text-coral-700 dark:text-coral-300': {},
        },

        '.badge-gold': {
          '@apply bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-300': {},
        },
      });
    }),
  ],
};

export default config;
