'use client';

import { useEffect, ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: 'light' | 'dark' | 'system';
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
}: ThemeProviderProps) {
  useEffect(() => {
    // Detectar preferência do sistema
    const getSystemTheme = () => {
      if (typeof window === 'undefined') return 'light';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    // Obter tema salvo ou usar default
    const savedTheme =
      typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;

    let theme = savedTheme || defaultTheme;

    if (theme === 'system') {
      theme = getSystemTheme();
    }

    // Aplicar tema
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
      html.setAttribute('data-theme', 'dark');
    } else {
      html.classList.remove('dark');
      html.removeAttribute('data-theme');
    }

    // Listener para mudanças do sistema
    if (defaultTheme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? 'dark' : 'light';
        const html = document.documentElement;

        if (newTheme === 'dark') {
          html.classList.add('dark');
          html.setAttribute('data-theme', 'dark');
        } else {
          html.classList.remove('dark');
          html.removeAttribute('data-theme');
        }
      };

      // Support older browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
    }
  }, [defaultTheme, storageKey]);

  return <>{children}</>;
}

/**
 * Hook para toggle de tema
 */
export function useTheme(storageKey = 'theme') {
  const toggleTheme = () => {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');

    if (isDark) {
      html.classList.remove('dark');
      html.removeAttribute('data-theme');
      localStorage.setItem(storageKey, 'light');
    } else {
      html.classList.add('dark');
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem(storageKey, 'dark');
    }
  };

  const getCurrentTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  };

  return {
    theme: getCurrentTheme(),
    toggleTheme,
  };
}
