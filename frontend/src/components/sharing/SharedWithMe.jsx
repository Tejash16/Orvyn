import { useDispatch, useSelector } from 'react-redux';
import { importDataroom } from '../../store/sharingSlice';
import { addToast } from '../../store/uiSlice';
import styles from '../../pages/CollaborationPage.module.css';

function SharedWithMe({ items, isLoading }) {
  const dispatch = useDispatch();
  const { isImporting } = useSelector(state => state.sharing);

  const handleImport = async (shareId, name) => {
    const result = await dispatch(importDataroom(shareId)).unwrap();
    if (result.dataroom_id) {
      dispatch(addToast({ message: `"${name}" imported to your DataRooms.`, type: 'success' }));
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
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <p className={styles.emptyTitle}>No DataRooms have been shared with you yet</p>
        <p className={styles.emptyHint}>
          When someone shares a DataRoom with you, it will appear here.
          You can import it to browse files and use Copilot.
        </p>
      </div>
    );
  }

  return (
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
                <span>from {item.ownerName || 'Unknown'}</span>
                <span className={styles.cardMetaDot} />
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
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
            <span className={styles.cardStat}>v{item.snapshotVersion || 1}</span>
            {item.hasUpdate && (
              <span className={styles.updateBadge}>New version available</span>
            )}
          </div>

          <div className={styles.cardActions}>
            <button
              className={styles.btnPrimary}
              onClick={() => handleImport(item._id, item.sourceDataroomName)}
              disabled={isImporting}
            >
              {isImporting ? 'Importing…' : 'Import to DataRooms'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SharedWithMe;
