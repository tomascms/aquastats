import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx
 * Resolves conflicting Tailwind classes properly
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format time in seconds to MM'SS"CC format
 */
export function formatSwimTime(seconds: number): string {
  if (seconds <= 0 || !Number.isFinite(seconds)) return '—';

  const totalCs = Math.round(seconds * 100);
  const mm = Math.floor(totalCs / 6000);
  const rest = totalCs % 6000;
  const ss = Math.floor(rest / 100);
  const cc = rest % 100;

  return `${String(mm).padStart(2, '0')}'${String(ss).padStart(2, '0')}"${String(cc).padStart(2, '0')}`;
}

/**
 * Parse MM'SS"CC to seconds
 */
export function parseSwimTime(timeStr: string): number {
  const match = timeStr.match(/(\d+)?'?(\d+)?"?(\d+)?/);
  if (!match) return 0;

  const mm = parseInt(match[1] || '0', 10);
  const ss = parseInt(match[2] || '0', 10);
  const cc = parseInt(match[3] || '0', 10);

  return mm * 60 + ss + cc / 100;
}

/**
 * Format as percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format as pace (MM'SS per 100m)
 */
export function formatPace(seconds: number, distance: number = 100): string {
  if (!seconds || !distance) return '—';
  const pace = (seconds / distance) * 100;
  return formatSwimTime(pace);
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dob: Date | string): number {
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * Format date to PT locale
 */
export function formatDate(date: Date | string, style: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: style === 'short' ? '2-digit' : 'numeric',
  });
}

/**
 * Calculate improvement percentage
 */
export function calculateImprovement(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((oldValue - newValue) / oldValue) * 100;
}

/**
 * Format improvement value with trend indicator
 */
export function formatImprovement(value: number): {
  text: string;
  isPositive: boolean;
  icon: string;
} {
  const isPositive = value < 0; // For time, negative is good
  const icon = isPositive ? '↓' : '↑';

  return {
    text: `${Math.abs(value).toFixed(2)}%`,
    isPositive,
    icon,
  };
}

/**
 * Debounce function for input handlers
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return function debounced(...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function for scroll/resize handlers
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Deep clone object (safe for JSON-serializable objects)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, etc)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}
