/**
 * Campaign signup landing page — `/signup/:code`.
 *
 * One template, rendered per promo code off the campaign row the API returns,
 * so a new CCA / event / sponsor campaign is a database insert rather than a
 * new page. Nothing here is hard-coded to any one campaign; every name, credit
 * amount and derived claim ("≈ 7–8 full songs") comes from that row.
 *
 * Seven states, all real (see `status` from GET /campaign/:code):
 *   loading | default | success | signed_in | signed_in_ineligible
 *   | redeemed | invalid | expired
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  UploadSimple,
  Waveform,
} from '@phosphor-icons/react';

import Header from './layout/Header';
import Footer from './layout/Footer';
import { useAuth, useSignIn, useUser } from '../auth';
import { LocalizedLink } from '../i18n/locale';
import {
  claimCampaign,
  clearPendingCampaignCode,
  fetchCampaign,
  setPendingCampaignCode,
} from '../utils/api';
import { StatusMessage } from './ui/StatusMessage';
import { SkeletonPanel } from './ui/SkeletonPanel';
import './CampaignPage.css';

// Where the OAuth round trip should drop the visitor back. SSOCallback reads
// this; anything it can't verify as a same-origin path is ignored.
const POST_AUTH_REDIRECT_KEY = 'gs_post_auth_redirect';

// The design's "≈ N–M full songs" claim. Derived from the campaign's minutes
// rather than written into the copy, so a 60-minute campaign says 14–15.
function songRange(minutes) {
  const lo = Math.max(1, Math.floor(minutes / 4.2));
  const hi = Math.max(lo + 1, Math.ceil(minutes / 4));
  return { lo, hi };
}

const CODE_LENGTH = 6;

export default function CampaignPage() {
  const { code: rawCode } = useParams();
  const code = (rawCode || '').trim();
  const { t, i18n } = useTranslation();
  const { isSignedIn, isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const { signIn } = useSignIn();

  const [state, setState] = useState({ status: 'loading', campaign: null });
  const [step, setStep] = useState('choose'); // choose | email | code
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [optIn, setOptIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);
  const topRef = useRef(null);
  const claimAttempted = useRef(false);

  const apiBase = '/api';

  // ---------------------------------------------------------------- load ---
  const load = useCallback(async () => {
    try {
      const data = await fetchCampaign(apiBase, code, isSignedIn ? getToken : null);
      setState(data);
    } catch (err) {
      // The API being unreachable must not leave a dead page: fall back to the
      // invalid state, which still explains the product and offers signup.
      console.warn('Campaign lookup failed:', err);
      setState({ status: 'invalid', campaign: null });
    }
  }, [apiBase, code, isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    load();
  }, [isLoaded, load]);

  // Remember the code across an OAuth redirect, which leaves the page entirely.
  useEffect(() => {
    if (code) setPendingCampaignCode(code);
  }, [code]);

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
    if (!sessionStorage.getItem(`gs_campaign_pending_${code}`)) return;
    claimAttempted.current = true;
    sessionStorage.removeItem(`gs_campaign_pending_${code}`);
    doClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, state.status, code]);

  const doClaim = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await claimCampaign(apiBase, code, getToken);
      clearPendingCampaignCode();
      setState((prev) => ({
        ...prev,
        status: result.status === 'already_claimed' ? 'redeemed' : 'success',
        balance_seconds: result.balance_seconds,
      }));
    } catch (err) {
      if (err.status === 409) {
        setState((prev) => ({ ...prev, status: 'signed_in_ineligible' }));
      } else if (err.status === 410 || err.status === 404) {
        setState((prev) => ({ ...prev, status: err.status === 404 ? 'invalid' : 'expired' }));
      } else {
        setError(err.message || t('campaign.errors.claimFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------- auth ------
  const rememberReturn = () => {
    try {
      sessionStorage.setItem(`gs_campaign_pending_${code}`, '1');
      localStorage.setItem(POST_AUTH_REDIRECT_KEY, window.location.pathname);
    } catch (_) {}
  };

  const oauth = async (strategy) => {
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
        emailAddressId: result.supportedFirstFactors?.find(
          (f) => f.strategy === 'email_code'
        )?.emailAddressId,
      });
      setStep('code');
      setDigits(Array(CODE_LENGTH).fill(''));
      setTimeout(() => document.getElementById('gs-campaign-code-0')?.focus(), 0);
    } catch (err) {
      console.error('Failed to send code:', err);
      setError(err.message || t('campaign.errors.sendFailed'));
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
      // Signed in without leaving the page — claim straight away so the
      // visitor sees the success state rather than a reload.
      claimAttempted.current = true;
      sessionStorage.removeItem(`gs_campaign_pending_${code}`);
      await doClaim();
    } catch (err) {
      console.error('Code verification failed:', err);
      setError(err.message || t('campaign.errors.badCode'));
    } finally {
      setBusy(false);
    }
  };

  const onDigit = (index, value) => {
    if (!/^\d*$/.test(value) || value.length > 1) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < CODE_LENGTH - 1) {
      document.getElementById(`gs-campaign-code-${index + 1}`)?.focus();
    }
  };

  const onDigitKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      document.getElementById(`gs-campaign-code-${index - 1}`)?.focus();
    }
  };

  const onDigitPaste = (event) => {
    event.preventDefault();
    const pasted = (event.clipboardData.getData('text') || '').replace(/\D/g, '');
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill('');
    pasted.slice(0, CODE_LENGTH).split('').forEach((d, i) => { next[i] = d; });
    setDigits(next);
    const last = Math.min(pasted.length, CODE_LENGTH) - 1;
    document.getElementById(`gs-campaign-code-${last}`)?.focus();
  };

  // ------------------------------------------------------------ derived ----
  const campaign = state.campaign;
  const minutes = campaign?.credit_minutes ?? 30;
  const displayName = campaign?.display_name || t('campaign.fallbackGroup');
  const inviter = campaign?.inviter_name || null;
  const { lo, hi } = useMemo(() => songRange(minutes), [minutes]);
  const status = state.status;

  const isMarketing = status === 'default' || status === 'invalid' || status === 'expired';
  const balanceMinutes = Math.max(0, Math.round((state.balance_seconds ?? 0) / 60));

  const tv = { minutes, name: displayName, inviter, lo, hi };

  // Headline/sub: campaign overrides win, otherwise the generated defaults.
  let headline = campaign?.headline || t('campaign.hero.title', tv);
  let sub = campaign?.subheadline || t(inviter ? 'campaign.hero.subWithInviter' : 'campaign.hero.sub', tv);
  if (status === 'invalid') {
    headline = t('campaign.invalid.title');
    sub = t('campaign.invalid.sub');
  } else if (status === 'expired') {
    headline = t('campaign.expired.title', tv);
    sub = t('campaign.expired.sub', tv);
  }

  const accountStates = {
    success: {
      Icon: CheckCircle, iconBg: '#22c55e',
      title: t('campaign.success.title', tv),
      body: t('campaign.success.body', tv),
      cta: t('campaign.success.cta'), ctaTo: '/',
      cta2: t('campaign.success.cta2'), cta2To: '/account/billing',
      balance: true, next: true,
    },
    signed_in: {
      Icon: Gift, iconBg: '#012fa7',
      title: t('campaign.signedIn.title', tv),
      // The provider does not always hand back an email (some Apple sign-ins
      // hide it), and "Signed in as ." reads like a bug.
      body: user?.email
        ? t('campaign.signedIn.body', { ...tv, email: user.email })
        : t('campaign.signedIn.bodyNoEmail', tv),
      cta: t('campaign.signedIn.cta', tv), onCta: doClaim,
      cta2: t('campaign.signedIn.cta2'), cta2To: '/account/profile',
    },
    signed_in_ineligible: {
      Icon: CrownSimple, iconBg: '#5f5e60',
      title: t('campaign.ineligible.title'),
      body: t('campaign.ineligible.body', tv),
      cta: t('campaign.ineligible.cta'), ctaTo: '/',
      cta2: t('campaign.ineligible.cta2'), onCta2: () => {
        navigator.clipboard?.writeText(window.location.href);
      },
    },
    redeemed: {
      Icon: SealCheck, iconBg: '#22c55e',
      title: t('campaign.redeemed.title', tv),
      body: t('campaign.redeemed.body', tv),
      cta: t('campaign.redeemed.cta'), ctaTo: '/',
      cta2: t('campaign.redeemed.cta2'), cta2To: '/pricing',
      balance: true,
    },
  };
  const account = accountStates[status] || null;

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
      <Backdrop code={state.code || code} />
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
                <span><CreditCard size={18} /> {t('campaign.assurance.noCard')}</span>
                <span><Lightning size={18} /> {t('campaign.assurance.instant')}</span>
                <span><Prohibit size={18} /> {t('campaign.assurance.noCharge')}</span>
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
                <code>{state.code || code}</code>
              </div>
            )}

            {step === 'choose' && (
              <>
                <div className="cmp-auth-title">{t('campaign.continueWith')}</div>
                <div className="cmp-auth-grid">
                  <AuthTile
                    label="Google" bg="/images/Google_Bg.png"
                    Icon={GoogleLogo} onClick={() => oauth('oauth_google')}
                  />
                  <AuthTile
                    label="Facebook" bg="/images/Facebook_Bg.png"
                    Icon={FacebookLogo} onClick={() => oauth('oauth_facebook')}
                  />
                  <AuthTile
                    label="Apple" bg="/images/Apple_Bg.png" dark
                    Icon={AppleLogo} onClick={() => oauth('oauth_apple')}
                  />
                  <AuthTile
                    label={t('campaign.email')} bg="/images/Email_Bg.png"
                    Icon={EnvelopeSimple} onClick={() => { setError(null); setStep('email'); }}
                  />
                </div>
              </>
            )}

            {step === 'email' && (
              <div>
                <button className="cmp-back" onClick={() => { setError(null); setStep('choose'); }}>
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
                  onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                />
                <button className="cmp-primary-btn" onClick={sendCode} disabled={busy}>
                  {busy ? t('campaign.sending') : t('campaign.sendCode')}
                </button>
              </div>
            )}

            {step === 'code' && (
              <div>
                <button className="cmp-back" onClick={() => { setError(null); setStep('email'); }}>
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
                <button className="cmp-primary-btn" onClick={confirmCode} disabled={busy}>
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
                  <div className="cmp-stat-value">{lo}–{hi}</div>
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
                <button className="cmp-ghost-btn" onClick={account.onCta2}>{account.cta2}</button>
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
                {Array.from({ length: hi }, (_, i) => <span key={i} />)}
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
                    className="cmp-faq-q"
                    onClick={() => setOpenFaq((cur) => (cur === i ? -1 : i))}
                    aria-expanded={openFaq === i}
                  >
                    <span>{item.q}</span>
                    <svg className={openFaq === i ? 'is-open' : ''} viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 10l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" />
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
                {status === 'default' ? t('campaign.bottom.title', tv)
                  : status === 'invalid' ? t('campaign.invalid.bottomTitle')
                  : t('campaign.expired.bottomTitle')}
              </h2>
              <p className="cmp-bottom-body">
                {status === 'default' ? t('campaign.bottom.body')
                  : status === 'invalid' ? t('campaign.invalid.bottomBody')
                  : t('campaign.expired.bottomBody')}
              </p>
            </div>
            {status === 'expired' ? (
              <LocalizedLink className="cmp-invert-btn" to="/help">
                <span>{t('campaign.expired.bottomCta')}</span>
                <ArrowRight size={16} weight="fill" />
              </LocalizedLink>
            ) : (
              <button className="cmp-invert-btn" onClick={scrollTop}>
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
function Backdrop({ code }) {
  const [failed, setFailed] = useState(false);
  if (!code || failed) return null;
  return (
    <img
      className="cmp-backdrop"
      src={`${process.env.PUBLIC_URL}/images/campaigns/${encodeURIComponent(code)}-bg.webp`}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The campaign mark, blown up and bled off the corner as background texture.
 *
 * Campaign logos are supplied as flat black-on-white PNGs with no alpha, so
 * `invert` + `screen` is what knocks the white ground out on this dark page —
 * the same pair the foreground lockup used before this replaced it.
 */
function Watermark({ src }) {
  return <img className="cmp-watermark" src={src} alt="" aria-hidden="true" />;
}

function AuthTile({ label, bg, Icon, onClick, dark }) {
  return (
    <button
      className={`cmp-auth-tile ${dark ? 'is-dark' : ''}`}
      style={{ backgroundImage: `url(${bg})` }}
      onClick={onClick}
    >
      <span className="cmp-auth-tile-label">{label}</span>
      <Icon size={40} weight="fill" />
    </button>
  );
}

function Feature({ Icon, title, body }) {
  return (
    <div className="cmp-feature">
      <Icon size={34} />
      <div className="cmp-feature-title">{title}</div>
      <p>{body}</p>
    </div>
  );
}

function NextStep({ Icon, title, body }) {
  return (
    <div className="cmp-next-step">
      <Icon size={24} />
      <div className="cmp-next-step-title">{title}</div>
      <div className="cmp-next-step-body">{body}</div>
    </div>
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

/**
 * The MP3 → MIDI → sheet-music loop. Purely decorative and entirely CSS-driven
 * (one 11s timeline, no JS), so it costs nothing on the phones this page is
 * mostly opened on and disappears under prefers-reduced-motion.
 */
function PipelineAnimation({ t }) {
  return (
    <div className="cmp-anim" aria-hidden="true">
      <div className="cmp-anim-stage">
        <div className="cmp-anim-zone">
          <UploadSimple size={30} />
          <span>{t('campaign.anim.drop')}</span>
        </div>
        <div className="cmp-anim-zone-hot" />

        <div className="cmp-anim-file">
          <span className="cmp-anim-file-art"><MusicNotesSimple size={18} weight="fill" /></span>
          <span className="cmp-anim-file-meta">
            <span className="cmp-anim-file-name">band-practice.mp3</span>
            <span className="cmp-anim-file-size">3:58 · 7.4 MB</span>
          </span>
        </div>

        <svg className="cmp-anim-cursor" width="19" height="26" viewBox="0 0 19 26" fill="none">
          <path d="M1 1L1 20.5L6.2 15.6L9.8 24L13.2 22.4L9.7 14.2L17 13.6L1 1Z"
            fill="#ffffff" stroke="#171717" strokeWidth="1.4" />
        </svg>

        <div className="cmp-anim-wave">
          <div className="cmp-anim-bars">
            {[18, 34, 56, 82, 44, 26, 64, 100, 70, 40, 22, 58, 88, 62, 36, 24, 52, 78, 96, 66, 42, 28, 60, 84, 50, 30, 20, 14]
              .map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
          </div>
          <div className="cmp-anim-progress"><span /></div>
        </div>

        <div className="cmp-anim-midi">
          {[
            [[8], [16, 1], [6], [12, 1], [24], [18, 1]],
            [[22], [10, 2], [8], [26, 2], [6], [14, 2]],
            [[4], [28, 1], [14], [9, 1], [10], [22, 1]],
            [[14], [12, 2], [20], [16, 2], [8], [24, 2]],
            [[30], [20, 1], [10], [34, 1]],
          ].map((row, r) => (
            <div className="cmp-anim-midi-row" key={r}>
              {row.map(([w, tone], i) => (
                <span key={i} className={tone ? `is-note tone-${tone}` : ''} style={{ width: `${w}%` }} />
              ))}
            </div>
          ))}
        </div>

        <div className="cmp-anim-sheet">
          <div className="cmp-anim-sheet-meta">DRUM SET · 4/4 · ♩ = 92</div>
          <DrumStave />
        </div>
      </div>

      <div className="cmp-anim-pills">
        <span className="cmp-anim-pill p1">MP3</span>
        <ArrowRight size={12} />
        <span className="cmp-anim-pill p2">MIDI</span>
        <ArrowRight size={12} />
        <span className="cmp-anim-pill p3">{t('campaign.anim.sheet')}</span>
      </div>
    </div>
  );
}

/** One bar of hi-hat/kick/snare notation, drawn to scale from the design. */
function DrumStave() {
  const hats = [20, 38, 56, 74, 92, 110, 128, 146, 172, 190, 208, 226, 244, 262, 280, 298];
  const beams = [[20, 74], [92, 146], [172, 226], [244, 298]];
  const snares = [74, 146, 226, 298];
  const kicks = [20, 92, 172, 244];
  return (
    <svg viewBox="0 -8 320 80" xmlns="http://www.w3.org/2000/svg">
      {[26, 36, 46, 56, 66].map((y) => (
        <line key={y} x1="8" y1={y} x2="312" y2={y} stroke="#111" strokeWidth="1" />
      ))}
      <line x1="8" y1="26" x2="8" y2="66" stroke="#111" strokeWidth="1.4" />
      <line x1="160" y1="26" x2="160" y2="66" stroke="#111" strokeWidth="1.4" />
      <line x1="312" y1="26" x2="312" y2="66" stroke="#111" strokeWidth="3" />
      {beams.map(([x1, x2], i) => (
        <line key={i} x1={x1} y1="-2" x2={x2} y2="-2" stroke="#111" strokeWidth="3.2" />
      ))}
      {hats.map((x) => (
        <g key={x}>
          <path d={`M${x - 4} 8 L${x + 4} 16 M${x + 4} 8 L${x - 4} 16`}
            stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
          <line x1={x} y1="12" x2={x} y2="-2" stroke="#111" strokeWidth="1.4" />
        </g>
      ))}
      {snares.map((x) => (
        <ellipse key={`s${x}`} cx={x} cy="41" rx="5.2" ry="3.8" fill="#111"
          transform={`rotate(-18 ${x} 41)`} />
      ))}
      {kicks.map((x) => (
        <ellipse key={`k${x}`} cx={x} cy="61" rx="5.2" ry="3.8" fill="#111"
          transform={`rotate(-18 ${x} 61)`} />
      ))}
    </svg>
  );
}
