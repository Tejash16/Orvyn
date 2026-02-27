import { useState, useRef, useEffect } from 'react';
import styles from './auth.module.css';

const CODE_LENGTH = 6;

function VerifyCode({ email, onSwitchView }) {
  const [digits, setDigits]       = useState(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [cooldown, setCooldown]   = useState(0);
  const inputRefs = useRef([]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  function handleChange(index, value) {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    // Auto-advance to next input
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < CODE_LENGTH; i++) {
      next[i] = pasted[i] || '';
    }
    setDigits(next);
    setError('');

    // Focus last filled input or the next empty one
    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  async function handleVerify() {
    const code = digits.join('');
    if (code.length < CODE_LENGTH) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await window.api.auth.verifyEmail(email, code);

      if (result.success) {
        onSwitchView('login');
      } else {
        setError(result.error || 'Verification failed.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;

    try {
      await window.api.auth.resendVerification(email);
      setCooldown(60);
      setError('');
    } catch {
      setError('Failed to resend code. Please try again.');
    }
  }

  return (
    <>
      <h1 className={styles.cardTitle}>Verify your email</h1>

      <p className={styles.verifyHint}>
        Enter the 6-digit code sent to <strong>{email}</strong>.
      </p>

      <div className={styles.codeInputWrap} onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className={styles.codeDigit}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            autoFocus={i === 0}
          />
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="button"
        className={styles.submit}
        onClick={handleVerify}
        disabled={loading}
      >
        {loading ? 'Verifying...' : 'Verify'}
      </button>

      <div className={styles.resendRow}>
        {cooldown > 0 ? (
          <span className={styles.cooldownText}>Resend code in {cooldown}s</span>
        ) : (
          <button type="button" className={styles.switchLink} onClick={handleResend}>
            Resend code
          </button>
        )}
      </div>

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

export default VerifyCode;
