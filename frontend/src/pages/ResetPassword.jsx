import { useState } from 'react';
import styles from '../components/auth/auth.module.css';

function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token');

  const [status,          setStatus]          = useState(token ? 'form' : 'invalid');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      setError('Both fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await window.api.auth.resetPassword(token, newPassword);
      if (result.success) {
        setStatus('success');
      } else {
        setError(result.error || 'Reset failed. Please request a new link.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.authWrap}>
      <div className={styles.card}>
        {status === 'invalid' && (
          <>
            <h1 className={styles.cardTitle}>Invalid link</h1>
            <p className={styles.verifyHint}>
              This password reset link is invalid or has expired. Please request a new one.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className={styles.cardTitle}>Password reset</h1>
            <p className={styles.successBox}>
              Password reset successful. Please sign in.
            </p>
          </>
        )}

        {status === 'form' && (
          <>
            <h1 className={styles.cardTitle}>Reset password</h1>

            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="rp-new">New Password</label>
                <input
                  id="rp-new"
                  type="password"
                  className={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="rp-confirm">Confirm Password</label>
                <input
                  id="rp-confirm"
                  type="password"
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.submit} disabled={loading}>
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
