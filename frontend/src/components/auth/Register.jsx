import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../../store/authSlice';
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

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

function getStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

/**
 * Register — calls onRegisterSuccess({ email, password, cooldownSeconds })
 * so AuthLayout can cache credentials for the signup auto-login guard.
 *
 * Google signup bypasses OTP verification (Google already verified the email)
 * and logs the user in directly via Redux dispatch.
 */
function Register({ onSwitchView, onRegisterSuccess, showAuthToast }) {
  const dispatch = useDispatch();

  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);

  // Google OAuth state
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [linkingState,    setLinkingState]    = useState(null);

  const strength = getStrength(password);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      showAuthToast('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      showAuthToast('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      showAuthToast('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const result = await window.api.auth.register({ name, email, password });

      if (result.success) {
        onRegisterSuccess({
          email,
          cooldownSeconds: result.cooldownSeconds ?? 60,
        });
      } else {
        showAuthToast(result.error || 'Registration failed. Please try again.');
      }
    } catch {
      showAuthToast('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setIsGoogleLoading(true);

    try {
      const result = await window.api.auth.initiateGoogleAuth();

      if (result.requiresLinking) {
        setLinkingState({
          email: result.email,
          googleId: result.googleId,
          picture: result.picture,
        });
        setIsGoogleLoading(false);
        return;
      }

      if (result.success) {
        // Google signup — email already verified, skip OTP and log in directly
        dispatch(loginSuccess(result.user));
        if (result.theme) dispatch(setTheme(result.theme));

        // New Google users don't have a userType yet — show type selection
        if (result.isNewUser || !result.user?.userType) {
          onSwitchView('userType');
        }
      } else {
        showAuthToast(result.error || 'Google sign-up failed.');
      }
    } catch {
      showAuthToast('Google sign-up failed.');
    }
    setIsGoogleLoading(false);
  }

  async function handleLinkAccount(pwd) {
    const result = await window.api.auth.linkGoogleAccount({
      email: linkingState.email,
      password: pwd,
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
      <h1 className={styles.cardTitle}>Create account</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="reg-name">Name</label>
          <input
            id="reg-name"
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="reg-password">Password</label>
          <div className={styles.passwordWrap}>
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
          {password && (
            <div className={styles.strengthMeter}>
              <div className={styles.strengthBars}>
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={[
                      styles.strengthBar,
                      strength >= n ? styles.active : '',
                      strength >= n ? styles['s' + strength] : '',
                    ].join(' ')}
                  />
                ))}
              </div>
              <span className={[styles.strengthLabel, styles['s' + strength]].join(' ')}>
                {STRENGTH_LABELS[strength]}
              </span>
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="reg-confirm">Confirm Password</label>
          <div className={styles.passwordWrap}>
            <input
              id="reg-confirm"
              type={showConfirm ? 'text' : 'password'}
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowConfirm((v) => !v)}
              tabIndex={-1}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <button type="submit" className={styles.submit} disabled={loading || isGoogleLoading}>
          {loading && <span className={styles.spinner} />}
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      {/* Divider */}
      <div className={styles.authDivider}>
        <span className={styles.authDividerText}>or</span>
      </div>

      {/* Google sign-up */}
      <button
        className={styles.googleSigninBtn}
        onClick={handleGoogleSignUp}
        disabled={isGoogleLoading || loading}
      >
        <GoogleIcon />
        {isGoogleLoading ? 'Signing up…' : 'Sign up with Google'}
      </button>

      <div className={styles.footer}>
        <span className={styles.switchText}>
          Already have an account?{' '}
          <button
            type="button"
            className={styles.switchLink}
            onClick={() => onSwitchView('login')}
          >
            Sign in
          </button>
        </span>
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

export default Register;
