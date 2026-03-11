import { useSelector, useDispatch } from 'react-redux';
import { fetchSessions, loadSession, deleteSession } from '../../store/copilotSlice';
import styles from './CopilotPanel.module.css';

/* ── Icons ───────────────────────────────────────────────── */

const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/* ── CopilotSessionList ──────────────────────────────────── */

function CopilotSessionList({ onClose }) {
  const dispatch = useDispatch();
  const sessions = useSelector((s) => s.copilot.sessions);
  const activeSessionId = useSelector((s) => s.copilot.activeSessionId);

  const handleLoad = (sessionId) => {
    dispatch(loadSession(sessionId));
    onClose();
  };

  const handleDelete = (e, sessionId) => {
    e.stopPropagation();
    dispatch(deleteSession(sessionId));
  };

  return (
    <div className={styles.sessionDropdown}>
      {sessions.length === 0 ? (
        <div className={styles.noSessions}>No past sessions</div>
      ) : (
        sessions.map((session) => (
          <button
            key={session.id}
            className={`${styles.sessionItem} ${session.id === activeSessionId ? styles.sessionItemActive : ''}`}
            onClick={() => handleLoad(session.id)}
          >
            <span className={styles.sessionTitle}>
              {session.title || 'Untitled Chat'}
            </span>
            <button
              className={styles.sessionDeleteBtn}
              onClick={(e) => handleDelete(e, session.id)}
              title="Delete session"
              aria-label="Delete session"
            >
              <IconTrash />
            </button>
          </button>
        ))
      )}
    </div>
  );
}

export default CopilotSessionList;
