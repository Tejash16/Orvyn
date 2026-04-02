import { useState } from 'react';
import styles from './auth.module.css';

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

/**
 * CreateOrganization — form to create a new organization.
 *
 * Props:
 *   onComplete(organization) — called with the created org object on success
 *   onBack() — navigate back to org choice screen
 *   showAuthToast(msg, type?) — toast function from AuthLayout
 */
function CreateOrganization({ onComplete, onBack, showAuthToast }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    try {
      const result = await window.api.organization.create(name.trim());
      if (result.success) {
        onComplete(result.organization);
      } else {
        showAuthToast(result.error || 'Failed to create organization.');
      }
    } catch {
      showAuthToast('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.orgFlowWrap}>
      <button type="button" className={styles.orgFlowBackBtn} onClick={onBack} disabled={loading}>
        <ArrowLeftIcon /> Back
      </button>

      <h1 className={styles.cardTitle}>Create your organization</h1>
      <p className={styles.orgFlowSubtitle}>
        Give your organization a name. You can change this later.
      </p>

      <form onSubmit={handleCreate}>
        <input
          type="text"
          className={styles.orgInput}
          placeholder="Organization name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          autoFocus
          maxLength={100}
        />

        <button
          type="submit"
          className={styles.submit}
          disabled={!name.trim() || loading}
          style={{ marginTop: 20, width: '100%' }}
        >
          {loading && <span className={styles.spinner} />}
          {loading ? 'Creating...' : 'Create Organization'}
        </button>
      </form>
    </div>
  );
}

export default CreateOrganization;
