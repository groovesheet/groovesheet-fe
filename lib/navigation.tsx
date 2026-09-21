/**
 * Locale-aware navigation, and the react-router replacements.
 *
 * Every href passed to these is the English (unprefixed) path. next-intl adds
 * `/zh-CN` or `/zh-TW` for the current locale, and leaves English bare, which
 * is what buildLocalePath did in the CRA app.
 *
 *   react-router                     here
 *   ------------------------------   -------------------------------------------
 *   <Link to="/x">                   <Link href="/x">  (or <LocalizedLink to>)
 *   useNavigate()('/x')              useRouter().push('/x')
 *   useNavigate()('/x', {replace})   useRouter().replace('/x')
 *   useNavigate()(-1)                useRouter().back()
 *   useLocalizedNavigate()           useLocalizedNavigate() from lib/navigation-client
 *   useLocation().pathname           usePathname()  (locale already stripped)
 *   useLocation().search             useSearchParams() from next/navigation
 *   useParams() in a client file     useParams() from next/navigation
 *   params in a Server Component     `const { id } = await params`  (a Promise)
 *   <Navigate to replace />          redirect({ href, locale }) in a Server Component
 *
 * This module is server-safe (no 'use client'), so Server Components can use
 * redirect, getPathname and Link from it. The one hook that needs a client
 * module lives in lib/navigation-client.ts.
 */
import { createNavigation } from 'next-intl/navigation';
import type { ComponentProps } from 'react';
import { routing } from '@/i18n/routing';

export { buildLocalePath, stripLocaleFromPath } from '@/lib/locales';

export const { Link, redirect, usePathname, useRouter, getPathname, permanentRedirect } =
  createNavigation(routing);

type LinkProps = ComponentProps<typeof Link>;

/** Drop-in for the CRA LocalizedLink: `to` instead of `href`. */
export function LocalizedLink({ to, ...rest }: Omit<LinkProps, 'href'> & { to: LinkProps['href'] }) {
  return <Link href={to} {...rest} />;
}
