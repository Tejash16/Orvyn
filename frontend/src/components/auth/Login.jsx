import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginFailure } from '../../store/authSlice';
import { setTheme } from '../../store/uiSlice';
import styles from './auth.module.css';

function Login({ onSwitchView }) {
  const dispatch = useDispatch();

  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');

  const [unverified,    setUnverified]    = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError,   setResendError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    setError('');
    dispatch(loginStart());

    try {
      const result = await window.api.auth.login({ email, password });

      if (result.success) {
        dispatch(loginSuccess(result.user));
        dispatch(setTheme(result.theme ?? 'light'));
      } else if (result.error === 'Email not verified.') {
        dispatch(loginFailure(result.error));
        onSwitchView('verify', email);
        return;
      } else {
        dispatch(loginFailure(result.error));
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch {
      dispatch(loginFailure('An unexpected error occurred.'));
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setResendError('');
    try {
      await window.api.auth.resendVerification(email);
      setResendSuccess(true);
    } catch {
      setResendError('Failed to send. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }

  function handleBackToLogin() {
    setUnverified(false);
    setResendSuccess(false);
    setResendError('');
    setError('');
  }

  if (unverified) {
    return (
      <>
        <h1 className={styles.cardTitle}>Email not verified</h1>
        <p className={styles.verifyHint}>
          Your email is not verified. Resend the verification link to{' '}
          <strong>{email}</strong>.
        </p>

        {resendSuccess ? (
          <p className={styles.successBox}>
            Verification email sent. Check the server console (dev mode).
          </p>
        ) : (
          <>
            {resendError && <p className={styles.error}>{resendError}</p>}
            <button
              type="button"
              className={styles.submit}
              onClick={handleResend}
              disabled={resendLoading}
            >
              {resendLoading ? 'Sending…' : 'Resend verification email'}
            </button>
          </>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.switchLink} onClick={handleBackToLogin}>
            Back to sign in
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.cardTitle}>Sign in</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className={styles.footer}>
        <span className={styles.switchText}>
          Don't have an account?{' '}
          <button
            type="button"
            className={styles.switchLink}
            onClick={() => onSwitchView('register')}
          >
            Create one
          </button>
        </span>
        <button
          type="button"
          className={styles.switchLink}
          onClick={() => onSwitchView('forgot')}
        >
          Forgot password?
        </button>
      </div>
    </>
  );
}

export default Login;
