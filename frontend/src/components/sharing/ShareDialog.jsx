import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { searchUsers, shareDataroom, clearSearchResults } from '../../store/sharingSlice';
import { addToast } from '../../store/uiSlice';
import styles from '../../pages/CollaborationPage.module.css';

function ShareDialog({ dataroomId, dataroomName, onClose }) {
  const dispatch = useDispatch();
  const { searchResults, isSharing } = useSelector(state => state.sharing);
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 3) {
      dispatch(clearSearchResults());
      return;
    }
    const timer = setTimeout(() => {
      dispatch(searchUsers(query));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => dispatch(clearSearchResults());
  }, [dispatch]);

  const handleShare = useCallback(async () => {
    if (!selectedUser) return;
    try {
      await dispatch(shareDataroom({
        dataroomId,
        recipientEmail: selectedUser.email,
      })).unwrap();
      dispatch(addToast({
        message: `DataRoom shared with ${selectedUser.name}.`,
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
          Share "{dataroomName}" with another user
        </p>

        {/* Search input */}
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by email address…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className={styles.userList}>
            {searchResults.map(user => (
              <div
                key={user._id}
                className={`${styles.userItem} ${selectedUser?._id === user._id ? styles.userItemSelected : ''}`}
                onClick={() => setSelectedUser(user)}
              >
                <div className={styles.userAvatar}>
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="" />
                  ) : (
                    user.name?.charAt(0)?.toUpperCase() || '?'
                  )}
                </div>
                <div className={styles.userInfo}>
                  <div className={styles.userName}>{user.name}</div>
                  <div className={styles.userEmail}>{user.email}</div>
                </div>
                {user.isOrgMember && (
                  <span className={styles.orgBadge}>Org</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {query.length >= 3 && searchResults.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px 0' }}>
            No users found. Try an exact email address.
          </p>
        )}

        {/* Selected user display */}
        {selectedUser && (
          <div style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            padding: '8px 12px',
            backgroundColor: 'var(--accent-soft)',
            borderRadius: '8px',
          }}>
            Sharing with <strong>{selectedUser.name}</strong> ({selectedUser.email}) as Viewer
          </div>
        )}

        {/* Actions */}
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
