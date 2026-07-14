import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import '../styles/callback.css';

/* ── Animated SVG icons ─────────────────────────────────── */

function SuccessIcon() {
  return (
    <div className="callback-icon-ring callback-icon-success">
      <svg className="callback-icon-svg" viewBox="0 0 52 52">
        <circle className="callback-check-circle" cx="26" cy="26" r="24" fill="none" />
        <path className="callback-check-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
      </svg>
    </div>
  );
}

function ErrorIcon() {
  return (
    <div className="callback-icon-ring callback-icon-error">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    </div>
  );
}

function LinkIcon() {
  return (
    <div className="callback-icon-ring callback-icon-link">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="callback-spinner-wrap">
      <div className="callback-spinner" />
      <div className="callback-spinner-glow" />
    </div>
  );
}

/* ── Deep link button with auto-trigger ─────────────────── */

function DeepLinkAction({ href, label = 'Open in Orvyn' }) {
  const [triggered, setTriggered] = useState(false);
  const autoTriggered = useRef(false);

  // Auto-trigger the deep link once after a short delay
  useEffect(() => {
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    const timer = setTimeout(() => {
      window.location.href = href;
      setTriggered(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [href]);

  return (
    <div className="callback-action-wrap">
      <a
        href={href}
        className="callback-btn-primary"
        onClick={() => setTriggered(true)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        {label}
      </a>
      <p className="callback-auto-close">
        {triggered
          ? 'If Orvyn didn\'t open, click the button above.'
          : 'Launching Orvyn automatically…'}
      </p>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */

export default function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [authData, setAuthData] = useState(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setError(
        errorParam === 'access_denied'
          ? 'You declined the Google sign-in request.'
          : `Google returned an error: ${errorParam}`
      );
      return;
    }

    if (!code) {
      setStatus('error');
      setError('No authorization code received from Google.');
      return;
    }

    apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        code,
        redirectUri: window.location.origin + '/portal/auth/google/callback',
      }),
    })
      .then((data) => {
        if (data.requiresLinking) {
          setStatus('linking');
          setAuthData(data);
        } else {
          setStatus('success');
          setAuthData(data);
        }
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message || 'Authentication failed. Please try again.');
      });
  }, [searchParams]);

  return (
    <div className="callback-page">
      {/* Ambient background elements */}
      <div className="callback-bg-orb callback-bg-orb-1" />
      <div className="callback-bg-orb callback-bg-orb-2" />
      <div className="callback-bg-orb callback-bg-orb-3" />

      <div className="callback-card-wrapper">
        {/* Brand header */}
        <div className="callback-brand">
          <div className="callback-brand-logo">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="callback-brand-name">Orvyn</span>
        </div>

        {/* Card */}
        <div className={`callback-card ${status === 'loading' ? 'callback-card-loading' : ''}`}>
          {status === 'loading' && (
            <div className="callback-content callback-fade-in">
              <LoadingSpinner />
              <h2 className="callback-title callback-title-loading">
                Signing you in
              </h2>
              <p className="callback-subtitle">
                Completing Google authentication…
              </p>
              <div className="callback-progress-bar">
                <div className="callback-progress-fill" />
              </div>
            </div>
          )}

          {status === 'success' && authData && (
            <div className="callback-content callback-fade-in">
              <SuccessIcon />
              <h2 className="callback-title callback-title-success">
                You're all set!
              </h2>
              <p className="callback-subtitle">
                Google sign-in successful. Opening Orvyn…
              </p>
              <DeepLinkAction
                href={`orvyn://auth/google?action=login&token=${encodeURIComponent(authData.accessToken)}&refreshToken=${encodeURIComponent(authData.refreshToken)}&isNewUser=${authData.isNewUser || false}`}
              />
            </div>
          )}

          {status === 'error' && (
            <div className="callback-content callback-fade-in">
              <ErrorIcon />
              <h2 className="callback-title callback-title-error">
                Sign-in failed
              </h2>
              <p className="callback-subtitle">
                {error}
              </p>
              <p className="callback-hint">
                Please close this tab and try again from the Orvyn app.
              </p>
            </div>
          )}

          {status === 'linking' && authData && (
            <div className="callback-content callback-fade-in">
              <LinkIcon />
              <h2 className="callback-title callback-title-link">
                Link your account
              </h2>
              <p className="callback-subtitle">
                An account with <strong>{authData.email}</strong> already exists.
                Open Orvyn to verify your password and link your Google account.
              </p>
              <DeepLinkAction
                href={`orvyn://auth/google?action=link&email=${encodeURIComponent(authData.email)}&googleId=${encodeURIComponent(authData.googleId)}&picture=${encodeURIComponent(authData.picture || '')}`}
                label="Continue in Orvyn"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="callback-footer">
          <span>Powered by Orvyn</span>
          <span className="callback-footer-dot">·</span>
          <span>Secure authentication</span>
        </div>
      </div>
    </div>
  );
}
