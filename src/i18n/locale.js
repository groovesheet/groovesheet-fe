import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import i18n, { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './index';

const LocaleContext = createContext(DEFAULT_LOCALE);

export function useLocale() {
  return useContext(LocaleContext);
}

function isPrefixedLocale(locale) {
  return locale && locale !== DEFAULT_LOCALE && SUPPORTED_LOCALES.includes(locale);
}

export function buildLocalePath(locale, path) {
  const target = typeof path === 'string' ? path : path?.pathname || '/';
  if (!isPrefixedLocale(locale)) return target;
  if (target.startsWith(`/${locale}/`) || target === `/${locale}`) return target;
  const trimmed = target.startsWith('/') ? target : `/${target}`;
  return trimmed === '/' ? `/${locale}` : `/${locale}${trimmed}`;
}

export function stripLocaleFromPath(pathname) {
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(`/${locale}`.length);
  }
  return pathname;
}

export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const locale = useLocale();
  return useCallback(
    (to, opts) => {
      if (typeof to === 'number') return navigate(to);
      if (typeof to === 'string') return navigate(buildLocalePath(locale, to), opts);
      if (to && typeof to === 'object' && 'pathname' in to) {
        return navigate({ ...to, pathname: buildLocalePath(locale, to.pathname) }, opts);
      }
      return navigate(to, opts);
    },
    [navigate, locale]
  );
}

export function LocalizedLink({ to, ...rest }) {
  const locale = useLocale();
  return <Link to={buildLocalePath(locale, to)} {...rest} />;
}

export function LocaleScope({ locale, children }) {
  useEffect(() => {
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function LocaleSync() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (pathname !== '/') return;
    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('i18nextLng')) || '';
    if (isPrefixedLocale(stored)) {
      navigate(`/${stored}${search}${hash}`, { replace: true });
    }
  }, [pathname, search, hash, navigate]);

  return null;
}
