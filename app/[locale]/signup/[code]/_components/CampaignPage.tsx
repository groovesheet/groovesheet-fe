/**
 * Campaign signup landing page, `/signup/:code`. Ported from
 * src/components/CampaignPage.js.
 *
 * One template, rendered per promo code off the campaign row the API returns,
 * so a new CCA / event / sponsor campaign is a database insert rather than a
 * new page. Nothing here is hard-coded to any one campaign; every name, credit
 * amount and derived claim ("about 7 to 8 full songs") comes from that row.
 *
 * States (see `status` from GET /campaign/:code):
 *   loading | default | success | signed_in | signed_in_ineligible
 *   | redeemed | invalid | expired
 *
 * Changed from the CRA version on purpose: the server page fetches the row
 * anonymously and passes it in as `initial`, so the marketing copy is in the
 * server HTML and there is no loading skeleton for signed-out visitors. The
 * anonymous row is only refetched once the browser knows the visitor is
 * signed in (the signed-in states come from the token-bearing lookup). OAuth
 * returns here through the gs_auth_next cookie that lib/auth writes, so the
 * old gs_post_auth_redirect localStorage key is gone.
 */
'use client';

import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  AppleLogo,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle,
  CreditCard,
  CrownSimple,
  DownloadSimple,
  EnvelopeSimple,
  FacebookLogo,
  FileAudio,
  Gift,
  GoogleLogo,
  Lightning,
  MusicNotesSimple,
  PianoKeys,
  Prohibit,
  SealCheck,
  SlidersHorizontal,
  Waveform,
} from '@phosphor-icons/react';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import StatusMessage from '@/components/ui/StatusMessage';
import SkeletonPanel from '@/components/ui/SkeletonPanel';
import { useAuth, useSignIn, useUser, type OAuthStrategy } from '@/lib/auth';
import { claimCampaign, clearPendingCampaignCode, fetchCampaign, setPendingCampaignCode } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { LocalizedLink } from '@/lib/navigation';
import type { CampaignResponse, HttpError } from '@/lib/types';
import { AuthTile, Feature, NextStep, PipelineAnimation, Watermark } from './CampaignArt';
import { campaignVars, heroCopy, toCampaignState, type CampaignState } from './campaign';
import './CampaignPage.css';

const CODE_LENGTH = 6;
const EMPTY_DIGITS: string[] = Array.from({ length: CODE_LENGTH }, () => '');
const API_BASE = '/api';

type Step = 'choose' | 'email' | 'code';

interface AccountState {
  Icon: PhosphorIcon;
  iconBg: string;
  title: string;
  body: string;
  cta: string;
  ctaTo?: string;
  onCta?: () => void;
  cta2: string;
  cta2To?: string;
  onCta2?: () => void;
  balance?: boolean;
  next?: boolean;
}

function errorMessage(err: unknown): string | null {
  return err instanceof Error && err.message ? err.message : null;
}

function errorStatus(err: unknown): number | undefined {
  return err instanceof Error ? (err as HttpError).status : undefined;
}

function pendingKey(code: string): string {
  return `gs_campaign_pending_${code}`;
}

function readPending(code: string): boolean {
  try {
    return Boolean(sessionStorage.getItem(pendingKey(code)));
  } catch {
    return false;
  }
}

function clearPending(code: string): void {
  try {
    sessionStorage.removeItem(pendingKey(code));
  } catch {
    /* storage disabled */
  }
}

function focusDigit(index: number): void {
  document.getElementById(`gs-campaign-code-${index}`)?.focus();
}

export interface CampaignPageProps {
  code: string;
  /** The anonymous GET /campaign/:code row, or null when the server could not reach the API. */
  initial: CampaignState | null;
}

export default function CampaignPage({ code, initial }: CampaignPageProps) {
  const { t, i18n } = useTranslation();
  const { isSignedIn, isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const { signIn } = useSignIn();

  const [state, setState] = useState<CampaignState>(
    initial ?? { status: 'loading', code, campaign: null }
  );
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(EMPTY_DIGITS);
  const [optIn, setOptIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const claimAttempted = useRef(false);
  const hasInitial = initial !== null;

  // ---------------------------------------------------------------- load ---
  useEffect(() => {
    if (!isLoaded) return undefined;
    // Signed out, the server's anonymous row is already the answer.
    if (!isSignedIn && hasInitial) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCampaign<CampaignResponse>(API_BASE, code, isSignedIn ? getToken : null);
        // A claim already under way owns the state now; a lookup that started
        // before it would put the "Claim" button back.
        if (cancelled || claimAttempted.current) return;
        setState(toCampaignState(data));
      } catch (err) {
        // The API being unreachable must not leave a dead page: fall back to the
        // invalid state, which still explains the product and offers signup.
        console.warn('Campaign lookup failed:', err);
        if (!cancelled) setState({ status: 'invalid', code, campaign: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, hasInitial, code, getToken]);

  // Remember the code across an OAuth redirect, which leaves the page entirely.
  useEffect(() => {
    if (code) setPendingCampaignCode(code);
  }, [code]);

  const doClaim = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await claimCampaign(API_BASE, code, getToken);
      clearPendingCampaignCode();
      setState((prev) => ({
        ...prev,
        status: result.status === 'already_claimed' ? 'redeemed' : 'success',
        balance_seconds: result.balance_seconds,
      }));
    } catch (err) {
      const status = errorStatus(err);
      if (status === 409) {
        setState((prev) => ({ ...prev, status: 'signed_in_ineligible' }));
      } else if (status === 410 || status === 404) {
        setState((prev) => ({ ...prev, status: status === 404 ? 'invalid' : 'expired' }));
      } else {
        setError(errorMessage(err) || t('campaign.errors.claimFailed'));
      }
    } finally {
      setBusy(false);
    }
  }, [code, getToken, t]);

  // ------------------------------------------------------- claim on entry ---
  // A visitor who signed up through this link and came back from OAuth arrives
  // signed in with nothing granted yet. Claim once, then show `success`.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (state.status !== 'signed_in') return;
    if (claimAttempted.current) return;
    // Only auto-claim for someone who just arrived from the auth round trip.
    // An existing user who merely opens the link gets the explicit "Claim"
    // button instead, so credit is never granted behind their back.
    if (!readPending(code)) return;
    claimAttempted.current = true;
    clearPending(code);
    // Started from a task rather than the effect body, so the effect itself
    // sets no state. No cleanup: the claim must run exactly once, and
    // claimAttempted already stops a second effect run from starting another.
    setTimeout(() => void doClaim(), 0);
  }, [isLoaded, isSignedIn, state.status, code, doClaim]);

  // ------------------------------------------------------------- auth ------
  const rememberReturn = () => {
    try {
      sessionStorage.setItem(pendingKey(code), '1');
    } catch {
      /* storage disabled: the visitor gets the explicit Claim button instead */
    }
  };

  const oauth = async (strategy: OAuthStrategy) => {
    rememberReturn();
    setError(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: window.location.pathname,
      });
    } catch (err) {
      console.error(`${strategy} sign-in failed:`, err);
      setError(t('campaign.errors.authFailed'));
    }
  };

  const sendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t('campaign.errors.badEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    rememberReturn();
    try {
      const result = await signIn.create({ identifier: trimmed });
      await signIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: result.supportedFirstFactors.find((f) => f.strategy === 'email_code')?.emailAddressId,
      });
      setStep('code');
      setDigits(EMPTY_DIGITS);
      setTimeout(() => focusDigit(0), 0);
    } catch (err) {
      console.error('Failed to send code:', err);
      setError(errorMessage(err) || t('campaign.errors.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    const value = digits.join('');
    if (value.length !== CODE_LENGTH) {
      setError(t('campaign.errors.shortCode'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code: value });
      if (result.status !== 'complete') {
        setError(t('campaign.errors.authFailed'));
        return;
      }
      // Signed in without leaving the page: claim straight away so the
      // visitor sees the success state rather than a reload.
      claimAttempted.current = true;
      clearPending(code);
      await doClaim();
    } catch (err) {
      console.error('Code verification failed:', err);
      setError(errorMessage(err) || t('campaign.errors.badCode'));
    } finally {
      setBusy(false);
    }
  };

  const onDigit = (index: number, value: string) => {
    if (!/^\d*$/.test(value) || value.length > 1) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < CODE_LENGTH - 1) focusDigit(index + 1);
  };

  const onDigitKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) focusDigit(index - 1);
  };

  const onDigitPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = (event.clipboardData.getData('text') || '').replace(/\D/g, '');
    if (!pasted) return;
    const next = [...EMPTY_DIGITS];
    pasted
      .slice(0, CODE_LENGTH)
      .split('')
      .forEach((d, i) => {
        next[i] = d;
      });
    setDigits(next);
    focusDigit(Math.min(pasted.length, CODE_LENGTH) - 1);
  };

  // ------------------------------------------------------------ derived ----
  const campaign = state.campaign;
  const tv = campaignVars(campaign, t);
  const { minutes, lo, hi } = tv;
  const status = state.status;
  const shownCode = state.code || code;

  const isMarketing = status === 'default' || status === 'invalid' || status === 'expired';
  const balanceMinutes = Math.max(0, Math.round((state.balance_seconds ?? 0) / 60));
  const { headline, sub } = heroCopy(state, t);

  const accountStates: Partial<Record<CampaignState['status'], AccountState>> = {
    success: {
      Icon: CheckCircle,
      iconBg: '#22c55e',
      title: t('campaign.success.title', tv),
      body: t('campaign.success.body', tv),
      cta: t('campaign.success.cta'),
      ctaTo: '/',
      cta2: t('campaign.success.cta2'),
      cta2To: '/account/billing',
      balance: true,
      next: true,
    },
    signed_in: {
      Icon: Gift,
      iconBg: '#012fa7',
      title: t('campaign.signedIn.title', tv),
      // The provider does not always hand back an email (some Apple sign-ins
      // hide it), and "Signed in as ." reads like a bug.
      body: user?.email
        ? t('campaign.signedIn.body', { ...tv, email: user.email })
        : t('campaign.signedIn.bodyNoEmail', tv),
      cta: t('campaign.signedIn.cta', tv),
      onCta: () => void doClaim(),
      cta2: t('campaign.signedIn.cta2'),
      cta2To: '/account/profile',
    },
    signed_in_ineligible: {
      Icon: CrownSimple,
      iconBg: '#5f5e60',
      title: t('campaign.ineligible.title'),
      body: t('campaign.ineligible.body', tv),
      cta: t('campaign.ineligible.cta'),
      ctaTo: '/',
      cta2: t('campaign.ineligible.cta2'),
      onCta2: () => {
        void navigator.clipboard?.writeText(window.location.href);
      },
    },
    redeemed: {
      Icon: SealCheck,
      iconBg: '#22c55e',
      title: t('campaign.redeemed.title', tv),
      body: t('campaign.redeemed.body', tv),
      cta: t('campaign.redeemed.cta'),
      ctaTo: '/',
      cta2: t('campaign.redeemed.cta2'),
      cta2To: '/pricing',
      balance: true,
    },
  };
  const account = accountStates[status] ?? null;

  const faq = [
    { q: t('campaign.faq.q1'), a: t('campaign.faq.a1') },
    { q: t('campaign.faq.q2'), a: t('campaign.faq.a2') },
    { q: t('campaign.faq.q3', tv), a: t('campaign.faq.a3') },
    { q: t('campaign.faq.q4'), a: t('campaign.faq.a4') },
  ];

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ------------------------------------------------------------- render ----
  return (
    <div className="campaign-page" lang={i18n.language}>
      <Backdrop code={shownCode} />
      <Header onLoginClick={scrollTop} />
      <div ref={topRef} />

      {status === 'loading' && <LoadingSkeleton />}

      {isMarketing && (
        <section className="cmp-hero">
          {campaign?.logo_url && <Watermark src={campaign.logo_url} />}
          <div className="cmp-hero-copy">
            <h1 className="cmp-h1">{headline}</h1>
            <p className="cmp-sub">{sub}</p>

            {status === 'default' && (
              <div className="cmp-assurances">
                <span>
                  <CreditCard size={18} /> {t('campaign.assurance.noCard')}
                </span>
                <span>
                  <Lightning size={18} /> {t('campaign.assurance.instant')}
                </span>
                <span>
                  <Prohibit size={18} /> {t('campaign.assurance.noCharge')}
                </span>
              </div>
            )}
          </div>

          <div className="cmp-auth-card">
            {status === 'default' && (
              <div className="cmp-code-chip">
                <span className="cmp-code-chip-label">
                  <SealCheck size={17} weight="fill" />
                  {t('campaign.codeApplied')}
                </span>
                <code>{shownCode}</code>
              </div>
            )}

            {step === 'choose' && (
              <>
                <div className="cmp-auth-title">{t('campaign.continueWith')}</div>
                <div className="cmp-auth-grid">
                  <AuthTile
                    label="Google"
                    bg="/images/Google_Bg.png"
                    Icon={GoogleLogo}
                    onClick={() => void oauth('oauth_google')}
                  />
                  <AuthTile
                    label="Facebook"
                    bg="/images/Facebook_Bg.png"
                    Icon={FacebookLogo}
                    onClick={() => void oauth('oauth_facebook')}
                  />
                  <AuthTile
                    label="Apple"
                    bg="/images/Apple_Bg.png"
                    dark
                    Icon={AppleLogo}
                    onClick={() => void oauth('oauth_apple')}
                  />
                  <AuthTile
                    label={t('campaign.email')}
                    bg="/images/Email_Bg.png"
                    Icon={EnvelopeSimple}
                    onClick={() => {
                      setError(null);
                      setStep('email');
                    }}
                  />
                </div>
              </>
            )}

            {step === 'email' && (
              <div>
                <button
                  type="button"
                  className="cmp-back"
                  onClick={() => {
                    setError(null);
                    setStep('choose');
                  }}
                >
                  <ArrowLeft size={18} /> {t('campaign.back')}
                </button>
                <p className="cmp-auth-prompt">{t('campaign.emailPrompt')}</p>
                <input
                  className="cmp-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={t('campaign.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void sendCode();
                  }}
                />
                <button type="button" className="cmp-primary-btn" onClick={() => void sendCode()} disabled={busy}>
                  {busy ? t('campaign.sending') : t('campaign.sendCode')}
                </button>
              </div>
            )}

            {step === 'code' && (
              <div>
                <button
                  type="button"
                  className="cmp-back"
                  onClick={() => {
                    setError(null);
                    setStep('email');
                  }}
                >
                  <ArrowLeft size={18} /> {t('campaign.back')}
                </button>
                <p className="cmp-auth-prompt">{t('campaign.codePrompt')}</p>
                <div className="cmp-email-echo">{email}</div>
                <div className="cmp-digits">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      id={`gs-campaign-code-${i}`}
                      className="cmp-digit"
                      type="text"
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      value={d}
                      onChange={(e) => onDigit(i, e.target.value)}
                      onKeyDown={(e) => onDigitKeyDown(i, e)}
                      onPaste={onDigitPaste}
                      aria-label={t('campaign.digitAria', { n: i + 1 })}
                    />
                  ))}
                </div>
                <button type="button" className="cmp-primary-btn" onClick={() => void confirmCode()} disabled={busy}>
                  {busy ? t('campaign.confirming') : t('campaign.confirm')}
                </button>
              </div>
            )}

            {error && <StatusMessage variant="error">{error}</StatusMessage>}

            <button
              type="button"
              className="cmp-optin"
              onClick={() => setOptIn((v) => !v)}
              aria-pressed={optIn}
            >
              <span className={`cmp-checkbox ${optIn ? 'is-on' : ''}`}>
                {optIn && <Check size={14} weight="bold" />}
              </span>
              <span>{t('campaign.optIn')}</span>
            </button>

            <p className="cmp-disclaimer">
              {t('campaign.disclaimerA')}
              <LocalizedLink to="/terms">{t('campaign.terms')}</LocalizedLink>
              {t('campaign.disclaimerB')}
              <LocalizedLink to="/privacy-policy">{t('campaign.privacy')}</LocalizedLink>.
            </p>
          </div>
        </section>
      )}

      {account && (
        <section className="cmp-account">
          <div className="cmp-account-card">
            {campaign?.logo_url && <Watermark src={campaign.logo_url} />}
            <div className="cmp-account-head">
              <span className="cmp-status-icon" style={{ background: account.iconBg }}>
                <account.Icon size={28} weight="fill" />
              </span>
            </div>
            <h1 className="cmp-account-title">{account.title}</h1>
            <p className="cmp-account-body">{account.body}</p>

            {account.balance && (
              <div className="cmp-stats">
                <div className="cmp-stat">
                  <div className="cmp-stat-label">{t('campaign.balanceLabel')}</div>
                  <div className="cmp-stat-value">{balanceMinutes}:00</div>
                  <div className="cmp-stat-sub">{t('campaign.balanceSub')}</div>
                </div>
                <div className="cmp-stat">
                  <div className="cmp-stat-label">{t('campaign.grantedLabel')}</div>
                  <div className="cmp-stat-value">{`${lo}\u2013${hi}`}</div>
                  <div className="cmp-stat-sub">{t('campaign.grantedSub')}</div>
                </div>
              </div>
            )}

            {error && <StatusMessage variant="error">{error}</StatusMessage>}

            <div className="cmp-account-ctas">
              {account.ctaTo ? (
                <LocalizedLink className="cmp-primary-btn cmp-inline-btn" to={account.ctaTo}>
                  <span>{account.cta}</span>
                  <ArrowRight size={16} weight="fill" />
                </LocalizedLink>
              ) : (
                <button
                  type="button"
                  className="cmp-primary-btn cmp-inline-btn"
                  onClick={account.onCta}
                  disabled={busy}
                >
                  <span>{busy ? t('campaign.claiming') : account.cta}</span>
                  <ArrowRight size={16} weight="fill" />
                </button>
              )}
              {account.cta2To ? (
                <LocalizedLink className="cmp-ghost-btn" to={account.cta2To}>
                  {account.cta2}
                </LocalizedLink>
              ) : (
                <button type="button" className="cmp-ghost-btn" onClick={account.onCta2}>
                  {account.cta2}
                </button>
              )}
            </div>

            {account.next && (
              <div className="cmp-next">
                <div className="cmp-kicker">{t('campaign.next.title')}</div>
                <div className="cmp-next-grid">
                  <NextStep Icon={FileAudio} title={t('campaign.next.s1')} body={t('campaign.next.s1b')} />
                  <NextStep Icon={SlidersHorizontal} title={t('campaign.next.s2')} body={t('campaign.next.s2b')} />
                  <NextStep Icon={DownloadSimple} title={t('campaign.next.s3')} body={t('campaign.next.s3b')} />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {isMarketing && (
        <>
          <section className="cmp-section">
            <div className="cmp-proof">
              <div className="cmp-proof-copy">
                <div className="cmp-kicker">{t('campaign.proof.kicker')}</div>
                <h2 className="cmp-h2">{t('campaign.proof.title')}</h2>
                <p className="cmp-body">{t('campaign.proof.body')}</p>
              </div>
              <PipelineAnimation t={t} />
            </div>
          </section>

          <section className="cmp-section">
            <h2 className="cmp-h2 cmp-h2-lg">{t('campaign.what.title')}</h2>
            <div className="cmp-feature-grid">
              <Feature Icon={MusicNotesSimple} title={t('campaign.what.f1')} body={t('campaign.what.f1b')} />
              <Feature Icon={Waveform} title={t('campaign.what.f2')} body={t('campaign.what.f2b')} />
              <Feature Icon={PianoKeys} title={t('campaign.what.f3')} body={t('campaign.what.f3b')} />
            </div>
          </section>
        </>
      )}

      {status !== 'loading' && (
        <section className="cmp-section">
          <div className="cmp-credit">
            <div className="cmp-credit-copy">
              <h2 className="cmp-h2">{t('campaign.credit.title', tv)}</h2>
              <p className="cmp-body cmp-body-bright">{t('campaign.credit.body', tv)}</p>
              <p className="cmp-refund">
                <ArrowCounterClockwise size={19} />
                <span>{t('campaign.credit.refund')}</span>
              </p>
            </div>
            <div className="cmp-credit-meter">
              <div className="cmp-credit-figure">
                <strong>{minutes}</strong>
                <span>{t('campaign.credit.unit')}</span>
              </div>
              <div className="cmp-song-blocks" aria-hidden="true">
                {Array.from({ length: hi }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
              <div className="cmp-songs-line">{t('campaign.credit.songs', tv)}</div>
              <div className="cmp-songs-note">{t('campaign.credit.note', tv)}</div>
            </div>
          </div>
        </section>
      )}

      {status !== 'loading' && (
        <section className="cmp-section cmp-faq-section">
          <h2 className="cmp-h2 cmp-h2-lg cmp-center">{t('campaign.faq.title')}</h2>
          <div className="cmp-faq">
            <div className="cmp-faq-aside">
              <h3>{t('campaign.faq.section')}</h3>
            </div>
            <div className="cmp-faq-list">
              {faq.map((item, i) => (
                <div className="cmp-faq-item" key={i}>
                  <button
                    type="button"
                    className="cmp-faq-q"
                    onClick={() => setOpenFaq((cur) => (cur === i ? -1 : i))}
                    aria-expanded={openFaq === i}
                  >
                    <span>{item.q}</span>
                    <svg className={openFaq === i ? 'is-open' : ''} viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 10l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {openFaq === i && <p className="cmp-faq-a">{item.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isMarketing && (
        <section className="cmp-section">
          <div className="cmp-bottom-cta">
            <div>
              <h2 className="cmp-h2">
                {status === 'default'
                  ? t('campaign.bottom.title', tv)
                  : status === 'invalid'
                    ? t('campaign.invalid.bottomTitle')
                    : t('campaign.expired.bottomTitle')}
              </h2>
              <p className="cmp-bottom-body">
                {status === 'default'
                  ? t('campaign.bottom.body')
                  : status === 'invalid'
                    ? t('campaign.invalid.bottomBody')
                    : t('campaign.expired.bottomBody')}
              </p>
            </div>
            {status === 'expired' ? (
              <LocalizedLink className="cmp-invert-btn" to="/help">
                <span>{t('campaign.expired.bottomCta')}</span>
                <ArrowRight size={16} weight="fill" />
              </LocalizedLink>
            ) : (
              <button type="button" className="cmp-invert-btn" onClick={scrollTop}>
                <span>{t('campaign.bottom.cta')}</span>
                <ArrowUp size={16} weight="fill" />
              </button>
            )}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}

/**
 * The campaign's own photo behind the page, mirroring the home page's
 * `.hero-background`: a wide banner pinned to the top, pre-darkened into a
 * 0-64 band and faded to the page ground at its bottom edge.
 *
 * Found by convention at `/images/campaigns/<code>-bg.webp` rather than a
 * column on the campaign row, so giving a campaign a backdrop is dropping a
 * file next to its logo. Campaigns without one 404 and hide the layer, which
 * is the common case.
 */
function Backdrop({ code }: { code: string }) {
  const [failed, setFailed] = useState(false);
  // The <img> is in the server HTML, so a 404 can land before React attaches
  // onError. Check once on mount for an image that already failed.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (!code || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- optional per-campaign asset that may 404; next/image would error on it
    <img
      ref={imgRef}
      className="cmp-backdrop"
      src={`/images/campaigns/${encodeURIComponent(code)}-bg.webp`}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  );
}

function LoadingSkeleton() {
  // SkeletonPanel is the site-wide loading convention (design-system/STATES.md);
  // the shapes below just mirror the hero's two columns.
  return (
    <section className="cmp-hero cmp-skeleton" aria-hidden="true">
      <div className="cmp-hero-copy">
        <SkeletonPanel height={26} style={{ width: '46%' }} />
        <SkeletonPanel height={54} />
        <SkeletonPanel height={54} style={{ width: '64%' }} />
        <SkeletonPanel count={2} height={18} style={{ width: '84%' }} />
      </div>
      <div className="cmp-auth-card">
        <SkeletonPanel height={20} style={{ width: '40%' }} />
        <div className="cmp-auth-grid">
          <SkeletonPanel height={96} />
          <SkeletonPanel height={96} />
          <SkeletonPanel height={96} />
          <SkeletonPanel height={96} />
        </div>
      </div>
    </section>
  );
}
