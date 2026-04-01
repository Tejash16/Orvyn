import { useState } from 'react';
import styles from './auth.module.css';

/**
 * AccountLinkDialog — shown when a Google sign-in detects an existing
 * local account with the same email. The user must verify their
 * existing password to link both auth methods.
 */
function AccountLinkDialog({ email, onSubmit, onCancel }) {
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!password) {
      setError('Password is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err.message || 'Linking failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={styles.linkDialogOverlay}
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className={styles.linkDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-dialog-title"
      >
        <h2 className={styles.linkDialogTitle} id="link-dialog-title">
          Link your account
        </h2>
        <p className={styles.linkDialogMessage}>
          An account with <span className={styles.linkDialogEmail}>{email}</span> already
          exists. Enter your password to link it with Google sign-in.
        </p>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="link-password">Password</label>
            <input
              id="link-password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.linkDialogActions}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submit}
              disabled={loading}
            >
              {loading && <span className={styles.spinner} />}
              {loading ? 'Linking…' : 'Link account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AccountLinkDialog;
