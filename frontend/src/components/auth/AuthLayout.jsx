import { useState, useRef, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginSuccess } from '../../store/authSlice';
import { setTheme } from '../../store/uiSlice';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import VerifyCode from './VerifyCode';
import ResetCode from './ResetCode';
import UserTypeSelection from './UserTypeSelection';
import CreateOrganization from './CreateOrganization';
import JoinOrganization from './JoinOrganization';
import styles from './auth.module.css';

/* ── Brand panel feature icons ───────────────────────────── */

const IconFolderAI = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

const IconSparkles = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
  </svg>
);

const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

/* ── Auth toast (local to formPanel) ─────────────────────── */

const TOAST_DURATION = 4000;
const FADE_OUT_MS = 250;

function AuthToast({ toast, onRemove }) {
  const [fading, setFading] = useState(false);

  const dismiss = useCallback(() => {
    setFading(true);
    setTimeout(() => onRemove(toast.id), FADE_OUT_MS);
  }, [toast.id, onRemove]);

  useEffect(() => {
    const timer = setTimeout(dismiss, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [dismiss]);

  const typeClass = toast.type === 'success' ? styles.authToastSuccess : styles.authToastError;

  return (
    <div className={`${styles.authToast} ${typeClass} ${fading ? styles.fadeOut : ''}`}>
      <span className={styles.authToastIcon}>
        {toast.type === 'success' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </span>
      <span className={styles.authToastMsg}>{toast.message}</span>
      <button className={styles.authToastClose} onClick={dismiss} type="button">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * AuthFlowContainer — owns all transient auth flow state.
 *
 * Email verification now establishes the session directly: the Express
 * /verify-email endpoint returns access + refresh tokens, so no credential
 * caching or second login round-trip is required.
 */
function AuthLayout({ initialView = 'login' }) {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth.user);

  // ── View state ─────────────────────────────────────────
  const [activeView,      setActiveView]      = useState(initialView);
  const [flowEmail,       setFlowEmail]       = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // ── Auth toast state ───────────────────────────────────
  const [authToasts,   setAuthToasts]   = useState([]);
  const toastCounterRef = useRef(0);

  const showAuthToast = useCallback((message, type = 'error') => {
    toastCounterRef.current += 1;
    const id = toastCounterRef.current;
    setAuthToasts((prev) => {
      // Deduplicate consecutive identical messages
      if (prev.length > 0 && prev[prev.length - 1].message === message) return prev;
      // Max 2 visible
      const next = [...prev, { id, message, type }];
      while (next.length > 2) next.shift();
      return next;
    });
  }, []);

  const removeAuthToast = useCallback((id) => {
    setAuthToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Clear toasts on view change
  useEffect(() => {
    setAuthToasts([]);
  }, [activeView]);

  // ── View navigation ────────────────────────────────────
  function handleSwitchView(view, extras = {}) {
    setActiveView(view);
    if (extras.email          != null) setFlowEmail(extras.email);
    if (extras.cooldownSeconds != null) setCooldownSeconds(extras.cooldownSeconds);
  }

  // ── Called by Register on success ─────────────────────
  function handleRegisterSuccess({ email, cooldownSeconds: cd }) {
    setFlowEmail(email);
    setCooldownSeconds(cd || 60);
    setActiveView('verify');
  }

  // ── Called by VerifyCode on success ───────────────────
  // Express now returns { user, theme } directly from verify-email,
  // so the user is logged in without a second login call.
  function handleVerifySuccess(verifyResult) {
    if (verifyResult && verifyResult.user) {
      dispatch(loginSuccess(verifyResult.user));
      dispatch(setTheme(verifyResult.theme ?? 'light'));
      // App.jsx will route to <AuthPage initialView="userType" /> via the
      // `isAuthenticated && !userType` branch, which remounts AuthLayout.
      return;
    }
    // No session payload — fall back to manual login.
    setActiveView('login');
  }

  // ── Org choice sub-view (create vs join) ────────────────
  function OrgChoiceView({ onCreateOrg, onJoinOrg, onBack }) {
    return (
      <div className={styles.orgFlowWrap}>
        <button type="button" className={styles.orgFlowBackBtn} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </button>
        <h1 className={styles.cardTitle}>Set up your organization</h1>
        <p className={styles.orgFlowSubtitle}>
          Create a new organization or join an existing one with an invite code.
        </p>
        <div className={styles.orgChoiceGrid}>
          <button type="button" className={styles.orgChoiceCard} onClick={onCreateOrg}>
            <div className={styles.orgChoiceIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div className={styles.orgChoiceContent}>
              <span className={styles.orgChoiceTitle}>Create an organization</span>
              <span className={styles.orgChoiceDesc}>Start a new workspace for your team</span>
            </div>
          </button>
          <button type="button" className={styles.orgChoiceCard} onClick={onJoinOrg}>
            <div className={styles.orgChoiceIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <div className={styles.orgChoiceContent}>
              <span className={styles.orgChoiceTitle}>Join an organization</span>
              <span className={styles.orgChoiceDesc}>Enter an invite code from your team admin</span>
            </div>
          </button>
        </div>
      </div>
    );
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
            <span className={styles.brandFeatureIcon}>
              <IconFolderAI />
            </span>
            Smart DataRoom organisation
          </div>
          <div className={styles.brandFeature}>
            <span className={styles.brandFeatureIcon}>
              <IconSparkles />
            </span>
            AI-powered classification
          </div>
          <div className={styles.brandFeature}>
            <span className={styles.brandFeatureIcon}>
              <IconChat />
            </span>
            Copilot chat &amp; insights
          </div>
        </div>
      </div>

      <div className={styles.formPanel}>
        {/* Auth toasts — center-top of form panel */}
        {authToasts.length > 0 && (
          <div className={styles.authToastWrap}>
            {authToasts.map((t) => (
              <AuthToast key={t.id} toast={t} onRemove={removeAuthToast} />
            ))}
          </div>
        )}

        <div className={styles.card}>
          {activeView === 'login'    && (
            <Login onSwitchView={handleSwitchView} showAuthToast={showAuthToast} />
          )}
          {activeView === 'register' && (
            <Register
              onSwitchView={handleSwitchView}
              onRegisterSuccess={handleRegisterSuccess}
              showAuthToast={showAuthToast}
            />
          )}
          {activeView === 'forgot'   && (
            <ForgotPassword onSwitchView={handleSwitchView} showAuthToast={showAuthToast} />
          )}
          {activeView === 'verify'   && (
            <VerifyCode
              email={flowEmail}
              initialCooldown={cooldownSeconds}
              onSwitchView={handleSwitchView}
              onVerifySuccess={handleVerifySuccess}
              showAuthToast={showAuthToast}
            />
          )}
          {activeView === 'reset'    && (
            <ResetCode
              email={flowEmail}
              initialCooldown={cooldownSeconds}
              onSwitchView={handleSwitchView}
              showAuthToast={showAuthToast}
            />
          )}
          {activeView === 'userType'  && (
            <UserTypeSelection
              onComplete={(userType, freshUser) => {
                // Update redux with the fresh user (now carrying userType).
                // Without this, App.jsx stays in the `!userType` branch and
                // any later screen-switch never bubbles the choice through.
                const merged = freshUser
                  ? freshUser
                  : { ...(currentUser || {}), userType };
                dispatch(loginSuccess(merged));

                if (userType === 'enterprise') {
                  // Enterprise users need to create or join an org
                  setActiveView('orgChoice');
                }
                // Individual — App.jsx will switch out of the auth tree
                // automatically once redux has userType set.
              }}
              showAuthToast={showAuthToast}
            />
          )}
          {activeView === 'orgChoice' && (
            <OrgChoiceView
              onCreateOrg={() => setActiveView('createOrg')}
              onJoinOrg={() => setActiveView('joinOrg')}
              onBack={() => setActiveView('userType')}
            />
          )}
          {activeView === 'createOrg' && (
            <CreateOrganization
              onComplete={(org, freshUser) => {
                // Use the fresh user returned by org:create (carries
                // userType=enterprise + activeOrganizationId). This causes
                // App.jsx to render the main app body — AuthLayout unmounts.
                const merged = freshUser
                  ? freshUser
                  : { ...(currentUser || {}), userType: 'enterprise', activeOrganizationId: org?._id };
                dispatch(loginSuccess(merged));
              }}
              onBack={() => setActiveView('orgChoice')}
              showAuthToast={showAuthToast}
            />
          )}
          {activeView === 'joinOrg' && (
            <JoinOrganization
              onComplete={(org, freshUser) => {
                const merged = freshUser
                  ? freshUser
                  : { ...(currentUser || {}), userType: 'enterprise', activeOrganizationId: org?._id };
                dispatch(loginSuccess(merged));
              }}
              onBack={() => setActiveView('orgChoice')}
              showAuthToast={showAuthToast}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
