import { useState, useRef, useEffect } from 'react';
import styles from './auth.module.css';

const CODE_LENGTH = 6;


/**
 * ResetCode — code-based password reset (Phase 2).
 *
 * Flow: ForgotPassword → ResetCode (code entry + new password) → Login
 *
 * @prop {string}   email           — email the reset code was sent to
 * @prop {number}   initialCooldown — backend-driven resend cooldown in seconds
 * @prop {function} onSwitchView    — navigate to another view
 */
function ResetCode({ email, initialCooldown = 0, onSwitchView }) {
  const [digits,       setDigits]       = useState(Array(CODE_LENGTH).fill(''));
  const [newPassword,  setNewPassword]  = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [cooldown,     setCooldown]     = useState(initialCooldown);
  const inputRefs = useRef([]);

  // Sync cooldown if parent updates it
  useEffect(() => { setCooldown(initialCooldown); }, [initialCooldown]);

  // Clear inputs when email changes
  useEffect(() => {
    setDigits(Array(CODE_LENGTH).fill(''));
    setNewPassword('');
    setConfirm('');
    setError('');
  }, [email]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  function handleDigitChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');
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
    const next = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    setError('');
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const code = digits.join('');
    if (code.length < CODE_LENGTH) {
      setError('Please enter the full 6-digit code.');
      return;
    }

    if (!newPassword) {
      setError('New password is required.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await window.api.auth.resetPassword({ email, code, newPassword });

      if (result.success) {
        setDigits(Array(CODE_LENGTH).fill(''));
        setNewPassword('');
        setConfirm('');
        onSwitchView('login');
      } else {
        setDigits(Array(CODE_LENGTH).fill(''));
        if (result.retryAfterSeconds) {
          setCooldown(result.retryAfterSeconds);
        }
        setError(result.error || 'Password reset failed.');
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
      const result = await window.api.auth.resendResetCode(email);
      if (result.retryAfterSeconds) {
        setCooldown(result.retryAfterSeconds);
      } else {
        setCooldown(result.cooldownSeconds ?? 60);
      }
      setDigits(Array(CODE_LENGTH).fill(''));
      setError('');
    } catch {
      setError('Failed to resend code. Please try again.');
    }
  }

  return (
    <>
      <h1 className={styles.cardTitle}>Enter reset code</h1>

      <p className={styles.verifyHint}>
        A 6-digit code was sent to <strong>{email}</strong>.
        Enter it below with your new password.
      </p>

      <form onSubmit={handleSubmit} noValidate>
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
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoFocus={i === 0}
            />
          ))}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="rc-password">New Password</label>
          <div className={styles.passwordWrap}>
            <input
              id="rc-password"
              type={showPassword ? 'text' : 'password'}
              className={styles.input}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
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
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="rc-confirm">Confirm Password</label>
          <div className={styles.passwordWrap}>
            <input
              id="rc-confirm"
              type={showConfirm ? 'text' : 'password'}
              className={styles.input}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowConfirm((v) => !v)}
              tabIndex={-1}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading && <span className={styles.spinner} />}
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>

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

export default ResetCode;
