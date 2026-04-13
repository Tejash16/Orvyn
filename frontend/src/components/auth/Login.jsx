import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginFailure } from '../../store/authSlice';
import { setTheme } from '../../store/uiSlice';
import AccountLinkDialog from './AccountLinkDialog';
import styles from './auth.module.css';

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/* Official Google "G" logo */
const GoogleIcon = () => (
  <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

function Login({ onSwitchView, showAuthToast, initialLinkingState, onLinkingConsumed }) {
  const dispatch = useDispatch();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock,     setCapsLock]     = useState(false);
  const [loading,      setLoading]      = useState(false);

  // Google OAuth state
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [linkingState,    setLinkingState]    = useState(initialLinkingState || null); // { email, googleId, picture }

  // Pick up linking data pushed from AuthLayout (Google OAuth deep link)
  useEffect(() => {
    if (initialLinkingState) {
      setLinkingState(initialLinkingState);
      if (onLinkingConsumed) onLinkingConsumed();
    }
  }, [initialLinkingState, onLinkingConsumed]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email || !password) {
      showAuthToast('Email and password are required.');
      return;
    }

    setLoading(true);

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
      } else if (result.error && result.error.includes('Google sign-in')) {
        dispatch(loginFailure(result.error));
        showAuthToast('This account was created with Google. Please sign in with Google.');
      } else {
        dispatch(loginFailure(result.error));
        showAuthToast(result.error || 'Login failed. Please try again.');
      }
    } catch {
      dispatch(loginFailure('An unexpected error occurred.'));
      showAuthToast('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);

    try {
      // This only opens the system browser for Google consent.
      // The actual login completion happens via the deep link listener
      // (onGoogleAuth) in AuthLayout when the orvyn:// callback arrives.
      const result = await window.api.auth.initiateGoogleAuth();

      if (!result.success) {
        showAuthToast(result.error || 'Google sign-in failed.');
      }
      // On success, just wait — the browser is open. The deep link
      // will fire completeGoogleAuth and AuthLayout handles the rest.
    } catch {
      showAuthToast('Could not open Google sign-in.');
    }
    setIsGoogleLoading(false);
  }

  async function handleLinkAccount(password) {
    const result = await window.api.auth.linkGoogleAccount({
      email: linkingState.email,
      password,
      googleId: linkingState.googleId,
      picture: linkingState.picture,
    });
    if (result.success) {
      dispatch(loginSuccess(result.user));
      if (result.theme) dispatch(setTheme(result.theme));
      setLinkingState(null);
    } else {
      throw new Error(result.error || 'Account linking failed.');
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
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {capsLock && <p className={styles.capsWarning}>Caps Lock is on</p>}
        </div>

        <button type="submit" className={styles.submit} disabled={loading || isGoogleLoading}>
          {loading && <span className={styles.spinner} />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {/* Divider */}
      <div className={styles.authDivider}>
        <span className={styles.authDividerText}>or</span>
      </div>

      {/* Google sign-in */}
      <button
        className={styles.googleSigninBtn}
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || loading}
      >
        <GoogleIcon />
        {isGoogleLoading ? 'Signing in…' : 'Sign in with Google'}
      </button>

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

      {/* Account linking dialog */}
      {linkingState && (
        <AccountLinkDialog
          email={linkingState.email}
          onSubmit={handleLinkAccount}
          onCancel={() => setLinkingState(null)}
        />
      )}
    </>
  );
}

export default Login;
