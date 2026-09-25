import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { THEME_BOOT_SCRIPT } from '@/lib/theme-boot';
import { LOCALE_HTML_LANG, SUPPORTED_LOCALES, isLocale } from '@/lib/locales';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, DEFAULT_TITLE, SITE_NAME, SITE_URL } from '@/lib/seo/metadata';
import { LoginModalProvider } from '@/components/chrome/LoginModalProvider';
import AppBoot from '@/components/chrome/AppBoot';
import { BodyNoScript, HeadScripts } from '@/components/chrome/SiteScripts';
import '../globals.css';

/**
 * The document shell for every page: <html lang>, Hubot Sans, the analytics
 * tags from public/index.html, and the client providers (next-intl messages,
 * theme, auth, the shared login modal).
 *
 * Nothing here reads cookies or headers. That is what keeps every page below
 * it eligible for static rendering and ISR; per-user state is resolved in the
 * browser by AuthProvider (brief 5.9).
 */

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: `${SITE_URL}/`,
    title: DEFAULT_TITLE,
    description:
      'Upload any audio file and receive professional music notation in seconds with groovesheet.net. Learn faster, practice smarter, and unlock creative ideas.',
    locale: 'en_US',
    alternateLocale: ['zh_CN', 'zh_TW'],
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description:
      'Upload any song and get editable notation for drums, piano and bass, plus isolated stems and MIDI. PDF, MusicXML and MIDI export.',
    images: [DEFAULT_OG_IMAGE.url],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  other: {
    // Proves to Meta that we own groovesheet.net, which is what lets the
    // Kelin Marketing business portfolio configure the pixel's conversion
    // events.
    'facebook-domain-verification': 'beiieqpdblfnleyj3z52ts1tmldxcr',
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={LOCALE_HTML_LANG[locale]} data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Applies the saved light/dark choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The stylesheets across the app name 'Hubot Sans' literally, so the
            Google Fonts family is loaded as-is rather than through next/font,
            which would rename it. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hubot+Sans:ital,wght@0,200..900;1,200..900&display=swap"
        />
        <HeadScripts />
      </head>
      <body>
        <BodyNoScript />
        <NextIntlClientProvider>
          <ThemeProvider>
            <AuthProvider>
              <LoginModalProvider>
                <AppBoot />
                {children}
              </LoginModalProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
