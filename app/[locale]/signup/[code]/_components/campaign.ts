/**
 * Campaign-row helpers shared by the server page (metadata, first paint) and
 * the client island, so both derive the same copy from the same row.
 */
import type { CompatT } from '@/lib/i18n-compat';
import type { CampaignResponse, CampaignStatus } from '@/lib/types';

/** The campaign row's fields this page reads. The API sends more. */
export interface CampaignInfo {
  credit_minutes: number | null;
  display_name: string | null;
  inviter_name: string | null;
  headline: string | null;
  subheadline: string | null;
  logo_url: string | null;
}

/**
 * What the page renders from: GET /campaign/:code, plus two client-only
 * states, 'loading' (no row yet) and 'success' (set after a claim grants).
 */
export interface CampaignState {
  status: CampaignStatus | 'success' | 'loading';
  code: string | null;
  campaign: CampaignInfo | null;
  balance_seconds?: number;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function readCampaign(row: unknown): CampaignInfo | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  return {
    credit_minutes: typeof r.credit_minutes === 'number' ? r.credit_minutes : null,
    display_name: str(r.display_name),
    inviter_name: str(r.inviter_name),
    headline: str(r.headline),
    subheadline: str(r.subheadline),
    logo_url: str(r.logo_url),
  };
}

export function toCampaignState(response: CampaignResponse): CampaignState {
  return {
    status: response.status,
    code: typeof response.code === 'string' ? response.code : null,
    campaign: readCampaign(response.campaign),
    ...(typeof response.balance_seconds === 'number' ? { balance_seconds: response.balance_seconds } : {}),
  };
}

// The design's "about N to M full songs" claim. Derived from the campaign's
// minutes rather than written into the copy, so a 60-minute campaign says 14 to 15.
export function songRange(minutes: number): { lo: number; hi: number } {
  const lo = Math.max(1, Math.floor(minutes / 4.2));
  const hi = Math.max(lo + 1, Math.ceil(minutes / 4));
  return { lo, hi };
}

export interface CampaignVars {
  minutes: number;
  name: string;
  inviter: string;
  lo: number;
  hi: number;
  [key: string]: string | number;
}

export function campaignVars(campaign: CampaignInfo | null, t: CompatT): CampaignVars {
  const minutes = campaign?.credit_minutes ?? 30;
  const { lo, hi } = songRange(minutes);
  return {
    minutes,
    name: campaign?.display_name || t('campaign.fallbackGroup'),
    inviter: campaign?.inviter_name ?? '',
    lo,
    hi,
  };
}

/** Hero headline and sub for the marketing states; campaign overrides win. */
export function heroCopy(state: CampaignState, t: CompatT): { headline: string; sub: string } {
  const tv = campaignVars(state.campaign, t);
  if (state.status === 'invalid') {
    return { headline: t('campaign.invalid.title'), sub: t('campaign.invalid.sub') };
  }
  if (state.status === 'expired') {
    return { headline: t('campaign.expired.title', tv), sub: t('campaign.expired.sub', tv) };
  }
  return {
    headline: state.campaign?.headline || t('campaign.hero.title', tv),
    sub:
      state.campaign?.subheadline ||
      t(state.campaign?.inviter_name ? 'campaign.hero.subWithInviter' : 'campaign.hero.sub', tv),
  };
}
