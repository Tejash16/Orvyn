import { useDispatch } from 'react-redux';
import { sendMessage, startStreaming } from '../../store/copilotSlice';
import styles from './CopilotPanel.module.css';

/* ── Icons ───────────────────────────────────────────────── */

const IconSummary = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconCompare = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="8" height="16" rx="1" />
    <rect x="14" y="4" width="8" height="16" rx="1" />
  </svg>
);

const IconAudit = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const IconSimilar = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/* ── CopilotQuickActions ─────────────────────────────────── */

function CopilotQuickActions({ onSwitchTab }) {
  const dispatch = useDispatch();

  const quickSend = (message) => {
    dispatch(startStreaming());
    dispatch(sendMessage({ message }));
  };

  return (
    <div className={styles.quickActions}>
      <button
        className={styles.quickBtn}
        onClick={() => quickSend('Summarize this DataRoom')}
        title="Summarize DataRoom"
      >
        <span className={styles.quickBtnIcon}><IconSummary /></span>
        Summary
      </button>

      <button
        className={styles.quickBtn}
        onClick={() => quickSend('Compare the selected documents for differences and similarities')}
        title="Compare documents"
      >
        <span className={styles.quickBtnIcon}><IconCompare /></span>
        Compare
      </button>

      <button
        className={styles.quickBtn}
        onClick={() => onSwitchTab('audit')}
        title="Run audit"
      >
        <span className={styles.quickBtnIcon}><IconAudit /></span>
        Audit
      </button>

      <button
        className={styles.quickBtn}
        onClick={() => quickSend('Find similar or duplicate documents in this DataRoom')}
        title="Find similar documents"
      >
        <span className={styles.quickBtnIcon}><IconSimilar /></span>
        Similar
      </button>
    </div>
  );
}

export default CopilotQuickActions;
