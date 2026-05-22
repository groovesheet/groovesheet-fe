import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en/common.json';
import zhCN from './locales/zh-CN/common.json';
import zhTW from './locales/zh-TW/common.json';

export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'zh-TW'];
export const DEFAULT_LOCALE = 'en';

export const LOCALE_LABELS = {
  en: 'English',
  'zh-CN': '中文 (简体)',
  'zh-TW': '中文 (繁體)',
};

export const LOCALE_SHORT_LABELS = {
  en: 'EN',
  'zh-CN': '简',
  'zh-TW': '繁',
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      'zh-CN': { common: zhCN },
      'zh-TW': { common: zhTW },
    },
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    react: { useSuspense: false },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language || DEFAULT_LOCALE;
}

export default i18n;
