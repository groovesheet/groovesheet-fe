/**
 * Utility functions for the application
 */

/** Combines class names conditionally. */
export function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ');
}

/** Formats a price to currency format. */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/** Formats a date to a readable string. */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

/** Debounces a function call. */
export function debounce<Args extends unknown[]>(func: (...args: Args) => void, wait: number): (...args: Args) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return function executedFunction(...args: Args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/** Validates an email address. */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/** Truncates text to a specified length. */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}
