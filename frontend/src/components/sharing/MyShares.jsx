import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateShare, deleteShare, fetchMyShares } from '../../store/sharingSlice';
import { addToast } from '../../store/uiSlice';
import styles from '../../pages/CollaborationPage.module.css';

function MyShares({ items, isLoading }) {
  const dispatch = useDispatch();
  const { isSharing } = useSelector(state => state.sharing);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleUpdate = async (item) => {
    try {
      await dispatch(updateShare({
        shareId: item._id,
        dataroomId: item.sourceDataroomId,
      })).unwrap();
      dispatch(addToast({ message: `"${item.sourceDataroomName}" updated.`, type: 'success' }));
      dispatch(fetchMyShares());
    } catch (err) {
      dispatch(addToast({ message: err || 'Update failed.', type: 'error' }));
    }
  };

  const handleDelete = async (shareId) => {
    try {
      await dispatch(deleteShare(shareId)).unwrap();
      setConfirmDelete(null);
      dispatch(addToast({ message: 'Shared DataRoom deleted.', type: 'success' }));
    } catch (err) {
      dispatch(addToast({ message: err || 'Delete failed.', type: 'error' }));
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingDots}>
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </div>
        <p className={styles.emptyTitle}>You haven't shared any DataRooms yet</p>
        <p className={styles.emptyHint}>
          Open a DataRoom and use the Share button to send a snapshot
          of your DataRoom to another user.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.cardGrid}>
        {items.map(item => (
          <div key={item._id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                {item.sourceDataroomName?.charAt(0)?.toUpperCase() || 'D'}
              </div>
              <div className={styles.cardInfo}>
                <h3 className={styles.cardName}>{item.sourceDataroomName}</h3>
                <div className={styles.cardMeta}>
                  <span>{item.recipientCount || 0} recipient{(item.recipientCount || 0) !== 1 ? 's' : ''}</span>
                  <span className={styles.cardMetaDot} />
                  <span>v{item.snapshotVersion || 1}</span>
                </div>
              </div>
            </div>

            <div className={styles.cardBody}>
              <span className={styles.cardStat}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {item.fileCount || 0} files
              </span>
              <span className={styles.cardStat}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                {item.folderCount || 0} folders
              </span>
              <span className={styles.cardStat}>
                Updated {new Date(item.updatedAt).toLocaleDateString()}
              </span>
            </div>

            <div className={styles.cardActions}>
              <button
                className={styles.btnOutline}
                onClick={() => handleUpdate(item)}
                disabled={isSharing}
              >
                {isSharing ? 'Updating…' : 'Update snapshot'}
              </button>
              <button
                className={styles.btnDanger}
                onClick={() => setConfirmDelete(item._id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className={styles.modalBackdrop} onClick={() => setConfirmDelete(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Delete shared DataRoom?</h2>
            <p className={styles.confirmText}>
              This will revoke access for all recipients. They will no longer
              be able to view or import this DataRoom. This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className={styles.btnPrimary} style={{ backgroundColor: 'var(--danger-color)', flex: 'none' }}
                onClick={() => handleDelete(confirmDelete)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MyShares;
