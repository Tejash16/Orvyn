import { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../../store/authSlice';
import { setTheme } from '../../store/uiSlice';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import VerifyCode from './VerifyCode';
import ResetCode from './ResetCode';
import styles from './auth.module.css';

/**
 * AuthFlowContainer — owns all transient auth flow state.
 *
 * Security rules for signup auto-login:
 *   - Credentials are cached in a ref (not state, not Redux, not localStorage).
 *   - Auto-login fires ONLY when all three guards are true:
 *       1. flowOrigin === 'signup'
 *       2. signupSessionActive ref is true
 *       3. cachedCredentials ref holds { email, password }
 *   - Credentials are wiped immediately after any use (success or failure).
 *   - On component unmount, credentials are wiped by the useEffect cleanup.
 *   - Navigating away from the signup/verify flow clears credentials.
 */
function AuthLayout() {
  const dispatch = useDispatch();

  // ── View state ─────────────────────────────────────────
  const [activeView,      setActiveView]      = useState('login');
  const [flowEmail,       setFlowEmail]       = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // ── Signup auto-login guards (never persisted) ─────────
  const signupSessionActive = useRef(false);
  const cachedCredentials   = useRef(null);   // { email, password } — wiped after use

  function clearSignupSession() {
    signupSessionActive.current = false;
    cachedCredentials.current   = null;
  }

  // Wipe on unmount
  useEffect(() => () => clearSignupSession(), []);

  // ── View navigation ────────────────────────────────────
  function handleSwitchView(view, extras = {}) {
    // Leaving signup/verify flow without completing it — clear cached creds
    if (view !== 'verify' && view !== 'register') {
      clearSignupSession();
    }

    setActiveView(view);
    if (extras.email          != null) setFlowEmail(extras.email);
    if (extras.cooldownSeconds != null) setCooldownSeconds(extras.cooldownSeconds);
  }

  // ── Called by Register on success ─────────────────────
  function handleRegisterSuccess({ email, password, cooldownSeconds: cd }) {
    // Cache credentials strictly in memory for auto-login after verification
    signupSessionActive.current = true;
    cachedCredentials.current   = { email, password };
    setFlowEmail(email);
    setCooldownSeconds(cd || 60);
    setActiveView('verify');
  }

  // ── Called by VerifyCode on success ───────────────────
  async function handleVerifySuccess() {
    if (signupSessionActive.current && cachedCredentials.current) {
      const { email, password } = cachedCredentials.current;
      clearSignupSession(); // wipe immediately before the async call
      try {
        const result = await window.api.auth.login({ email, password });
        if (result.success) {
          dispatch(loginSuccess(result.user));
          dispatch(setTheme(result.theme ?? 'light'));
          return; // navigates to app shell — AuthLayout unmounts
        }
      } catch {
        // Fall through to manual login
      }
    }
    // No auto-login: route to sign-in
    setActiveView('login');
  }

  return (
    <div className={styles.authWrap}>
      <div className={styles.brandPanel}>
        <div className={styles.brandLogo}>Orvyn</div>
        <p className={styles.brandTagline}>
          Your intelligent document workspace
        </p>
        <div className={styles.brandFeatures}>
          <div className={styles.brandFeature}>
            <span className={styles.brandFeatureIcon}>🗂️</span>
            Smart DataRoom organisation
          </div>
          <div className={styles.brandFeature}>
            <span className={styles.brandFeatureIcon}>🤖</span>
            AI-powered classification
          </div>
          <div className={styles.brandFeature}>
            <span className={styles.brandFeatureIcon}>💬</span>
            Copilot chat &amp; insights
          </div>
        </div>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.card}>
          {activeView === 'login'    && (
            <Login onSwitchView={handleSwitchView} />
          )}
          {activeView === 'register' && (
            <Register
              onSwitchView={handleSwitchView}
              onRegisterSuccess={handleRegisterSuccess}
            />
          )}
          {activeView === 'forgot'   && (
            <ForgotPassword onSwitchView={handleSwitchView} />
          )}
          {activeView === 'verify'   && (
            <VerifyCode
              email={flowEmail}
              initialCooldown={cooldownSeconds}
              onSwitchView={handleSwitchView}
              onVerifySuccess={handleVerifySuccess}
            />
          )}
          {activeView === 'reset'    && (
            <ResetCode
              email={flowEmail}
              initialCooldown={cooldownSeconds}
              onSwitchView={handleSwitchView}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
