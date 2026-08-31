import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useAuthActions, useUser } from '../auth';
import Header from './layout/Header';
import Footer from './layout/Footer';
import SkeletonPanel from './ui/SkeletonPanel';
import StatusMessage from './ui/StatusMessage';
import { useTheme } from '../context/ThemeContext';
import { useLocale, buildLocalePath, stripLocaleFromPath } from '../i18n/locale';
import { BillingButtonStyles } from './AccountBilling';
import {
  fetchAccountSummary,
  fetchBillingPlans,
  fetchCreatorProfile,
  updateCreatorProfile,
  checkUsernameAvailability,
  updateAccountName,
  updateUserEmail,
  uploadAvatar,
  exportAccountData,
  deleteAccount,
} from '../utils/api';
import config from '../config';

const MONO = "'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, monospace";

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
];
const TIER_LABELS = { free: 'Free', lite: 'Lite', pro: 'Pro' };
// Fallbacks used only when the billing catalog can't be fetched. The free plan
// grants no monthly minutes — evaluation happens through the 10-second preview.
const TIER_MINUTES = { free: 0, lite: 120, pro: 300 };
// Must match the backend whitelist (services/profile_common.ALLOWED_LINK_PLATFORMS).
const LINK_PLATFORMS = ['Website', 'YouTube', 'Instagram', 'X', 'SoundCloud', 'TikTok'];
const tierFamily = (t) => (t || 'free').split('_')[0];
const tierLabel = (t) => TIER_LABELS[tierFamily(t)] || 'Free';

const NAV = [
  ['sec-profile', 'Profile'],
  ['sec-public', 'Public profile'],
  ['sec-account', 'Account'],
  ['sec-plan', 'Plan & credits'],
  ['sec-connected', 'Connected'],
  ['sec-prefs', 'Preferences'],
  ['sec-security', 'Security'],
];
const SECTION_IDS = [...NAV.map(([id]) => id), 'sec-signout'];

const initialsFrom = (name, email) => {
  const src = (name || '').trim() || (email || '').split('@')[0] || '';
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return 'U';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const fmtMonthYear = (d) => {
  const dt = d ? new Date(d) : null;
  if (!dt || Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};
const fmtShortDate = (d) => {
  const dt = d ? new Date(d) : null;
  if (!dt || Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Provider glyphs mirror the design (Google letter mark, Apple SVG, Facebook "f").
const PROVIDERS = [
  { key: 'google', name: 'Google', glyph: 'G', glyphBg: '#fff', glyphColor: '#000', glyphFont: 'inherit' },
  { key: 'apple', name: 'Apple', glyph: '', glyphBg: '#000', glyphColor: '#fff', glyphFont: 'inherit' },
  { key: 'facebook', name: 'Facebook', glyph: 'f', glyphBg: '#1877F2', glyphColor: '#fff', glyphFont: 'Georgia, serif' },
];

const Chevron = ({ size = 13, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={style}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const AccountProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locale = useLocale();
  const { getToken } = useAuth();
  const { signOut } = useAuthActions();
  const { user, isSignedIn, isLoaded } = useUser();
  const { isDarkMode, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [planTotalMinutes, setPlanTotalMinutes] = useState(null);
  const [planPrice, setPlanPrice] = useState('');

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ username: '', displayName: '', bio: '', links: [], firstName: '', lastName: '' });
  const [uState, setUState] = useState({ checking: false, ok: null });
  const origRef = useRef(null);

  const [emailDraft, setEmailDraft] = useState('');
  const [namesOverride, setNamesOverride] = useState(null); // saved names until the session token refreshes
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const [activeSec, setActiveSec] = useState('sec-profile');
  const [langOpen, setLangOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const uTimer = useRef(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  const handleAuthError = useCallback(
    (err) => {
      if (err && err.isAuthError) {
        setTimeout(() => navigate('/'), 2000);
        return true;
      }
      return false;
    },
    [navigate]
  );

  // ---- load ----
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const s = await fetchAccountSummary(config.apiBaseUrl, getToken, signOut);
        if (!cancelled) setSummary(s);
      } catch (err) {
        if (!cancelled && !handleAuthError(err)) setLoadError(err.message);
      }
      let p = null;
      try {
        p = await fetchCreatorProfile(config.apiBaseUrl, getToken, signOut);
      } catch {
        p = null;
      }
      if (!cancelled) {
        const fallbackName = user?.name || '';
        setProfile(
          p || {
            username: (user?.email || '').split('@')[0] || 'user',
            display_name: fallbackName,
            bio: '',
            links: [],
            member_since: user?.user_metadata?.created_at || null,
          }
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, signOut, user, handleAuthError]);

  // ---- billing catalog (public) → plan total minutes + monthly price ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const catalog = await fetchBillingPlans(config.apiBaseUrl);
        if (cancelled) return;
        const fam = tierFamily(summary?.subscription?.tier);
        const plan = (catalog?.plans || []).find((p) => tierFamily(p.id) === fam);
        if (plan?.minutes_per_month) setPlanTotalMinutes(plan.minutes_per_month);
        if (fam !== 'free' && plan?.price_monthly_usd) setPlanPrice(`$${plan.price_monthly_usd} / mo`);
        else if (fam === 'free') setPlanPrice('Free plan');
      } catch {
        /* pricing is best-effort — fall back to tier defaults below */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [summary]);

  useEffect(() => {
    if (user?.email && !editing) setEmailDraft(user.email);
  }, [user, editing]);

  // ---- scrollspy ----
  useEffect(() => {
    const onScroll = () => {
      let cur = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 130) cur = id;
      }
      setActiveSec((prev) => (prev === cur ? prev : cur));
    };
    window.addEventListener('scroll', onScroll, true);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [loading]);

  // ---- debounced username availability (edit mode) ----
  useEffect(() => {
    if (!editing) return;
    const u = draft.username.trim();
    if (!u || u === profile?.username) {
      setUState({ checking: false, ok: null });
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
      setUState({ checking: false, ok: false });
      return;
    }
    setUState({ checking: true, ok: null });
    clearTimeout(uTimer.current);
    uTimer.current = setTimeout(async () => {
      try {
        const { available } = await checkUsernameAvailability(config.apiBaseUrl, u, getToken, signOut);
        setUState({ checking: false, ok: available });
      } catch {
        setUState({ checking: false, ok: null }); // endpoint missing — don't block
      }
    }, 500);
    return () => clearTimeout(uTimer.current);
  }, [draft.username, editing, profile, getToken, signOut]);

  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    clearTimeout(uTimer.current);
  }, []);

  const providersSet = useMemo(() => {
    const raw = user?.external_accounts || user?.identities || [];
    return new Set(raw.map((p) => (typeof p === 'string' ? p : p.provider || p.identity_provider)).filter(Boolean));
  }, [user]);

  // ---- derived ----
  const email = user?.email || '';
  const firstName = namesOverride?.first_name ?? user?.first_name ?? '';
  const lastName = namesOverride?.last_name ?? user?.last_name ?? '';
  const displayName = profile?.display_name || user?.name || email.split('@')[0] || 'User';
  const username = profile?.username || email.split('@')[0] || 'user';
  const initials = initialsFrom(displayName, email);
  const subscription = summary?.subscription || {};
  const tier = subscription.tier || 'free';
  const balanceMinutes =
    typeof subscription.balance_minutes === 'number'
      ? subscription.balance_minutes
      : typeof subscription.balance_seconds === 'number'
        ? subscription.balance_seconds / 60
        : 0;
  const minsLeft = Math.round(balanceMinutes);
  const minsTotal = planTotalMinutes || TIER_MINUTES[tierFamily(tier)] || 0;
  // With no monthly allowance (free plan) there is nothing to measure against —
  // any balance came from a top-up pack, so the bar just shows "has minutes".
  const minsPct =
    minsTotal > 0
      ? `${Math.max(0, Math.min(100, (minsLeft / minsTotal) * 100))}%`
      : minsLeft > 0
        ? '100%'
        : '0%';
  const rechargeDate = fmtShortDate(subscription.next_recharge_at) || '—';
  const memberSince = fmtMonthYear(profile?.member_since);
  const emailManaged = providersSet.size > 0 && !providersSet.has('email');
  const readLinks = (profile?.links || [])
    .map((l) => ({ label: l.label || l.platform || '', url: l.url || '' }))
    .filter((l) => l.label || l.url);

  // ---- edit lifecycle ----
  const snapshot = (d) => JSON.stringify(d);
  const startEdit = () => {
    const d = {
      username: profile?.username || '',
      displayName: profile?.display_name || '',
      bio: profile?.bio || '',
      links: (profile?.links || []).map((l) => ({ label: l.label || l.platform || 'Website', url: l.url || '' })),
      firstName,
      lastName,
    };
    origRef.current = snapshot(d);
    setDraft(d);
    setUState({ checking: false, ok: null });
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setUState({ checking: false, ok: null });
  };

  const dirty = editing && origRef.current != null && snapshot(draft) !== origRef.current;
  const blocked = uState.ok === false || uState.checking;
  const canSave = dirty && !blocked;
  const dirtyMsg = !dirty ? 'No changes yet.' : blocked ? 'Resolve the username before saving.' : 'You have unsaved changes.';

  const save = async () => {
    if (!canSave) return;
    const patch = {
      username: draft.username.trim(),
      display_name: draft.displayName.trim(),
      bio: draft.bio,
      links: draft.links.filter((l) => l.label || l.url).map((l) => ({ platform: l.label, url: l.url })),
    };
    try {
      const updated = await updateCreatorProfile(config.apiBaseUrl, patch, getToken, signOut);
      setProfile((prev) => ({ ...prev, ...(updated || patch), links: updated?.links || patch.links }));
    } catch (err) {
      if (handleAuthError(err)) return;
      notify(err.message || 'Saving your profile is not available yet');
      return;
    }
    // Legal name — the session token is stale until refresh, so keep the
    // saved values locally and render them instead of the token's copy.
    if (draft.firstName !== firstName || draft.lastName !== lastName) {
      try {
        await updateAccountName(
          config.apiBaseUrl,
          { first_name: draft.firstName.trim(), last_name: draft.lastName.trim() },
          getToken,
          signOut
        );
        setNamesOverride({ first_name: draft.firstName.trim(), last_name: draft.lastName.trim() });
      } catch (err) {
        if (handleAuthError(err)) return;
        notify('Profile saved, but the name change failed — try again');
        return;
      }
    }
    setEditing(false);
    notify('Profile updated');
  };

  const onUsername = (e) => {
    const v = (e.target.value || '').replace(/[^a-z0-9_]/gi, '').toLowerCase();
    setDraft((d) => ({ ...d, username: v }));
  };
  const addLink = () => setDraft((d) => ({ ...d, links: [...d.links, { label: 'Website', url: '' }] }));
  const removeLink = (i) => setDraft((d) => ({ ...d, links: d.links.filter((_, j) => j !== i) }));
  const setLink = (i, field, v) =>
    setDraft((d) => ({ ...d, links: d.links.map((l, j) => (j === i ? { ...l, [field]: v } : l)) }));

  const [exporting, setExporting] = useState(false);
  const downloadExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await exportAccountData(config.apiBaseUrl, getToken, signOut);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'groovesheet-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (!handleAuthError(err)) notify(err.message || 'Could not export your data');
    } finally {
      setExporting(false);
    }
  };

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarUploading(true);
    try {
      const { avatar_url } = await uploadAvatar(config.apiBaseUrl, file, getToken, signOut);
      setProfile((prev) => ({ ...prev, avatar_url }));
      notify('Profile photo updated');
    } catch (err) {
      if (!handleAuthError(err)) notify(err.message || 'Could not upload photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveEmail = async () => {
    const next = emailDraft.trim();
    if (!next || next === email) return;
    try {
      await updateUserEmail(config.apiBaseUrl, next, getToken, signOut);
      notify('Confirmation email sent');
    } catch (err) {
      if (!handleAuthError(err)) notify(err.message || 'Changing email is not available yet');
    }
  };

  const pickLang = (code) => {
    setLangOpen(false);
    const basePath = stripLocaleFromPath(location.pathname) + location.search;
    navigate(buildLocalePath(code, basePath));
  };
  const currentLangLabel = (LANGS.find((l) => l.code === locale) || LANGS[0]).label;

  const confirmDelete = async () => {
    if (deleteText.trim() !== username) return;
    try {
      await deleteAccount(config.apiBaseUrl, getToken, signOut);
      setDeleteOpen(false);
      await signOut();
      navigate('/');
    } catch (err) {
      if (!handleAuthError(err)) notify(err.message || 'Account deletion is not available yet');
    }
  };

  const doSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // ---- shared styles ----
  const muted = 'var(--color-muted-foreground)';
  const page = { position: 'relative', minHeight: '100vh', background: 'var(--color-background)', fontFamily: 'var(--font-family-sans)', WebkitFontSmoothing: 'antialiased', overflowX: 'hidden' };
  const dots = { position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(circle, var(--color-dot-pattern) 1.5px, transparent 1.5px)', backgroundSize: '43px 43px', opacity: 0.35, pointerEvents: 'none', zIndex: 0 };
  const main = { position: 'relative', zIndex: 1, maxWidth: 1190, margin: '0 auto', padding: '18px 28px 96px' };
  const card = { background: 'var(--color-panel2)', borderRadius: 13, padding: '26px 28px' };
  const h3 = { margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--color-foreground)' };
  const label = { fontSize: 13, fontWeight: 500, color: 'var(--color-text)' };
  const input = { height: 42, padding: '0 13px', background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', borderRadius: 6, color: 'var(--color-text)', fontFamily: 'var(--font-family-sans)', fontSize: 14, outline: 'none' };
  const rowRead = { display: 'grid', gridTemplateColumns: '160px 1fr', gap: 20, padding: '14px 0', borderTop: '1px solid var(--color-border-light)' };

  const styleBlock = `
    .aps-in:focus{border-color:var(--color-primary)!important;}
    .aps-navlink:hover{background:var(--color-surface-light);}
    .aps-icon-btn:hover{background:var(--color-surface-light);color:var(--color-danger);}
    .aps-link:hover{opacity:.72;}
    .aps-ghost:hover{background:var(--color-surface-light);}
    .aps-brighten:hover{filter:brightness(1.12);}
    .aps-langitem:hover{background:var(--color-surface-light);}
    @keyframes apsFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    @keyframes apsSpin{to{transform:rotate(360deg)}}
    @keyframes apsToast{from{opacity:0;transform:translate(-50%,14px)}to{opacity:1;transform:translate(-50%,0)}}
    @media (max-width: 900px){ .aps-grid{grid-template-columns:1fr!important;} .aps-nav{display:none!important;} }
  `;

  // ---- signed-out ----
  if (isLoaded && !isSignedIn) {
    return (
      <div style={page}>
        <BillingButtonStyles />
        <div style={dots} />
        <Header />
        <main style={main}>
          <div style={{ marginTop: 40, maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h1 style={{ fontSize: 34, lineHeight: '42px', letterSpacing: '-.6px', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>Profile &amp; settings</h1>
            <p style={{ fontSize: 15, color: muted, margin: 0 }}>Sign in to manage your identity, plan, and preferences.</p>
            <div><button className="gs-btn gs-btn-primary" onClick={() => navigate('/')}>Go to home</button></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const providerRows = PROVIDERS.map((p) => {
    const connected = providersSet.has(p.key);
    return {
      ...p,
      connected,
      detail: connected ? email : 'Not connected',
      detailMono: connected,
    };
  });
  // Which social provider manages the email (for the managed-email panel glyph).
  const managedProvider = PROVIDERS.find((p) => providersSet.has(p.key)) || null;

  return (
    <div style={page}>
      <BillingButtonStyles />
      <style>{styleBlock}</style>
      <div style={dots} />
      <Header />

      <main style={main}>
        {/* Breadcrumb + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: muted, margin: '0 0 14px', letterSpacing: '.01em' }}>
          <span>Account</span>
          <Chevron style={{ opacity: 0.6 }} />
          <span style={{ color: 'var(--color-foreground)' }}>Profile &amp; settings</span>
        </div>
        <h1 style={{ fontSize: 34, lineHeight: '42px', letterSpacing: '-.6px', margin: '0 0 4px', color: 'var(--color-text)', fontWeight: 500 }}>Profile &amp; settings</h1>
        <p style={{ margin: '0 0 30px', fontSize: 15, color: muted }}>Manage your identity, your public creator page, and how GrooveSheet works for you.</p>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SkeletonPanel count={1} height={148} />
            <SkeletonPanel count={3} height={220} />
          </div>
        )}

        {!loading && loadError && (
          <StatusMessage variant="error" title="Couldn't load your account">{loadError}</StatusMessage>
        )}

        {!loading && !loadError && (
          <div className="aps-grid" style={{ display: 'grid', gridTemplateColumns: '204px 1fr', gap: 40, alignItems: 'start' }}>
            {/* Section nav */}
            <nav className="aps-nav" style={{ position: 'sticky', top: 22, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {NAV.map(([id, txt]) => {
                const active = activeSec === id;
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="aps-navlink"
                    style={{ display: 'flex', alignItems: 'center', height: 34, padding: '0 12px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, textDecoration: 'none', color: active ? '#fff' : muted, background: active ? 'rgba(1,47,167,.18)' : 'transparent', transition: 'background .15s ease,color .15s ease' }}
                  >
                    {txt}
                  </a>
                );
              })}
              <div style={{ height: 1, background: 'var(--color-border-light)', margin: '12px 10px' }} />
              <a href="#sec-signout" className="aps-navlink" style={{ display: 'flex', alignItems: 'center', gap: 10, height: 34, padding: '0 12px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, color: '#ff9b9b', background: activeSec === 'sec-signout' ? 'rgba(255,107,107,.1)' : 'transparent', textDecoration: 'none' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                Sign out
              </a>
            </nav>

            {/* Content column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
              {/* Profile hero */}
              <section id="sec-profile" style={{ scrollMarginTop: 84 }}>
                <div style={{ background: 'var(--color-panel1)', borderRadius: 11, padding: '26px 28px', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    aria-label="Change profile photo"
                    title="Change profile photo"
                    style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', border: 0, padding: 0, cursor: avatarUploading ? 'wait' : 'pointer', background: 'var(--color-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 500, fontFamily: 'inherit', flex: 'none', overflow: 'visible', boxShadow: 'inset 0 1px 1px rgba(255,255,255,.18)' }}
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block', opacity: avatarUploading ? 0.6 : 1 }} />
                    ) : (
                      <span aria-hidden="true">{initials}</span>
                    )}
                    <span aria-hidden="true" style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: '50%', background: 'var(--color-panel1)', border: '1px solid var(--color-border-lighter)', color: 'var(--color-foreground)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                    </span>
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarPick} style={{ display: 'none' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 500, color: 'var(--color-text)', letterSpacing: '-.3px' }}>{displayName}</h2>
                      <span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', background: 'var(--color-primary)', color: '#fff' }}>{tierLabel(tier)}</span>
                    </div>
                    <p style={{ margin: '7px 0 0', fontSize: 14, color: muted }}>{email}{memberSince ? ` · Member since ${memberSince}` : ''}</p>
                    <a href={`/u/${username}`} className="aps-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 11, fontSize: 13.5, fontWeight: 500, color: 'var(--color-foreground)', textDecoration: 'none', transition: 'opacity .2s ease' }}>
                      View public profile
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
                    </a>
                  </div>
                  {editing ? (
                    <span style={{ flex: 'none', fontSize: 12, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#93b4ff', padding: '6px 12px', borderRadius: 120, background: 'rgba(1,47,167,.18)' }}>Editing</span>
                  ) : (
                    <button onClick={startEdit} className="aps-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', border: '1px solid var(--color-border-lighter)', borderRadius: 6, background: 'transparent', color: 'var(--color-foreground)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer', flex: 'none' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
                      Edit profile
                    </button>
                  )}
                </div>
              </section>

              {/* Public creator profile */}
              <section id="sec-public" style={{ scrollMarginTop: 84, ...card, animation: 'apsFadeUp .3s ease both' }}>
                <h3 style={{ ...h3, marginBottom: 22 }}>Public creator profile</h3>
                {!editing ? (
                  <div>
                    <div style={rowRead}>
                      <span style={{ fontSize: 13, color: muted }}>Profile URL</span>
                      <span style={{ fontSize: 14, fontFamily: MONO }}>
                        <span style={{ color: muted }}>groovesheet.net/u/</span>
                        <span style={{ color: 'var(--color-text)' }}>{username}</span>
                      </span>
                    </div>
                    <div style={rowRead}>
                      <span style={{ fontSize: 13, color: muted }}>Display name</span>
                      <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{displayName}</span>
                    </div>
                    <div style={rowRead}>
                      <span style={{ fontSize: 13, color: muted }}>Bio</span>
                      <span style={{ fontSize: 14, color: 'var(--color-text)', lineHeight: 1.55 }}>{profile?.bio || 'No bio yet.'}</span>
                    </div>
                    <div style={rowRead}>
                      <span style={{ fontSize: 13, color: muted }}>Links</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {readLinks.length === 0 && <span style={{ fontSize: 13, color: muted, opacity: 0.75 }}>None added</span>}
                        {readLinks.map((l, i) => (
                          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 6, background: 'var(--color-surface-light)', fontSize: 13, color: 'var(--color-text)' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                            <span style={{ fontWeight: 500 }}>{l.label || 'Link'}</span>
                            <span style={{ color: muted, fontFamily: MONO, fontSize: 12 }}>{l.url}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Username */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 460 }}>
                      <label style={label}>Username</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', height: 42, background: 'var(--color-input-bg)', border: `1px solid ${uState.ok === true ? 'var(--color-success)' : uState.ok === false ? 'var(--color-danger)' : 'var(--color-input-border)'}`, borderRadius: 6, overflow: 'hidden', transition: 'border-color .15s ease' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 4px 0 12px', color: muted, fontSize: 14, fontFamily: MONO }}>@</span>
                        <input value={draft.username} onChange={onUsername} spellCheck="false" autoComplete="off" aria-label="Username" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--color-text)', fontFamily: MONO, fontSize: 14, padding: '0 6px' }} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 12px' }}>
                          {uState.checking && <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(140,140,140,.35)', borderTopColor: 'var(--color-text)', display: 'inline-block', animation: 'apsSpin .7s linear infinite' }} />}
                          {!uState.checking && uState.ok === true && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                          {!uState.checking && uState.ok === false && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2.6" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                        </span>
                      </div>
                      <span aria-live="polite" style={{ fontSize: 12, color: uState.ok === true ? 'var(--color-success)' : uState.ok === false ? 'var(--color-danger)' : muted }}>
                        {uState.checking
                          ? 'Checking availability…'
                          : uState.ok === true
                            ? 'That username is available — changing it updates your /u/ URL.'
                            : uState.ok === false
                              ? 'That username is unavailable. Use 3–20 letters, numbers, or underscores.'
                              : 'Letters, numbers and underscores. 3–20 characters.'}
                      </span>
                    </div>
                    {/* Display name */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 460 }}>
                      <label style={label}>Display name</label>
                      <input className="aps-in" value={draft.displayName} onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))} style={input} />
                    </div>
                    {/* Bio */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 }}>
                      <label style={label}>Bio</label>
                      <textarea className="aps-in" value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value.slice(0, 240) }))} maxLength={240} style={{ minHeight: 88, padding: '11px 13px', background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', borderRadius: 6, color: 'var(--color-text)', fontFamily: 'var(--font-family-sans)', fontSize: 14, lineHeight: 1.5, outline: 'none', resize: 'vertical' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: muted }}>
                        <span>Shown publicly on your creator page.</span>
                        <span style={{ fontFamily: MONO, fontSize: 11 }}>{draft.bio.length} / 240</span>
                      </div>
                    </div>
                    {/* Links */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}>
                      <label style={label}>External links</label>
                      {draft.links.map((l, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <select className="aps-in" value={LINK_PLATFORMS.includes(l.label) ? l.label : 'Website'} onChange={(e) => setLink(i, 'label', e.target.value)} aria-label="Link platform" style={{ ...input, width: 130, cursor: 'pointer' }}>
                            {LINK_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <input className="aps-in" value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} placeholder="https://" style={{ ...input, flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 13 }} />
                          <button onClick={() => removeLink(i)} aria-label="Remove link" className="aps-icon-btn" style={{ width: 40, height: 40, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, borderRadius: 6, color: muted, cursor: 'pointer' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        </div>
                      ))}
                      <button onClick={addLink} className="aps-brighten" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', background: 'var(--color-surface-light)', border: 0, borderRadius: 6, color: 'var(--color-foreground)', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Add link
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Account details */}
              <section id="sec-account" style={{ scrollMarginTop: 84, ...card }}>
                <h3 style={{ ...h3, marginBottom: 22 }}>Account details</h3>
                {!editing ? (
                  <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', borderTop: '1px solid var(--color-border-light)', padding: '14px 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 180 }}>
                      <span style={{ fontSize: 13, color: muted }}>First name</span>
                      <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{firstName || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 180 }}>
                      <span style={{ fontSize: 13, color: muted }}>Last name</span>
                      <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{lastName || '—'}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200 }}>
                      <label style={label}>First name</label>
                      <input className="aps-in" value={draft.firstName} onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))} style={input} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200 }}>
                      <label style={label}>Last name</label>
                      <input className="aps-in" value={draft.lastName} onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))} style={input} />
                    </div>
                  </div>
                )}
              </section>

              {/* Sticky edit action bar */}
              {editing && (
                <div style={{ position: 'sticky', bottom: 18, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: 'var(--color-panel1)', borderRadius: 12, padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,0,0,.37)', animation: 'apsFadeUp .25s ease both', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: muted }}>{dirtyMsg}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancel} className="aps-ghost" style={{ padding: '10px 18px', border: '1px solid var(--color-border-lighter)', borderRadius: 6, background: 'transparent', color: 'var(--color-foreground)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={save} disabled={!canSave} style={{ padding: '10px 20px', border: 0, borderRadius: 6, background: 'var(--color-primary)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: canSave ? 'pointer' : 'not-allowed', boxShadow: '0 8px 24px var(--color-primary-shadow)', opacity: canSave ? 1 : 0.5 }}>Save changes</button>
                  </div>
                </div>
              )}

              {/* Plan & credits */}
              <section id="sec-plan" style={{ scrollMarginTop: 84, ...card }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
                  <h3 style={h3}>Plan &amp; credits</h3>
                  <button onClick={() => navigate('/account/billing')} className="aps-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 500, color: 'var(--color-foreground)', background: 'transparent', border: 0, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none', fontFamily: 'inherit' }}>
                    Manage in Billing
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
                  <div style={{ background: 'var(--color-panel1)', borderRadius: 13, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 12, color: muted }}>Current plan</span>
                    <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--color-text)' }}>{tierLabel(tier)}</span>
                    <span style={{ fontSize: 12.5, color: muted }}>{planPrice || '—'}</span>
                  </div>
                  <div style={{ background: 'var(--color-panel1)', borderRadius: 13, padding: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
                    <span style={{ fontSize: 12, color: muted }}>Minutes remaining</span>
                    <span style={{ fontSize: 40, fontWeight: 300, lineHeight: 1, letterSpacing: '-1px', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {minsLeft}
                      {minsTotal > 0 && <span style={{ fontSize: 14, fontWeight: 400, color: muted, letterSpacing: 0, marginLeft: 5 }}>/ {minsTotal} min</span>}
                    </span>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(140,140,140,.18)', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: minsPct, background: 'linear-gradient(90deg,#012FA7,#0139C7)', borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-panel1)', borderRadius: 13, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 12, color: muted }}>{minsTotal > 0 ? 'Next recharge' : 'Monthly minutes'}</span>
                    <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--color-text)' }}>{minsTotal > 0 ? rechargeDate : 'None'}</span>
                    <span style={{ fontSize: 12.5, color: muted }}>
                      {minsTotal > 0
                        ? `Resets to ${minsTotal} min`
                        : 'Top up or upgrade to process full songs'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Connected accounts */}
              <section id="sec-connected" style={{ scrollMarginTop: 84, ...card }}>
                <h3 style={{ ...h3, marginBottom: 20 }}>Connected accounts</h3>
                <div style={{ background: 'var(--color-panel1)', borderRadius: 13, overflow: 'hidden' }}>
                  {providerRows.map((p, idx) => (
                    <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderTop: idx ? '1px solid var(--color-border-light)' : 'none' }}>
                      <span style={{ width: 36, height: 36, borderRadius: 9, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: p.key === 'facebook' ? 16 : 15, fontFamily: p.glyphFont, background: p.glyphBg, color: p.glyphColor }}>
                        {p.key === 'apple' ? (
                          <svg width="17" height="17" viewBox="0 0 256 256" fill="#fff"><path d="M223.3 169.59a8.07 8.07 0 0 0-2.8-3.4C203.53 154.53 200 134.64 200 120c0-17.67 13.47-33.06 21.5-40.6a8 8 0 0 0 0-11.6C208.82 55.4 187.82 48 168 48a72.2 72.2 0 0 0-40 12.13A71.56 71.56 0 0 0 88 48a72.08 72.08 0 0 0-72 72c0 50.55 30.31 100.43 56 116.46a32 32 0 0 0 35.84-1.43 16 16 0 0 1 18.3 0A32 32 0 0 0 144 240a32.34 32.34 0 0 0 16.16-4.54C175 226.93 196.83 207 211.69 178a8 8 0 0 0 0-3.41ZM168 32a8 8 0 0 0 8-8 24 24 0 0 1 24-24 8 8 0 0 0 0-16 40 40 0 0 0-40 40 8 8 0 0 0 8 8Z" /></svg>
                        ) : p.glyph}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{p.name}</div>
                        <div style={{ fontSize: 12.5, color: muted, fontFamily: p.detailMono ? MONO : 'var(--font-family-sans)' }}>{p.detail}</div>
                      </div>
                      {/* Read-only until identity linking ships (Supabase linkIdentity). */}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 500, border: '1px solid var(--color-border-light)', color: p.connected ? 'var(--color-success)' : muted, background: 'transparent', whiteSpace: 'nowrap' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', opacity: p.connected ? 1 : 0.45 }} />
                        {p.connected ? 'Connected' : 'Not connected'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Preferences */}
              <section id="sec-prefs" style={{ scrollMarginTop: 84, ...card }}>
                <h3 style={{ ...h3, marginBottom: 22 }}>Preferences</h3>
                {/* Theme */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '16px 0', borderTop: '1px solid var(--color-border-light)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>Theme</div>
                    <div style={{ fontSize: 12.5, color: muted, marginTop: 2 }}>Switch between the dark studio canvas and a light surface.</div>
                  </div>
                  <div role="radiogroup" aria-label="Theme" style={{ display: 'inline-flex', padding: 4, borderRadius: 8, background: 'var(--color-surface-light)', gap: 2, flex: 'none' }}>
                    <button role="radio" aria-checked={isDarkMode} onClick={() => { if (!isDarkMode) toggleTheme(); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 14px', border: 0, borderRadius: 6, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: isDarkMode ? 'var(--color-primary)' : 'transparent', color: isDarkMode ? '#fff' : muted }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>Dark
                    </button>
                    <button role="radio" aria-checked={!isDarkMode} onClick={() => { if (isDarkMode) toggleTheme(); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 14px', border: 0, borderRadius: 6, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: !isDarkMode ? 'var(--color-primary)' : 'transparent', color: !isDarkMode ? '#fff' : muted }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>Light
                    </button>
                  </div>
                </div>
                {/* Language */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '16px 0', borderTop: '1px solid var(--color-border-light)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>Language</div>
                    <div style={{ fontSize: 12.5, color: muted, marginTop: 2 }}>Interface language for menus and notifications.</div>
                  </div>
                  <div style={{ position: 'relative', width: 200, flex: 'none' }}>
                    <button onClick={() => setLangOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={langOpen} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 40, padding: '0 14px', background: 'var(--color-input-bg)', border: `1px solid ${langOpen ? 'var(--color-primary)' : 'var(--color-input-border)'}`, borderRadius: 6, color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>
                      <span>{currentLangLabel}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ color: muted }}><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    {langOpen && (
                      <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--color-panel1)', borderRadius: 8, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,.37)', zIndex: 30 }}>
                        {LANGS.map((lg) => {
                          const sel = lg.code === locale;
                          return (
                            <div key={lg.code} role="option" aria-selected={sel} onClick={() => pickLang(lg.code)} className="aps-langitem" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', fontSize: 14, color: sel ? '#93b4ff' : 'var(--color-text)', borderRadius: 5, cursor: 'pointer' }}>
                              {lg.label}
                              {sel && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93b4ff" strokeWidth="2.6"><polyline points="20 6 9 17 4 12" /></svg>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Security */}
              <section id="sec-security" style={{ scrollMarginTop: 84, ...card }}>
                <h3 style={{ ...h3, marginBottom: 20 }}>Security</h3>
                {/* Email */}
                <div style={{ padding: '16px 0', borderTop: '1px solid var(--color-border-light)' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)', marginBottom: 10 }}>Email address</div>
                  {!emailManaged ? (
                    <>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input className="aps-in" type="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} aria-label="Email address" style={{ ...input, flex: 1, minWidth: 240 }} />
                        <button onClick={saveEmail} disabled={!emailDraft.trim() || emailDraft.trim() === email} className="aps-ghost" style={{ padding: '11px 18px', border: '1px solid var(--color-border-lighter)', borderRadius: 6, background: 'transparent', color: 'var(--color-foreground)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer', opacity: !emailDraft.trim() || emailDraft.trim() === email ? 0.5 : 1 }}>Update email</button>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: muted }}>We'll send a confirmation link to the new address before it takes effect.</p>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: 'var(--color-panel3)', borderRadius: 8 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 8, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: managedProvider?.glyphFont || 'inherit', background: managedProvider?.glyphBg || '#fff', color: managedProvider?.glyphColor || '#000' }}>
                        {managedProvider?.key === 'apple' ? (
                          <svg width="15" height="15" viewBox="0 0 256 256" fill="#fff"><path d="M223.3 169.59a8.07 8.07 0 0 0-2.8-3.4C203.53 154.53 200 134.64 200 120c0-17.67 13.47-33.06 21.5-40.6a8 8 0 0 0 0-11.6C208.82 55.4 187.82 48 168 48a72.2 72.2 0 0 0-40 12.13A71.56 71.56 0 0 0 88 48a72.08 72.08 0 0 0-72 72c0 50.55 30.31 100.43 56 116.46a32 32 0 0 0 35.84-1.43 16 16 0 0 1 18.3 0A32 32 0 0 0 144 240a32.34 32.34 0 0 0 16.16-4.54C175 226.93 196.83 207 211.69 178a8 8 0 0 0 0-3.41ZM168 32a8 8 0 0 0 8-8 24 24 0 0 1 24-24 8 8 0 0 0 0-16 40 40 0 0 0-40 40 8 8 0 0 0 8 8Z" /></svg>
                        ) : (managedProvider?.glyph || 'G')}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: 'var(--color-text)' }}>{email}</div>
                        <div style={{ fontSize: 12.5, color: muted }}>Managed by your sign-in provider — change your email there.</div>
                      </div>
                    </div>
                  )}
                </div>
                {/* Data export — portability pair to account deletion */}
                <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '16px 0', borderTop: '1px solid var(--color-border-light)', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>Download your data</div>
                    <div style={{ fontSize: 12.5, color: muted, marginTop: 2 }}>A JSON export of your profile, usage history, and library metadata.</div>
                  </div>
                  <button
                    onClick={downloadExport}
                    disabled={exporting}
                    className="aps-ghost"
                    style={{ padding: '10px 18px', border: '1px solid var(--color-border-lighter)', borderRadius: 6, background: 'transparent', color: 'var(--color-foreground)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: exporting ? 'wait' : 'pointer', flex: 'none' }}
                  >
                    {exporting ? 'Preparing…' : 'Export Data'}
                  </button>
                </div>
                {/* Danger zone */}
                <div style={{ marginTop: 18, background: 'var(--color-panel3)', borderRadius: 12, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#ff6b6b' }}>Delete account</span>
                    </div>
                    <p style={{ margin: '7px 0 0', fontSize: 13, color: muted, maxWidth: 560, lineHeight: 1.5 }}>Permanently remove your account, public profile, and all transcriptions. This cannot be undone.</p>
                  </div>
                  <button onClick={() => { setDeleteText(''); setDeleteOpen(true); }} className="aps-brighten" style={{ padding: '11px 18px', border: 0, borderRadius: 6, background: '#ff6b6b', color: '#1b191c', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', flex: 'none' }}>Delete account</button>
                </div>
              </section>

              {/* Sign out */}
              <section id="sec-signout" style={{ scrollMarginTop: 84, ...card }}>
                <h3 style={{ ...h3, marginBottom: 18 }}>Sign out</h3>
                <button onClick={doSignOut} className="aps-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', border: '1px solid var(--color-border-lighter)', borderRadius: 6, background: 'transparent', color: 'var(--color-foreground)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  Sign out
                </button>
              </section>
            </div>
          </div>
        )}
      </main>

      <Footer />

      {/* Delete modal */}
      {deleteOpen && (
        <div role="dialog" aria-modal="true" aria-label="Delete account confirmation" style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'apsFadeUp .18s ease both' }}>
          <div style={{ position: 'relative', width: 420, maxWidth: '100%', background: 'var(--color-panel1)', borderRadius: 13, padding: 26, boxShadow: '0 24px 64px rgba(0,0,0,.6)' }}>
            <button onClick={() => setDeleteOpen(false)} aria-label="Close" className="aps-ghost" style={{ position: 'absolute', top: 13, right: 13, width: 28, height: 28, borderRadius: '50%', background: 'transparent', border: 0, color: muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <h4 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 500, color: 'var(--color-text)' }}>Delete your account?</h4>
            <p style={{ margin: '0 0 18px', fontSize: 13.5, color: muted, lineHeight: 1.55 }}>
              This permanently deletes <strong style={{ color: 'var(--color-text)' }}>@{username}</strong>, your public creator page, and every transcription. It cannot be restored.
            </p>
            <label style={{ fontSize: 12.5, color: muted, display: 'block', marginBottom: 7 }}>
              Type <span style={{ fontFamily: MONO, color: 'var(--color-text)' }}>{username}</span> to confirm
            </label>
            <input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder={username} spellCheck="false" autoComplete="off" autoFocus aria-label="Type your username to confirm" style={{ width: '100%', height: 42, padding: '0 13px', background: 'var(--color-input-bg)', border: `1px solid ${deleteText && deleteText.trim() !== username ? '#ff6b6b' : 'var(--color-input-border)'}`, borderRadius: 6, color: 'var(--color-text)', fontFamily: MONO, fontSize: 14, outline: 'none', marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteOpen(false)} className="aps-ghost" style={{ padding: '10px 18px', border: '1px solid var(--color-border-lighter)', borderRadius: 6, background: 'transparent', color: 'var(--color-foreground)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleteText.trim() !== username} style={{ padding: '10px 18px', border: 0, borderRadius: 6, background: '#ff6b6b', color: '#1b191c', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: deleteText.trim() === username ? 'pointer' : 'not-allowed', opacity: deleteText.trim() === username ? 1 : 0.5 }}>Delete account</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 3000, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-panel1)', color: 'var(--color-text)', padding: '12px 18px', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.45)', fontSize: 14, fontWeight: 500, animation: 'apsToast .22s ease both' }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#22c55e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0b2417" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
          {toast}
        </div>
      )}
    </div>
  );
};

export default AccountProfile;
