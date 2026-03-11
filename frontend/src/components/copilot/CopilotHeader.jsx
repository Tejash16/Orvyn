import { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeCopilot,
  fetchSessions,
  indexFiles,
} from '../../store/copilotSlice';
import CopilotSessionList from './CopilotSessionList';
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

/* ── CopilotHeader ───────────────────────────────────────── */

function CopilotHeader() {
  const dispatch = useDispatch();
  const scopeName = useSelector((s) => s.copilot.scopeName);
  const indexStatus = useSelector((s) => s.copilot.indexStatus);
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

  const handleToggleSessions = () => {
    if (!showSessions) {
      dispatch(fetchSessions({ scopeType, scopeId: scopeIds?.[0] }));
    }
    setShowSessions((v) => !v);
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
          <CopilotSessionList onClose={() => setShowSessions(false)} />
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
