import { cache } from 'react';
import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { serverFetchJson } from '@/lib/api-server';
import { getT } from '@/lib/i18n-server';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/locales';
import { pageMetadata } from '@/lib/seo/metadata';
import type { CampaignResponse } from '@/lib/types';
import CampaignPage from './_components/CampaignPage';
import { heroCopy, toCampaignState, type CampaignState } from './_components/campaign';

interface Props {
  params: Promise<{ locale: string; code: string }>;
}

// Campaign codes are rows in a database, not files: render each on first
// request and keep it for five minutes, never enumerate them at build time.
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams(): Array<{ code: string }> {
  return [];
}

/**
 * The anonymous view of the campaign row. It never carries a token, so the
 * cached page is the same for every visitor (brief 5.9); the signed-in states
 * are resolved in the browser. Null means the API could not be reached, and
 * the client island then does the lookup itself, as the CRA page always did.
 */
const loadCampaign = cache(async (code: string): Promise<CampaignState | null> => {
  if (!code) return { status: 'invalid', code, campaign: null };
  try {
    const data = await serverFetchJson<CampaignResponse>(`/campaign/${encodeURIComponent(code)}`);
    // The API answers an unknown code with {status: 'invalid'}; a bare 404 means the same.
    return data ? toCampaignState(data) : { status: 'invalid', code, campaign: null };
  } catch (err) {
    console.warn(`Campaign lookup for ${code} failed on the server:`, err);
    return null;
  }
});

function asLocale(locale: string): Locale {
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, code: rawCode } = await params;
  const code = rawCode.trim();
  const t = await getT(asLocale(locale));
  const state = await loadCampaign(code);
  const { headline, sub } = state
    ? heroCopy(state, t)
    : { headline: `Campaign ${code}`, sub: undefined };
  return pageMetadata({
    // The headlines end in a full stop ("30 Free Minutes For X."), which reads
    // oddly before the " | GrooveSheet" suffix.
    title: headline.replace(/\.\s*$/, ''),
    description: sub,
    path: `/signup/${encodeURIComponent(code)}`,
    locale,
    image: state?.campaign?.logo_url ?? null,
    // Campaign links are shared in group chats, not found through search.
    noindex: true,
  });
}

export default async function SignupCodeRoute({ params }: Props) {
  const { locale, code: rawCode } = await params;
  setRequestLocale(locale);
  const code = rawCode.trim();
  const initial = await loadCampaign(code);
  return <CampaignPage code={code} initial={initial} />;
}
