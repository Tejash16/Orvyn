import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authSlice';
import { setTheme } from '../store/uiSlice';
import styles from './setting.module.css';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

function SettingsPage() {
  const dispatch = useDispatch();
  const theme    = useSelector((state) => state.ui.theme);
  const user     = useSelector((state) => state.auth.user);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword,  setDeletePassword]  = useState('');
  const [deleteError,     setDeleteError]     = useState('');
  const [deleteLoading,   setDeleteLoading]   = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText,      setFeedbackText]      = useState('');
  const [feedbackError,     setFeedbackError]     = useState('');
  const [feedbackLoading,   setFeedbackLoading]   = useState(false);
  const [feedbackSuccess,   setFeedbackSuccess]   = useState(false);

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

  function openFeedbackModal() {
    setFeedbackText('');
    setFeedbackError('');
    setFeedbackSuccess(false);
    setShowFeedbackModal(true);
  }

  function closeFeedbackModal() {
    if (feedbackLoading) return;
    setShowFeedbackModal(false);
    setFeedbackText('');
    setFeedbackError('');
    setFeedbackSuccess(false);
  }

  async function handleFeedbackSubmit() {
    if (!feedbackText.trim()) {
      setFeedbackError('Please enter your feedback.');
      return;
    }
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      const result = await window.api.auth.sendFeedback(feedbackText.trim());
      if (result.success) {
        setFeedbackSuccess(true);
        setTimeout(() => closeFeedbackModal(), 1500);
      } else {
        setFeedbackError(result.error || 'Failed to send feedback.');
      }
    } catch {
      setFeedbackError('An unexpected error occurred.');
    } finally {
      setFeedbackLoading(false);
    }
  }

  const formattedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '—';

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your profile and preferences</p>
      </div>

      {/* Profile card */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          <span className={styles.avatarInitials}>{getInitials(user?.name)}</span>
        </div>
        <div className={styles.profileInfo}>
          <p className={styles.profileName}>{user?.name ?? '—'}</p>
          <p className={styles.profileEmail}>{user?.email ?? '—'}</p>
          <div className={styles.profileMeta}>
            <svg className={styles.profileMetaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Member since {formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <h2 className={styles.sectionTitle}>Appearance</h2>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <span className={styles.label}>Dark Mode</span>
            <p className={styles.hint}>Switch between light and dark themes</p>
          </div>
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

      {/* Session */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <h2 className={styles.sectionTitle}>Session</h2>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <span className={styles.label}>Sign out</span>
            <p className={styles.hint}>Your local data will remain on this device</p>
          </div>
          <button className={styles.btnSecondary} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </section>

      {/* Feedback */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h2 className={styles.sectionTitle}>Feedback</h2>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <span className={styles.label}>Send feedback</span>
            <p className={styles.hint}>Help us improve Orvyn by sharing your thoughts</p>
          </div>
          <button className={styles.btnSecondary} onClick={openFeedbackModal}>
            Send feedback
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className={`${styles.section} ${styles.dangerSection}`}>
        <div className={`${styles.sectionHeader} ${styles.dangerSectionHeader}`}>
          <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <h2 className={styles.sectionTitle}>Danger Zone</h2>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <span className={styles.label}>Delete account</span>
            <p className={styles.hint}>
              Permanently deletes your account and all local data on this device
            </p>
          </div>
          <button className={styles.btnDanger} onClick={openDeleteModal}>
            Delete account
          </button>
        </div>
      </section>

      {/* Feedback modal */}
      {showFeedbackModal && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) closeFeedbackModal(); }}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
          >
            <h2 className={styles.modalTitle} id="feedback-modal-title">Send Feedback</h2>
            <p className={styles.modalDescription}>
              We appreciate your feedback. Let us know how we can improve Orvyn.
            </p>
            <textarea
              className={styles.modalTextarea}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Write your feedback here..."
              rows={5}
              maxLength={2000}
              autoFocus
              disabled={feedbackSuccess}
            />
            {feedbackError && <p className={styles.modalError}>{feedbackError}</p>}
            {feedbackSuccess && <p className={styles.modalSuccess}>Feedback sent successfully!</p>}
            <div className={styles.modalActions}>
              <button
                className={styles.btnSecondary}
                onClick={closeFeedbackModal}
                disabled={feedbackLoading}
              >
                Cancel
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleFeedbackSubmit}
                disabled={feedbackLoading || feedbackSuccess}
              >
                {feedbackLoading ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
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
              This permanently deletes your account and all local data on this device. This action cannot be undone.
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
