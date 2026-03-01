import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { removeToast } from '../../store/uiSlice';
import styles from './Toast.module.css';

const TOAST_DURATION = 3000;

function ToastItem({ toast }) {
  const dispatch = useDispatch();

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(removeToast(toast.id));
    }, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast.id, dispatch]);

  const typeClass =
    toast.type === 'success' ? styles.toastSuccess
      : toast.type === 'error' ? styles.toastError
        : styles.toastInfo;

  return (
    <div className={`${styles.toast} ${typeClass}`}>
      <span className={styles.message}>{toast.message}</span>
      <button
        className={styles.closeBtn}
        onClick={() => dispatch(removeToast(toast.id))}
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
