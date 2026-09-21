import type { ReactNode } from 'react';

/**
 * Pass-through root layout. The real document shell (<html lang>, fonts,
 * analytics, providers) is app/[locale]/layout.tsx, because <html lang> needs
 * the locale and only that segment knows it. This file exists so that
 * app/not-found.tsx has a layout to sit in; that page renders its own
 * <html> and <body>.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
