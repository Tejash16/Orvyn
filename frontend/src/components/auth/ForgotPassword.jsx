import { useState } from 'react';
import styles from './auth.module.css';

function ForgotPassword({ onSwitchView, showAuthToast }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email) {
      showAuthToast('Email is required.');
      return;
    }

    setLoading(true);

    try {
      const result = await window.api.auth.forgotPassword(email);
      // Backend always returns success (no email enumeration).
      // Switch to the in-app code-entry step.
      onSwitchView('reset', {
        email,
        cooldownSeconds: result.cooldownSeconds ?? 60,
      });
    } catch {
      showAuthToast('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className={styles.cardTitle}>Reset password</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
        </div>

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading && <span className={styles.spinner} />}
          {loading ? 'Sending…' : 'Send reset code'}
        </button>
      </form>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.switchLink}
          onClick={() => onSwitchView('login')}
        >
          Back to sign in
        </button>
      </div>
    </>
  );
}

export default ForgotPassword;
