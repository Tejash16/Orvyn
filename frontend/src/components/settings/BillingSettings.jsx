import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchBillingStatus,
  upgradePlan,
  cancelSubscription,
  setBillingStatus,
} from '../../store/billingSlice';
import styles from './BillingSettings.module.css';

const PLAN_FEATURES = {
  free: [
    '3 DataRooms',
    '500 files per month',
    '25 Copilot messages per day',
  ],
  pro: [
    'Unlimited DataRooms',
    '5,000 files per month',
    'Unlimited Copilot messages',
    'Priority support',
  ],
  enterprise: [
    'Unlimited DataRooms',
    '10,000 files per month',
    'Unlimited Copilot messages',
    'Team collaboration',
    'Priority support',
  ],
};

function BillingSettings() {
  const dispatch = useDispatch();
  const { plan, status, currentPeriodEnd, isLoading, error } = useSelector((s) => s.billing);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Fetch billing status on mount
  useEffect(() => {
    dispatch(fetchBillingStatus());
  }, [dispatch]);

  // Listen for push events from Electron's periodic subscription check
  useEffect(() => {
    const cleanup = window.api.billing.onStatusUpdate((data) => {
      dispatch(setBillingStatus({
        plan: data.plan || 'free',
        status: data.status || 'active',
        currentPeriodEnd: data.currentPeriodEnd || null,
        organizationId: data.organizationId || null,
      }));
    });
    return cleanup;
  }, [dispatch]);

  function handleUpgrade() {
    dispatch(upgradePlan({ plan: 'pro' }));
  }

  function handleCancel() {
    dispatch(cancelSubscription());
    setShowCancelConfirm(false);
  }

  function getPlanLabel(p) {
    if (p === 'pro') return 'Pro';
    if (p === 'enterprise') return 'Enterprise';
    return 'Free';
  }

  function getStatusBadge() {
    if (plan === 'free') return <span className={`${styles.planBadge} ${styles.badgeFree}`}>Free</span>;
    if (status === 'active') return <span className={`${styles.planBadge} ${styles.badgeActive}`}>Active</span>;
    if (status === 'trialing') return <span className={`${styles.planBadge} ${styles.badgeTrialing}`}>Trialing</span>;
    if (status === 'past_due') return <span className={`${styles.planBadge} ${styles.badgePastDue}`}>Past Due</span>;
    if (status === 'cancelled') return <span className={`${styles.planBadge} ${styles.badgeCancelled}`}>Cancelled</span>;
    return <span className={`${styles.planBadge} ${styles.badgeFree}`}>{status}</span>;
  }

  function getPlanIconWrapper() {
    if (plan === 'pro') return `${styles.planIconWrapper} ${styles.planIconWrapperPro}`;
    if (plan === 'enterprise') return `${styles.planIconWrapper} ${styles.planIconWrapperEnterprise}`;
    return styles.planIconWrapper;
  }

  function formatPeriodEnd() {
    if (!currentPeriodEnd) return null;
    const date = new Date(currentPeriodEnd);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const isPaid = plan === 'pro' || plan === 'enterprise';
  const canCancel = isPaid && (status === 'active' || status === 'trialing');
  const canUpgrade = plan === 'free';

  return (
    <div className={styles.billingSection}>
      <div className={styles.sectionHeader}>
        <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        <h2 className={styles.sectionTitle}>Billing & Plan</h2>
      </div>

      {isLoading && !plan ? (
        <div className={styles.skeleton} />
      ) : (
        <div className={styles.planCard}>
          {/* ── Plan header ──────────────────────────── */}
          <div className={styles.planHeader}>
            <div className={styles.planInfo}>
              <div className={getPlanIconWrapper()}>
                {plan === 'enterprise' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ) : plan === 'pro' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
              <div>
                <p className={styles.planName}>Orvyn {getPlanLabel(plan)}</p>
                <p className={styles.planSubtitle}>
                  {isPaid ? 'Paid subscription' : 'Get started with the basics'}
                </p>
              </div>
            </div>
            {getStatusBadge()}
          </div>

          {/* ── Plan features ───────────────────────── */}
          <div className={styles.planDetails}>
            {(PLAN_FEATURES[plan] || PLAN_FEATURES.free).map((feature, i) => (
              <div key={i} className={styles.planDetailRow}>
                <svg className={styles.planDetailIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* ── Billing period ──────────────────────── */}
          {isPaid && currentPeriodEnd && (
            <div className={styles.billingPeriod}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>
                {status === 'cancelled'
                  ? `Access until ${formatPeriodEnd()}`
                  : `Next billing: ${formatPeriodEnd()}`
                }
              </span>
            </div>
          )}

          {/* ── Error ───────────────────────────────── */}
          {error && <p className={styles.errorText}>{error}</p>}

          {/* ── Actions ─────────────────────────────── */}
          <div className={styles.planActions}>
            {canUpgrade && (
              <button
                className={styles.btnUpgrade}
                onClick={handleUpgrade}
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {isLoading ? 'Processing…' : 'Upgrade to Pro'}
              </button>
            )}

            {canCancel && !showCancelConfirm && (
              <button
                className={styles.btnCancel}
                onClick={() => setShowCancelConfirm(true)}
                disabled={isLoading}
              >
                Cancel subscription
              </button>
            )}
          </div>

          {/* ── Cancel confirmation ─────────────────── */}
          {showCancelConfirm && (
            <div className={styles.cancelConfirm}>
              <p className={styles.cancelConfirmText}>
                Are you sure? Your access continues until the end of the billing period.
              </p>
              <button
                className={styles.btnConfirmKeep}
                onClick={() => setShowCancelConfirm(false)}
                disabled={isLoading}
              >
                Keep plan
              </button>
              <button
                className={styles.btnConfirmCancel}
                onClick={handleCancel}
                disabled={isLoading}
              >
                {isLoading ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          )}

          {/* ── Loading indicator for status checks ── */}
          {isLoading && plan && (
            <p className={styles.loadingText}>Checking subscription status…</p>
          )}
        </div>
      )}
    </div>
  );
}

export default BillingSettings;
