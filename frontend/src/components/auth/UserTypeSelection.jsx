import { useState } from 'react';
import styles from './auth.module.css';

const UserIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <line x1="8" y1="6" x2="8" y2="6" />
    <line x1="12" y1="6" x2="12" y2="6" />
    <line x1="16" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="8" y2="10" />
    <line x1="12" y1="10" x2="12" y2="10" />
    <line x1="16" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="8" y2="14" />
    <line x1="12" y1="14" x2="12" y2="14" />
    <line x1="16" y1="14" x2="16" y2="14" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * UserTypeSelection — shown once after initial signup/Google sign-in.
 * Lets the user pick "Individual" or "Organisation".
 *
 * Props:
 *   onComplete(userType) — called with 'individual' or 'enterprise' after selection succeeds
 *   showAuthToast(msg, type?) — toast function from AuthLayout
 */
function UserTypeSelection({ onComplete, showAuthToast }) {
  const [selected, setSelected] = useState(null);      // 'individual' | 'enterprise'
  const [loading,  setLoading]  = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);

    try {
      const result = await window.api.auth.setUserType(selected);
      if (result.success) {
        onComplete(selected, result.user);
      } else {
        showAuthToast(result.error || 'Failed to set account type.');
      }
    } catch {
      showAuthToast('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.userTypeWrap}>
      <h1 className={styles.cardTitle}>How will you use Orvyn?</h1>
      <p className={styles.userTypeSubtitle}>
        Choose your account type. You can change this later.
      </p>

      <div className={styles.userTypeGrid}>
        {/* Individual card */}
        <button
          id="user-type-individual"
          type="button"
          className={`${styles.userTypeCard} ${selected === 'individual' ? styles.userTypeCardSelected : ''}`}
          onClick={() => setSelected('individual')}
          disabled={loading}
        >
          <div className={styles.userTypeCardIcon}>
            <UserIcon />
          </div>
          <div className={styles.userTypeCardContent}>
            <span className={styles.userTypeCardTitle}>Individual</span>
            <span className={styles.userTypeCardDesc}>
              Personal document workspace for managing your own files
            </span>
          </div>
          <ul className={styles.userTypeFeatures}>
            <li><CheckIcon /> 3 DataRooms</li>
            <li><CheckIcon /> 500 files / month</li>
            <li><CheckIcon /> Copilot chat</li>
          </ul>
          {selected === 'individual' && (
            <div className={styles.userTypeSelectedBadge}>
              <CheckIcon /> Selected
            </div>
          )}
        </button>

        {/* Organisation card */}
        <button
          id="user-type-enterprise"
          type="button"
          className={`${styles.userTypeCard} ${selected === 'enterprise' ? styles.userTypeCardSelected : ''}`}
          onClick={() => setSelected('enterprise')}
          disabled={loading}
        >
          <div className={styles.userTypeCardIcon}>
            <BuildingIcon />
          </div>
          <div className={styles.userTypeCardContent}>
            <span className={styles.userTypeCardTitle}>Organisation</span>
            <span className={styles.userTypeCardDesc}>
              Collaborative workspace for teams and businesses
            </span>
          </div>
          <ul className={styles.userTypeFeatures}>
            <li><CheckIcon /> Team collaboration</li>
            <li><CheckIcon /> Shared DataRooms</li>
            <li><CheckIcon /> Admin controls</li>
          </ul>
          {selected === 'enterprise' && (
            <div className={styles.userTypeSelectedBadge}>
              <CheckIcon /> Selected
            </div>
          )}
        </button>
      </div>

      <button
        type="button"
        className={styles.submit}
        onClick={handleContinue}
        disabled={!selected || loading}
      >
        {loading && <span className={styles.spinner} />}
        {loading ? 'Setting up…' : 'Continue'}
      </button>
    </div>
  );
}

export default UserTypeSelection;
