/**
 * The one sign-in / sign-up modal. Ported from src/components/LoginModal.js.
 *
 * Mounted once by LoginModalProvider; open it with useLoginModal() rather
 * than rendering another copy. Two ways in:
 *
 *  - OAuth (Google, Facebook, Apple): PKCE. authenticateWithRedirect stores
 *    the landing path in a cookie and leaves for the provider; the
 *    /sso-callback route handler exchanges the code server-side and sends the
 *    visitor back to that path.
 *  - Email: a 6-digit code, verified in the page. The session cookie is
 *    written by the browser client, so nothing leaves the page.
 *
 * Changed from the CRA version on purpose: OAuth returns to the page the
 * visitor was on (or to the /account page they were sent from) instead of
 * `/`; the debug console.logs are gone (one printed the verification code);
 * Tailwind classes are plain CSS in LoginModal.css; the privacy policy text
 * is a real link.
 */
'use client';

import { useState, type ClipboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AppleLogo, ArrowLeft, EnvelopeSimple, FacebookLogo, GoogleLogo, X } from '@phosphor-icons/react';
import { useAuthActions, useSignIn, useSignUp, type OAuthStrategy } from '@/lib/auth';
import { useLocale, useTranslation } from '@/lib/i18n';
import { Link } from '@/lib/navigation';
import { useLoginModal } from '@/components/chrome/LoginModalProvider';
import { EVENTS, track } from '@/lib/analytics';
import { suggestEmail } from '@/lib/emailTypo';
import { emailDomainDeliverable } from '@/lib/emailDomainCheck';
import StatusMessage from '@/components/ui/StatusMessage';
import './LoginModal.css';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CODE_LENGTH = 6;
const CODE_SLOTS = Array.from({ length: CODE_LENGTH }, (_, i) => i);
const EMPTY_CODE: string[] = Array.from({ length: CODE_LENGTH }, () => '');

/** The fields the CRA modal read off an auth error (Clerk-style or Supabase). */
interface AuthErrorShape {
  message?: string;
  status?: number;
  errors?: Array<{ code?: string; message?: string }>;
}

function asAuthError(err: unknown): AuthErrorShape {
  if (typeof err !== 'object' || err === null) return { message: String(err) };
  const e = err as Record<string, unknown>;
  return {
    message: typeof e.message === 'string' ? e.message : undefined,
    status: typeof e.status === 'number' ? e.status : undefined,
    errors: Array.isArray(e.errors) ? (e.errors as AuthErrorShape['errors']) : undefined,
  };
}

function focusCodeInput(index: number): void {
  document.getElementById(`code-input-${index}`)?.focus();
}

/** The mail provider only (qq.com, gmail.com): enough to see which inboxes fail, never the address. */
function emailDomain(email: string): string {
  return email.split('@')[1]?.trim().toLowerCase().slice(0, 60) || '';
}

/** Where the visitor is now, so OAuth brings them back to the same page. */
function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

const PROVIDER_BUTTONS: Array<{
  strategy: OAuthStrategy;
  labelKey: string;
  image: string;
  Icon: typeof GoogleLogo;
}> = [
  { strategy: 'oauth_google', labelKey: 'login.google', image: '/images/Google_Bg.png', Icon: GoogleLogo },
  { strategy: 'oauth_facebook', labelKey: 'login.facebook', image: '/images/Facebook_Bg.png', Icon: FacebookLogo },
  { strategy: 'oauth_apple', labelKey: 'login.apple', image: '/images/Apple_Bg.png', Icon: AppleLogo },
];

/**
 * Google and Facebook do not load in mainland China, so a zh-CN visitor who
 * taps them lands on a dead page and gives up (seen in PostHog, 2026-10-02).
 * There, email comes first and Apple, which does work, next.
 */
const MAINLAND_ORDER: OAuthStrategy[] = ['oauth_apple', 'oauth_google', 'oauth_facebook'];

function backgroundStyle(image: string) {
  return { backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' } as const;
}

export const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { setActive } = useAuthActions();
  const { returnTo } = useLoginModal();
  const { t } = useTranslation();
  const emailFirst = useLocale() === 'zh-CN';
  const [showEmailSignIn, setShowEmailSignIn] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState<string[]>(EMPTY_CODE);
  const [isSignUp, setIsSignUp] = useState(false);
  // "Did you mean ...?" for a likely typo, and the address it was offered for.
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [keptAddress, setKeptAddress] = useState<string | null>(null);
  // Domain that cannot receive mail at all (no such domain, no mail server).
  const [undeliverable, setUndeliverable] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleOAuthSignIn = async (strategy: OAuthStrategy) => {
    track(EVENTS.LOGIN_METHOD_CLICK, { method: strategy.replace('oauth_', ''), email_first: emailFirst });
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: returnTo ?? currentPath(),
      });
    } catch (err) {
      console.error(`Error signing in with ${strategy}:`, err);
    }
  };

  const handleBack = () => {
    setShowEmailSignIn(false);
    setShowVerification(false);
  };

  // Signed in within the page. With a pending /account destination the
  // provider navigates there once the session lands; otherwise reload, as the
  // CRA modal did, so every page re-reads its state as a signed-in visitor.
  const finishSignedIn = () => {
    onClose();
    if (!returnTo) window.location.reload();
  };

  const handleEmailConfirm = async (address: string = email.trim(), keepTyped = false) => {
    if (!address) {
      alert('Please enter your email address');
      return;
    }
    if (checking) return;
    const domain = emailDomain(address);

    // A likely typo (gmial.com, kakacomc.com): ask first. The code would go
    // to an inbox nobody reads and the visitor would just see no email.
    if (!keepTyped && keptAddress !== address) {
      const fix = suggestEmail(address);
      if (fix) {
        setSuggestion(fix);
        track(EVENTS.LOGIN_EMAIL_CHECK, { action: 'shown', email_domain: domain, suggested_domain: emailDomain(fix) });
        return;
      }
    }

    // A domain with no mail server can never receive the code.
    setChecking(true);
    const deliverable = await emailDomainDeliverable(domain);
    setChecking(false);
    if (!deliverable) {
      setUndeliverable(domain);
      track(EVENTS.LOGIN_EMAIL_CHECK, { action: 'no_mail', email_domain: domain });
      return;
    }

    setEmail(address);
    setSuggestion(null);
    setUndeliverable(null);

    // Show the code entry at once; the email is sent in the background.
    setIsSignUp(false);
    setShowVerification(true);
    setTimeout(() => focusCodeInput(0), 0);

    try {
      try {
        const signInResult = await signIn.create({ identifier: address });
        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: signInResult.supportedFirstFactors.find((factor) => factor.strategy === 'email_code')
            ?.emailAddressId,
        });
        track(EVENTS.LOGIN_CODE_SENT, { email_domain: emailDomain(address) });
        return;
      } catch (signInError) {
        // An unknown account (Clerk's 422) falls through to sign-up. Supabase
        // creates the account on first code, so this branch is kept only for
        // the flow objects that still report it.
        const e = asAuthError(signInError);
        if (e.status === 422 || e.errors?.[0]?.code === 'form_identifier_not_found') {
          await signUp.create({ emailAddress: address });
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setIsSignUp(true);
          track(EVENTS.LOGIN_CODE_SENT, { email_domain: emailDomain(address), sign_up: true });
          return;
        }
        throw signInError;
      }
    } catch (err) {
      console.error('Error during email confirmation:', err);
      const e = asAuthError(err);
      track(EVENTS.LOGIN_CODE_ERROR, { stage: 'send', email_domain: emailDomain(address), message: (e.message || '').slice(0, 120) });
      if (e.errors && e.errors.length > 0) {
        alert(`Error: ${e.errors[0].message}`);
      } else {
        alert(`Failed to send verification code: ${e.message}`);
      }
    }
  };

  const handleVerificationCodeChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...verificationCode];
      newCode[index] = value;
      setVerificationCode(newCode);
      if (value && index < CODE_LENGTH - 1) focusCodeInput(index + 1);
    }
  };

  // A pasted code is spread across the inputs from the one that was pasted into.
  const handlePasteVerification = (e: ClipboardEvent<HTMLInputElement>, startIndex: number) => {
    e.preventDefault();
    const digits = (e.clipboardData.getData('Text') || '').replace(/\D/g, '').split('');
    if (!digits.length) return;

    const newCode = [...verificationCode];
    for (let i = 0; i < digits.length && startIndex + i < CODE_LENGTH; i++) {
      newCode[startIndex + i] = digits[i];
    }
    setVerificationCode(newCode);

    let focusIndex = Math.min(CODE_LENGTH - 1, startIndex + digits.length - 1);
    for (let i = startIndex; i < CODE_LENGTH; i++) {
      if (!newCode[i]) {
        focusIndex = i;
        break;
      }
    }
    focusCodeInput(focusIndex);
  };

  const handleVerificationConfirm = async () => {
    const code = verificationCode.join('');
    if (code.length !== CODE_LENGTH) {
      alert('Please enter the complete 6-digit code');
      return;
    }

    try {
      let result;
      if (isSignUp) {
        result = await signUp.attemptEmailAddressVerification({ code });
        if (result.status === 'missing_requirements') {
          // Email verified but the provider wants a finalize step.
          try {
            const completeResult = await signUp.update({});
            if (completeResult.status === 'complete') {
              finishSignedIn();
              return;
            }
          } catch (updateErr) {
            console.error('Sign-up update failed:', updateErr);
          }
          alert('Additional information required to finish signing up');
          return;
        }
      } else {
        result = await signIn.attemptFirstFactor({ strategy: 'email_code', code });
      }

      if (result.status === 'complete') {
        track(EVENTS.LOGIN_CODE_VERIFIED, { email_domain: emailDomain(email), sign_up: isSignUp });
        if (!isSignUp && result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }
        finishSignedIn();
      } else {
        alert('Additional verification steps required');
      }
    } catch (err) {
      console.error('Error verifying code:', err);
      const e = asAuthError(err);
      track(EVENTS.LOGIN_CODE_ERROR, { stage: 'verify', email_domain: emailDomain(email), message: (e.message || '').slice(0, 120) });
      if (e.errors && e.errors.length > 0) {
        alert(`Error: ${e.errors[0].message}`);
      } else {
        alert(`Verification failed: ${e.message}`);
      }
    }
  };

  const closeButton = (
    <button type="button" className="close-button" onClick={onClose} aria-label={t('login.closeAria')}>
      <X size={36} color="white" weight="bold" />
    </button>
  );

  const backButton = (
    <button type="button" onClick={handleBack} className="login-back">
      <ArrowLeft size={24} color="white" weight="bold" />
      <span className="login-back-label">{t('login.back')}</span>
    </button>
  );

  const providers = emailFirst
    ? MAINLAND_ORDER.map((strategy) => PROVIDER_BUTTONS.find((p) => p.strategy === strategy)!)
    : PROVIDER_BUTTONS;
  const providerButtons = providers.map(({ strategy, labelKey, image, Icon }) => (
    <button
      key={strategy}
      type="button"
      onClick={() => handleOAuthSignIn(strategy)}
      className="auth-button"
      style={backgroundStyle(image)}
    >
      <span className="auth-button-label">{t(labelKey)}</span>
      <span className="auth-icon">
        <Icon size={44} color="white" weight="fill" />
      </span>
    </button>
  ));
  const emailButton = (
    <button
      type="button"
      onClick={() => {
        track(EVENTS.LOGIN_METHOD_CLICK, { method: 'email', email_first: emailFirst });
        setShowEmailSignIn(true);
      }}
      className="auth-button auth-button--email"
      style={backgroundStyle('/images/Email_Bg.png')}
    >
      <span className="auth-button-label">{t('login.email')}</span>
      <span className="auth-icon auth-icon--email">
        <EnvelopeSimple size={44} color="white" weight="fill" />
      </span>
    </button>
  );

  let step;
  if (!showEmailSignIn && !showVerification) {
    step = (
      <div className="login-step">
        <div className="login-topbar login-topbar--welcome">
          <div className="login-title">{t('login.welcome')}</div>
          {closeButton}
        </div>

        <div className="login-body">
          <div className="login-subtitle">{t('login.continueWith')}</div>

          <div className="login-providers">
            <div className="login-provider-grid">
              {emailFirst && emailButton}
              {providerButtons}
              {!emailFirst && emailButton}
            </div>
            {emailFirst && <p className="login-region-hint">{t('login.mainlandHint')}</p>}

            <div className="login-terms">
              <p className="login-terms-text">{t('login.termsPrefix')}&nbsp;</p>
              <Link href="/privacy-policy" className="login-terms-link" onClick={onClose}>
                {t('login.privacyPolicy')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (showEmailSignIn && !showVerification) {
    step = (
      <div className="login-step">
        <div className="login-step-top">
          <div className="login-topbar">
            {backButton}
            {closeButton}
          </div>
          <p className="login-prompt">{t('login.emailPrompt')}</p>
        </div>

        <form
          className="login-email-form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleEmailConfirm();
          }}
        >
          <div className="login-field login-field--email">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSuggestion(null);
                setUndeliverable(null);
                setKeptAddress(null);
              }}
              placeholder={t('login.emailPlaceholder')}
              autoComplete="email"
              className={`login-email-input${email ? ' is-filled' : ''}`}
            />
          </div>
          <button type="submit" className="login-primary" disabled={checking} aria-busy={checking}>
            <span className="login-primary-label">{t('login.confirm')}</span>
          </button>
        </form>

        {suggestion && (
          <StatusMessage variant="warning" className="login-email-check" title={t('login.typo.title', { email: suggestion })}>
            <span className="login-email-check-actions">
              <button
                type="button"
                className="login-email-check-btn login-email-check-btn--primary"
                onClick={() => {
                  track(EVENTS.LOGIN_EMAIL_CHECK, { action: 'accepted', email_domain: emailDomain(email), suggested_domain: emailDomain(suggestion) });
                  void handleEmailConfirm(suggestion);
                }}
              >
                {t('login.typo.use', { email: suggestion })}
              </button>
              <button
                type="button"
                className="login-email-check-btn"
                onClick={() => {
                  const typed = email.trim();
                  track(EVENTS.LOGIN_EMAIL_CHECK, { action: 'kept', email_domain: emailDomain(typed), suggested_domain: emailDomain(suggestion) });
                  setKeptAddress(typed);
                  setSuggestion(null);
                  void handleEmailConfirm(typed, true);
                }}
              >
                {t('login.typo.keep')}
              </button>
            </span>
          </StatusMessage>
        )}
        {undeliverable && !suggestion && (
          <StatusMessage variant="error" className="login-email-check" title={t('login.noMail.title', { domain: undeliverable })}>
            {t('login.noMail.body')}
          </StatusMessage>
        )}
      </div>
    );
  } else {
    step = (
      <div className="login-step login-step--fixed">
        <div className="login-step-top">
          <div className="login-topbar">
            {backButton}
            {closeButton}
          </div>
          <p className="login-prompt">{t('login.codePrompt')}</p>
          <p className="login-code-hint">{t('login.codeHint', { email })}</p>
        </div>

        <div className="login-code-area">
          <div className="login-code-row">
            {CODE_SLOTS.map((index) => (
              <div key={index} className="login-field login-field--code">
                <input
                  id={`code-input-${index}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={verificationCode[index]}
                  onChange={(e) => handleVerificationCodeChange(index, e.target.value)}
                  onPaste={(e) => handlePasteVerification(e, index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
                      focusCodeInput(index - 1);
                    }
                  }}
                  className={`login-code-input${verificationCode[index] ? ' is-filled' : ''}`}
                />
              </div>
            ))}
          </div>

          <button type="button" onClick={handleVerificationConfirm} className="login-primary login-primary--block">
            <span className="login-primary-label">{t('login.confirm')}</span>
          </button>
        </div>
      </div>
    );
  }

  // Portalled to <body> so no page's stacking context can sit above it.
  return createPortal(
    <div className="login-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="login-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('login.welcome')}
      >
        <div className="login-card">{step}</div>
      </div>
    </div>,
    document.body
  );
};

export default LoginModal;
