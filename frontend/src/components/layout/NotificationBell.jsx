import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  notificationReceived,
} from '../../store/notificationSlice';
import {
  acceptCollaboration,
  rejectCollaboration,
  fetchCollaborations,
} from '../../store/collaborationSlice';
import styles from './NotificationBell.module.css';

// Live pushes arrive over SSE (see electron/ipc/notificationHandlers.js).
// This interval is a safety net for anything missed while the stream was
// disconnected — the slice's `since` cursor keeps it cheap.
const POLL_INTERVAL_MS = 5 * 60 * 1000;

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function describe(n) {
  switch (n.type) {
    case 'collab_request':
      return {
        title: `${n.data?.fromUserName || 'Someone'} wants to collaborate`,
        body: n.data?.fromUserEmail || '',
      };
    case 'collab_accepted':
      return {
        title: `${n.data?.byUserName || 'Someone'} accepted your request`,
        body: 'You can now share DataRooms with them.',
      };
    case 'collab_rejected':
      return {
        title: 'Collaboration request declined',
        body: '',
      };
    case 'dataroom_shared':
      return {
        title: `${n.data?.fromUserName || 'Someone'} shared a DataRoom`,
        body: n.data?.dataroomName || '',
      };
    case 'dataroom_updated':
      return {
        title: 'Shared DataRoom updated',
        body: n.data?.dataroomName || '',
      };
    default:
      return { title: n.type, body: '' };
  }
}

function NotificationBell() {
  const dispatch = useDispatch();
  const { items, unreadCount } = useSelector((state) => state.notifications);
  const isAuthed = useSelector((state) => !!state.auth.user);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  // Initial fetch + subscribe to live SSE pushes. The interval is a
  // reconnect fallback only — real-time delivery comes via `onNew`.
  useEffect(() => {
    if (!isAuthed) return undefined;
    dispatch(fetchNotifications({}));
    const unsubscribe = window.api.notifications.onNew((payload) => {
      dispatch(notificationReceived(payload));
    });
    const id = setInterval(() => dispatch(fetchNotifications({})), POLL_INTERVAL_MS);
    return () => {
      unsubscribe();
      clearInterval(id);
    };
  }, [dispatch, isAuthed]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleItemClick = (n) => {
    if (!n.read) dispatch(markNotificationRead(n._id));
  };

  const handleAccept = (e, n) => {
    e.stopPropagation();
    const collabId = n.data?.collaborationId;
    if (!collabId) return;
    dispatch(acceptCollaboration(collabId));
    dispatch(markNotificationRead(n._id));
    dispatch(fetchCollaborations());
  };

  const handleReject = (e, n) => {
    e.stopPropagation();
    const collabId = n.data?.collaborationId;
    if (!collabId) return;
    dispatch(rejectCollaboration(collabId));
    dispatch(markNotificationRead(n._id));
    dispatch(fetchCollaborations());
  };

  if (!isAuthed) return null;

  return (
    <div className={styles.wrap}>
      <button
        ref={btnRef}
        type="button"
        className={styles.bellBtn}
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div ref={panelRef} className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.markAllBtn}
                onClick={() => dispatch(markAllNotificationsRead())}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {items.length === 0 ? (
              <div className={styles.empty}>No notifications yet</div>
            ) : (
              items.map((n) => {
                const { title, body } = describe(n);
                const isCollabRequest = n.type === 'collab_request';
                return (
                  <div
                    key={n._id}
                    className={`${styles.item} ${n.read ? '' : styles.itemUnread}`}
                    onClick={() => handleItemClick(n)}
                  >
                    {!n.read && <span className={styles.unreadDot} />}
                    <div className={styles.itemBody}>
                      <div className={styles.itemTitle}>{title}</div>
                      {body && <div className={styles.itemSubtitle}>{body}</div>}
                      <div className={styles.itemTime}>{formatRelative(n.createdAt)}</div>
                      {isCollabRequest && !n.read && (
                        <div className={styles.itemActions}>
                          <button
                            type="button"
                            className={styles.acceptBtn}
                            onClick={(e) => handleAccept(e, n)}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className={styles.rejectBtn}
                            onClick={(e) => handleReject(e, n)}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
