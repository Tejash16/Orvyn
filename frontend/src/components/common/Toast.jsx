import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { removeToast, setActivePage } from '../../store/uiSlice';
import styles from './Toast.module.css';

const TOAST_DURATION = 4000;
const ACTION_TOAST_DURATION = 8000;
const FADE_OUT_MS = 250;

function ToastItem({ toast }) {
  const dispatch = useDispatch();
  const [fading, setFading] = useState(false);

  const dismiss = useCallback(() => {
    setFading(true);
    setTimeout(() => dispatch(removeToast(toast.id)), FADE_OUT_MS);
  }, [toast.id, dispatch]);

  useEffect(() => {
    const duration = toast.action ? ACTION_TOAST_DURATION : TOAST_DURATION;
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [dismiss, toast.action]);

  function handleAction() {
    if (toast.action?.page) {
      dispatch(setActivePage(toast.action.page));
    }
    dismiss();
  }

  const typeClass =
    toast.type === 'success' ? styles.toastSuccess
      : toast.type === 'error' ? styles.toastError
        : toast.type === 'warning' ? styles.toastWarning
          : styles.toastInfo;

  return (
    <div className={`${styles.toast} ${typeClass} ${fading ? styles.toastFadeOut : ''}`}>
      <span className={styles.message}>{toast.message}</span>
      {toast.action && (
        <button
          className={styles.actionBtn}
          onClick={handleAction}
          type="button"
        >
          {toast.action.label}
        </button>
      )}
      <button
        className={styles.closeBtn}
        onClick={dismiss}
        type="button"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function ToastContainer() {
  const toasts = useSelector((s) => s.ui.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

export default ToastContainer;
