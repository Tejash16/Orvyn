import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authSlice';
import { setTheme } from '../store/uiSlice';
import styles from './setting.module.css';

function SettingsPage() {
  const dispatch = useDispatch();
  const theme    = useSelector((state) => state.ui.theme);
  const user     = useSelector((state) => state.auth.user);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword,  setDeletePassword]  = useState('');
  const [deleteError,     setDeleteError]     = useState('');
  const [deleteLoading,   setDeleteLoading]   = useState(false);

  async function handleThemeToggle() {
    const prevTheme = theme;
    const newTheme  = theme === 'light' ? 'dark' : 'light';
    dispatch(setTheme(newTheme));
    try {
      const result = await window.api.settings.setTheme(newTheme);
      if (!result.success) dispatch(setTheme(prevTheme));
    } catch {
      dispatch(setTheme(prevTheme));
    }
  }

  async function handleLogout() {
    await window.api.auth.logout();
    dispatch(logout());
  }

  function openDeleteModal() {
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteModal(true);
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    setShowDeleteModal(false);
    setDeletePassword('');
    setDeleteError('');
  }

  async function handleDeleteConfirm() {
    if (!deletePassword) {
      setDeleteError('Password is required.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const result = await window.api.auth.deleteAccount(deletePassword);
      if (result.success) {
        dispatch(logout());
      } else {
        setDeleteError(result.error || 'Deletion failed. Please try again.');
      }
    } catch {
      setDeleteError('An unexpected error occurred.');
    } finally {
      setDeleteLoading(false);
    }
  }

  const formattedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—';

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Profile</h2>
        <div className={styles.profileGrid}>
          <span className={styles.fieldLabel}>Name</span>
          <span className={styles.fieldValue}>{user?.name ?? '—'}</span>
          <span className={styles.fieldLabel}>Email</span>
          <span className={styles.fieldValue}>{user?.email ?? '—'}</span>
          <span className={styles.fieldLabel}>Member since</span>
          <span className={styles.fieldValue}>{formattedDate}</span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Appearance</h2>
        <div className={styles.row}>
          <span className={styles.label}>Dark Mode</span>
          <button
            className={`${styles.toggle} ${theme === 'dark' ? styles.on : ''}`}
            onClick={handleThemeToggle}
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Toggle dark mode"
          >
            <span className={styles.thumb} />
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Session</h2>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <span className={styles.label}>Sign out</span>
            <p className={styles.hint}>Your local data will remain on this device.</p>
          </div>
          <button className={styles.btnSecondary} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </section>

      <section className={`${styles.section} ${styles.dangerSection}`}>
        <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Danger Zone</h2>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <span className={styles.label}>Delete account</span>
            <p className={styles.hint}>
              Permanently deletes your account and all local data on this device.
            </p>
          </div>
          <button className={styles.btnDanger} onClick={openDeleteModal}>
            Delete account
          </button>
        </div>
      </section>

      {showDeleteModal && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <h2 className={styles.modalTitle} id="delete-modal-title">Delete account?</h2>
            <p className={styles.modalWarning}>
              This permanently deletes local data on this device. This action cannot be undone.
            </p>
            <label className={styles.modalLabel} htmlFor="delete-password">
              Confirm your password
            </label>
            <input
              id="delete-password"
              type="password"
              className={styles.modalInput}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !deleteLoading) handleDeleteConfirm(); }}
              autoComplete="current-password"
              autoFocus
            />
            {deleteError && <p className={styles.modalError}>{deleteError}</p>}
            <div className={styles.modalActions}>
              <button
                className={styles.btnSecondary}
                onClick={closeDeleteModal}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className={styles.btnDanger}
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
