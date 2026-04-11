import { useState, useEffect, useRef } from 'react';
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
 * JoinOrganization — enter an invite code to join an org.
 *
 * Props:
 *   onComplete(organization) — called with the joined org object on success
 *   onBack() — navigate back to org choice screen
 *   showAuthToast(msg, type?) — toast function from AuthLayout
 */
/**
 * Extract a bare invite code from whatever the user pastes. Accepts:
 *   - Raw 32-char hex code:              "abc123..."
 *   - Deep link:                         "orvyn://invite?code=abc123..."
 *   - Web landing URL:                   "https://app.orvyn.com/invite/abc123..."
 *   - Landing URL with query/fragment:   ".../invite/abc123?foo=bar#baz"
 */
function extractInviteCode(input) {
  const raw = (input || '').trim();
  if (!raw) return '';

  // Custom-protocol deep link: orvyn://invite?code=XXX
  if (raw.toLowerCase().startsWith('orvyn://')) {
    try {
      const url = new URL(raw);
      const fromQuery = url.searchParams.get('code');
      if (fromQuery) return fromQuery.trim();
      // Fallback: orvyn://invite/XXX form
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1].trim();
    } catch {
      return raw;
    }
  }

  // HTTPS landing page: .../invite/XXX
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('invite');
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1].trim();
    } catch {
      return raw;
    }
  }

  return raw;
}

function JoinOrganization({ onComplete, onBack, showAuthToast }) {
  const [inviteCode, setInviteCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const debounceRef = useRef(null);

  // Listen for deep link invite codes
  useEffect(() => {
    const cleanup = window.api.deepLink.onInvite((code) => {
      setInviteCode(extractInviteCode(code));
    });
    return cleanup;
  }, []);

  // Debounced preview when invite code changes
  useEffect(() => {
    setPreview(null);

    if (!inviteCode.trim() || inviteCode.trim().length < 8) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const result = await window.api.organization.getInviteDetails(inviteCode.trim());
        if (result.success) {
          setPreview(result.invite);
        } else {
          setPreview(null);
        }
      } catch {
        setPreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inviteCode]);

  async function handleJoin(e) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);

    try {
      const result = await window.api.organization.acceptInvite(inviteCode.trim());
      if (result.success) {
        onComplete(result.organization);
      } else {
        showAuthToast(result.error || 'Failed to join organization.');
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

      <h1 className={styles.cardTitle}>Join an organization</h1>
      <p className={styles.orgFlowSubtitle}>
        Paste the invite link or code you received from your team admin.
      </p>

      <form onSubmit={handleJoin}>
        <input
          type="text"
          className={styles.orgInput}
          placeholder="Paste invite link or code"
          value={inviteCode}
          onChange={(e) => setInviteCode(extractInviteCode(e.target.value))}
          disabled={loading}
          autoFocus
        />

        {previewing && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '12px 0 0' }}>
            Looking up invite...
          </p>
        )}

        {preview && (
          <div className={styles.invitePreview}>
            <div className={styles.invitePreviewRow}>
              <span className={styles.invitePreviewLabel}>Organization</span>
              <span className={styles.invitePreviewValue}>{preview.orgName}</span>
            </div>
            <div className={styles.invitePreviewRow}>
              <span className={styles.invitePreviewLabel}>Invited by</span>
              <span className={styles.invitePreviewValue}>{preview.inviterName}</span>
            </div>
            <div className={styles.invitePreviewRow}>
              <span className={styles.invitePreviewLabel}>Role</span>
              <span className={styles.invitePreviewValue} style={{ textTransform: 'capitalize' }}>
                {preview.role}
              </span>
            </div>
            <div className={styles.invitePreviewRow}>
              <span className={styles.invitePreviewLabel}>Expires</span>
              <span className={styles.invitePreviewValue}>
                {new Date(preview.expiresAt).toLocaleDateString('en-IN', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </span>
            </div>
          </div>
        )}

        <button
          type="submit"
          className={styles.submit}
          disabled={!inviteCode.trim() || loading}
          style={{ marginTop: 20, width: '100%' }}
        >
          {loading && <span className={styles.spinner} />}
          {loading ? 'Joining...' : 'Join Organization'}
        </button>
      </form>
    </div>
  );
}

export default JoinOrganization;
