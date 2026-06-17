import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { useAuth, useClerk, useUser } from '../auth';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Button from './ui/Button';
import { useLocalizedNavigate } from '../i18n/locale';
import {
  fetchAccountSummary,
  fetchAccountUsageHistory,
  createBillingPortalSession,
} from '../utils/api';
import config from '../config';
import './AccountBilling.css';

const PAGE_SIZE = 20;

// Map a backend tier id -> a friendly display name.
const TIER_LABELS = {
  free: 'Free',
  lite_monthly: 'Lite (Monthly)',
  lite_annual: 'Lite (Annual)',
  pro_monthly: 'Pro (Monthly)',
  pro_annual: 'Pro (Annual)',
};

const tierLabel = (tier) => TIER_LABELS[tier] || 'Free';

// Humanize a transaction_type like "monthly_grant" -> "Monthly grant".
const humanizeType = (type) => {
  if (!type) return '—';
  const spaced = String(type).replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// Format an ISO timestamp into a readable date (mirrors TranscriptionHistory).
const formatDate = (isoString) => {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Render a minutes delta with sign + unit, e.g. "+120 min" / "-3.5 min".
const formatMinutes = (minutes) => {
  if (minutes == null) return '—';
  const rounded = Math.round(minutes * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded} min`;
};

export const AccountBilling = () => {
  const navigate = useNavigate();
  const localizedNavigate = useLocalizedNavigate();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const { isSignedIn, isLoaded } = useUser();

  // Current plan + minutes-remaining summary.
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);

  // Usage history (paginated).
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState(null);

  // Manage-subscription (Stripe portal) state.
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState(null);

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

  // Load the account summary once we know the user is signed in.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    const loadSummary = async () => {
      try {
        setSummaryLoading(true);
        const data = await fetchAccountSummary(config.apiBaseUrl, getToken, signOut);
        if (!cancelled) {
          setSummary(data);
          setSummaryError(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching account summary:', err);
        if (handleAuthError(err)) {
          setSummaryError('Your session has expired. You have been logged out.');
        } else {
          setSummaryError(err.message);
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, signOut, handleAuthError]);

  // Load (and reload on page change) the usage-history table.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    const loadUsage = async () => {
      try {
        setUsageLoading(true);
        const data = await fetchAccountUsageHistory(
          config.apiBaseUrl,
          getToken,
          { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
          signOut
        );
        if (!cancelled) {
          setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
          setTotal(typeof data?.total === 'number' ? data.total : 0);
          setUsageError(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching usage history:', err);
        if (handleAuthError(err)) {
          setUsageError('Your session has expired. You have been logged out.');
        } else {
          setUsageError(err.message);
        }
        setTransactions([]);
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    };

    loadUsage();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, signOut, page, handleAuthError]);

  const handleManageSubscription = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const { url } = await createBillingPortalSession(config.apiBaseUrl, getToken, signOut);
      if (url) {
        window.location.assign(url);
      } else {
        setPortalError("We couldn't open the billing portal. Please try again.");
      }
    } catch (err) {
      console.error('Error opening billing portal:', err);
      if (!handleAuthError(err)) {
        setPortalError("We couldn't open the billing portal. Please try again.");
      }
    } finally {
      setPortalLoading(false);
    }
  };

  const handleBack = () => navigate('/');

  const subscription = summary?.subscription || {};
  const tier = subscription.tier || 'free';
  const isPaid = tier !== 'free';
  const balanceMinutes =
    typeof subscription.balance_minutes === 'number'
      ? subscription.balance_minutes
      : typeof subscription.balance_seconds === 'number'
        ? subscription.balance_seconds / 60
        : null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = page + 1;
  const canPrev = page > 0;
  const canNext = (page + 1) * PAGE_SIZE < total;

  // Auth gate: signed-out users get a prompt instead of the dashboard.
  if (isLoaded && !isSignedIn) {
    return (
      <div className="billing-page">
        <Header />
        <div className="billing-container">
          <div className="billing-content">
            <button className="back-button" onClick={handleBack}>
              <ArrowLeft size={35} weight="regular" />
              <span>Back</span>
            </button>
            <div className="billing-signed-out">
              <h1 className="billing-title">Billing &amp; Usage</h1>
              <p>Please sign in to view your plan, minutes, and usage history.</p>
              <Button variant="primary" size="medium" onClick={handleBack}>
                Go to Home
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="billing-page">
      <Header />

      <div className="billing-container">
        <div className="billing-content">
          {/* Back button */}
          <button className="back-button" onClick={handleBack}>
            <ArrowLeft size={35} weight="regular" />
            <span>Back</span>
          </button>

          <div className="billing-main">
            {/* Header section */}
            <div className="billing-header">
              <div className="billing-title-section">
                <h1 className="billing-title">Billing &amp; Usage</h1>
              </div>
              <div className="billing-info">
                <p>Manage your plan, track minutes, and review your usage history.</p>
              </div>
            </div>

            {/* Plan + minutes summary */}
            <div className="billing-summary">
              {summaryLoading && (
                <div className="billing-card billing-card--span">
                  <p className="billing-muted">Loading your plan…</p>
                </div>
              )}

              {!summaryLoading && summaryError && (
                <div className="billing-card billing-card--span">
                  <p className="billing-error">Error: {summaryError}</p>
                </div>
              )}

              {!summaryLoading && !summaryError && (
                <>
                  {/* Current plan */}
                  <div className="billing-card">
                    <span className="billing-card-label">Current plan</span>
                    <span className="billing-card-value">{tierLabel(tier)}</span>
                    <div className="billing-card-meta">
                      <span
                        className={`billing-status ${
                          subscription.is_active ? 'is-active' : 'is-inactive'
                        }`}
                      >
                        {subscription.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {subscription.next_recharge_at && (
                        <span className="billing-muted">
                          Renews {formatDate(subscription.next_recharge_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Minutes remaining */}
                  <div className="billing-card">
                    <span className="billing-card-label">Minutes remaining</span>
                    <span className="billing-card-value billing-card-value--big">
                      {balanceMinutes != null ? Math.round(balanceMinutes) : '—'}
                    </span>
                    <span className="billing-muted">minutes remaining</span>
                  </div>

                  {/* Actions */}
                  <div className="billing-card billing-card--actions">
                    <span className="billing-card-label">Plan actions</span>
                    <div className="billing-actions">
                      {isPaid && (
                        <Button
                          variant="primary"
                          size="medium"
                          onClick={handleManageSubscription}
                          disabled={portalLoading}
                        >
                          {portalLoading ? 'Opening…' : 'Manage Subscription'}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="medium"
                        onClick={() => localizedNavigate('/pricing')}
                      >
                        {isPaid ? 'Buy More Minutes' : 'Upgrade Plan'}
                      </Button>
                    </div>
                    {portalError && <p className="billing-error">{portalError}</p>}
                  </div>
                </>
              )}
            </div>

            {/* Usage history */}
            <div className="billing-section">
              <div className="billing-section-header">
                <h2 className="section-title">Usage History</h2>
                {!usageLoading && !usageError && total > 0 && (
                  <span className="billing-muted">
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>

              {usageLoading && <p className="billing-muted">Loading usage…</p>}

              {!usageLoading && usageError && <p className="billing-error">Error: {usageError}</p>}

              {!usageLoading && !usageError && transactions.length === 0 && (
                <p className="billing-muted">No usage yet</p>
              )}

              {!usageLoading && !usageError && transactions.length > 0 && (
                <>
                  <div className="billing-table-wrap">
                    <table className="billing-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Type</th>
                          <th className="billing-col-right">Minutes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => {
                          const minutes = tx.amount_minutes;
                          const isSpend = typeof minutes === 'number' && minutes < 0;
                          return (
                            <tr key={tx.id}>
                              <td>{formatDate(tx.created_at)}</td>
                              <td>{tx.description || '—'}</td>
                              <td>{humanizeType(tx.transaction_type)}</td>
                              <td
                                className={`billing-col-right billing-minutes ${
                                  isSpend ? 'is-spend' : 'is-grant'
                                }`}
                              >
                                {formatMinutes(minutes)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="billing-pagination">
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={!canPrev}
                    >
                      Previous
                    </Button>
                    <span className="billing-muted">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!canNext}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AccountBilling;
