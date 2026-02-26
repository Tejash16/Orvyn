import { useState } from 'react';
import styles from './auth.module.css';

function ForgotPassword({ onSwitchView }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email) {
      setError('Email is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await window.api.auth.forgotPassword(email);
      setSent(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <>
        <h1 className={styles.cardTitle}>Check your email</h1>
        <p className={styles.successBox}>
          If that email is registered, a reset link has been sent. Check the server console (dev mode).
        </p>
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

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
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
