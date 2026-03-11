import { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeCopilot,
  startNewSession,
  fetchSessions,
  loadSession,
  deleteSession,
  indexFiles,
} from '../../store/copilotSlice';
import styles from './CopilotPanel.module.css';

/* ── Icons ───────────────────────────────────────────────── */

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/* ── CopilotHeader ───────────────────────────────────────── */

function CopilotHeader() {
  const dispatch = useDispatch();
  const scopeName = useSelector((s) => s.copilot.scopeName);
  const indexStatus = useSelector((s) => s.copilot.indexStatus);
  const sessions = useSelector((s) => s.copilot.sessions);
  const activeSessionId = useSelector((s) => s.copilot.activeSessionId);
  const scopeType = useSelector((s) => s.copilot.scopeType);
  const scopeIds = useSelector((s) => s.copilot.scopeIds);

  const [showSessions, setShowSessions] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showSessions) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSessions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSessions]);

  const handleNewChat = () => {
    dispatch(startNewSession({ scopeType, scopeIds, scopeName }));
    setShowSessions(false);
  };

  const handleToggleSessions = () => {
    if (!showSessions) {
      dispatch(fetchSessions({ scopeType, scopeId: scopeIds?.[0] }));
    }
    setShowSessions((v) => !v);
  };

  const handleLoadSession = (sessionId) => {
    dispatch(loadSession(sessionId));
    setShowSessions(false);
  };

  const handleDeleteSession = (e, sessionId) => {
    e.stopPropagation();
    dispatch(deleteSession(sessionId));
  };

  // Index status display
  const complete = indexStatus?.complete ?? 0;
  const total = indexStatus?.total ?? 0;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <span className={styles.scopeLabel}>
          {scopeName || 'DocRack Copilot'}
        </span>
        {total > 0 && (
          <div className={styles.indexStatus}>
            <span>{complete}/{total} indexed</span>
            <div className={styles.indexBar}>
              <div
                className={styles.indexBarFill}
                style={{ width: `${pct}%` }}
              />
            </div>
            {complete < total && (
              <button
                className={styles.headerBtn}
                onClick={() => dispatch(indexFiles({ dataroomId: scopeIds?.[0] }))}
                title="Index Now"
                aria-label="Index Now"
                style={{ width: 'auto', padding: '0 6px', fontSize: '10px', fontWeight: 600, color: 'var(--accent-primary)' }}
              >
                Index Now
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.headerActions} ref={dropdownRef} style={{ position: 'relative' }}>
        {/* New Chat + session dropdown */}
        <button
          className={`${styles.headerBtn} ${styles.newChatBtn}`}
          onClick={handleToggleSessions}
          title="Chat sessions"
          aria-label="Chat sessions"
        >
          <IconPlus />
          <span>New Chat</span>
          <IconChevronDown />
        </button>

        {showSessions && (
          <div className={styles.sessionDropdown}>
            <button
              className={styles.sessionItem}
              onClick={handleNewChat}
            >
              <IconPlus />
              <span className={styles.sessionTitle}>New Chat</span>
            </button>
            {sessions.length === 0 ? (
              <div className={styles.noSessions}>No past sessions</div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  className={`${styles.sessionItem} ${session.id === activeSessionId ? styles.sessionItemActive : ''}`}
                  onClick={() => handleLoadSession(session.id)}
                >
                  <span className={styles.sessionTitle}>
                    {session.title || 'Untitled Chat'}
                  </span>
                  <button
                    className={styles.sessionDeleteBtn}
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    title="Delete session"
                    aria-label="Delete session"
                  >
                    <IconTrash />
                  </button>
                </button>
              ))
            )}
          </div>
        )}

        {/* Close button */}
        <button
          className={styles.headerBtn}
          onClick={() => dispatch(closeCopilot())}
          title="Close Copilot (Esc)"
          aria-label="Close Copilot"
        >
          <IconClose />
        </button>
      </div>
    </div>
  );
}

export default CopilotHeader;
