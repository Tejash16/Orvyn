import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { shareDataroom } from '../../store/sharingSlice';
import { fetchSuggestions } from '../../store/collaborationSlice';
import { addToast } from '../../store/uiSlice';
import styles from '../../pages/CollaborationPage.module.css';

function ShareDialog({ dataroomId, dataroomName, onClose }) {
  const dispatch = useDispatch();
  const { isSharing } = useSelector(state => state.sharing);
  const { suggestions } = useSelector(state => state.collaboration);
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Pre-load collaborators + org members on mount. No per-keystroke search —
  // the sharing gate only allows these users, so we show the full list.
  useEffect(() => {
    dispatch(fetchSuggestions());
  }, [dispatch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [query, suggestions]);

  const handleShare = useCallback(async () => {
    if (!selectedUser) return;
    try {
      await dispatch(shareDataroom({
        dataroomId,
        recipientEmail: selectedUser.email,
      })).unwrap();
      dispatch(addToast({
        message: `DataRoom shared with ${selectedUser.name || selectedUser.email}.`,
        type: 'success',
      }));
      onClose();
    } catch (err) {
      dispatch(addToast({
        message: err || 'Failed to share DataRoom.',
        type: 'error',
      }));
    }
  }, [selectedUser, dataroomId, dispatch, onClose]);

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Share DataRoom</h2>
        <p className={styles.modalSubtitle}>
          Share "{dataroomName}" with a collaborator or organization member
        </p>

        <input
          className={styles.searchInput}
          type="text"
          placeholder="Filter by name or email…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />

        {filtered.length > 0 ? (
          <div className={styles.userList}>
            {filtered.map(user => (
              <div
                key={user._id}
                className={`${styles.userItem} ${selectedUser?._id === user._id ? styles.userItemSelected : ''}`}
                onClick={() => setSelectedUser(user)}
              >
                <div className={styles.userAvatar}>
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="" />
                  ) : (
                    (user.name || user.email || '?').charAt(0).toUpperCase()
                  )}
                </div>
                <div className={styles.userInfo}>
                  <div className={styles.userName}>{user.name || user.email}</div>
                  <div className={styles.userEmail}>{user.email}</div>
                </div>
                {user.source === 'org' && (
                  <span className={styles.orgBadge}>Org</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px 0' }}>
            {suggestions.length === 0
              ? 'Add collaborators from the Collaboration page first, then share DataRooms with them.'
              : 'No matches. Try a different filter.'}
          </p>
        )}

        {selectedUser && (
          <div style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            padding: '8px 12px',
            backgroundColor: 'var(--accent-soft)',
            borderRadius: '8px',
          }}>
            Sharing with <strong>{selectedUser.name || selectedUser.email}</strong> as Viewer
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleShare}
            disabled={!selectedUser || isSharing}
            style={{ flex: 'none', padding: '8px 24px' }}
          >
            {isSharing ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShareDialog;
