import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginFailure } from '../../store/authSlice';
import { setTheme } from '../../store/uiSlice';
import styles from './auth.module.css';

function Login({ onSwitchView }) {
  const dispatch = useDispatch();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock,     setCapsLock]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

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
        onSwitchView('verify', { email, cooldownSeconds: 0 });
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
          <div className={styles.passwordWrap}>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
              autoComplete="current-password"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          {capsLock && <p className={styles.capsWarning}>Caps Lock is on</p>}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading && <span className={styles.spinner} />}
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
