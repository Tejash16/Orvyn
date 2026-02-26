import { useEffect, useState } from 'react';
import styles from './verifyEmail.module.css';

function CheckIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11.5 14.5 15 10" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function VerifyEmail() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
      setStatus('error');
      return;
    }

    (async () => {
      try {
        await window.api.auth.verifyEmail(token);
        setStatus('success');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {status === 'loading' && (
          <>
            <div className={styles.dots}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </div>
            <p className={styles.msg}>Verifying your email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className={`${styles.iconWrap} ${styles.success}`}>
              <CheckIcon />
            </div>
            <h1 className={styles.title}>Email verified</h1>
            <p className={styles.msg}>
              Your email has been confirmed. You can now sign in.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className={`${styles.iconWrap} ${styles.error}`}>
              <ErrorIcon />
            </div>
            <h1 className={styles.title}>Verification failed</h1>
            <p className={styles.msg}>
              This verification link is invalid or has expired.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
