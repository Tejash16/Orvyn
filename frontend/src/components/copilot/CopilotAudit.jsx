import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { auditDataroom, clearAudit } from '../../store/copilotSlice';
import styles from './CopilotPanel.module.css';

/* ── Audit type SVG icons ─────────────────────────────────── */

const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
);
const IconScale = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="M5 6l7-3 7 3"/><path d="M2 15l5-3 5 3"/><path d="M12 15l5-3 5 3"/></svg>
);
const IconTrending = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
);
const IconClipboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
);
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const IconGear = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconEdit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);

const AUDIT_TYPES = [
  { id: 'general',    label: 'General',    icon: <IconSearch /> },
  { id: 'financial',  label: 'Financial',  icon: <IconChart /> },
  { id: 'legal',      label: 'Legal',      icon: <IconScale /> },
  { id: 'fundraising',label: 'Fundraising',icon: <IconTrending /> },
  { id: 'compliance', label: 'Compliance', icon: <IconClipboard /> },
  { id: 'hr',         label: 'HR',         icon: <IconUsers /> },
  { id: 'technical',  label: 'Technical',  icon: <IconGear /> },
  { id: 'custom',     label: 'Custom',     icon: <IconEdit /> },
];

/* ── Score color helper ──────────────────────────────────── */

function scoreColorClass(score) {
  if (score >= 70) return styles.scoreGreen;
  if (score >= 40) return styles.scoreYellow;
  return styles.scoreRed;
}

/* ── CopilotAudit ────────────────────────────────────────── */

function CopilotAudit({ onSwitchTab }) {
  const dispatch = useDispatch();
  const isAuditing = useSelector((s) => s.copilot.isAuditing);
  const auditResult = useSelector((s) => s.copilot.auditResult);
  const scopeIds = useSelector((s) => s.copilot.scopeIds);

  const [selectedType, setSelectedType] = useState(null);
  const [customDescription, setCustomDescription] = useState('');

  const handleRunAudit = () => {
    if (!scopeIds?.length) return;
    const auditType = selectedType === 'custom'
      ? customDescription.trim() || 'general'
      : selectedType;
    dispatch(auditDataroom({ dataroomId: scopeIds[0], auditType }));
  };

  const handleRerun = () => {
    dispatch(clearAudit());
  };

  const handleFollowUp = () => {
    onSwitchTab('chat');
  };

  // Loading
  if (isAuditing) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <span>Auditing your DataRoom…</span>
      </div>
    );
  }

  // Results
  if (auditResult) {
    const score = auditResult.readiness_score ?? 0;
    return (
      <div className={styles.auditArea}>
        <div className={styles.resultArea}>
          <div className={styles.resultHeader}>
            <span className={styles.resultTitle}>Audit Results</span>
          </div>

          {/* Readiness score bar */}
          <div className={styles.scoreBar}>
            <div className={styles.scoreTrack}>
              <div
                className={`${styles.scoreFill} ${scoreColorClass(score)}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className={styles.scoreLabel}>{score}%</span>
          </div>

          {/* Sections */}
          {auditResult.overview && (
            <div className={styles.resultSection}>
              <span className={styles.resultSectionTitle}>Overview</span>
              <p className={styles.resultContent}>{auditResult.overview}</p>
            </div>
          )}

          {auditResult.completeness && (
            <div className={styles.resultSection}>
              <span className={styles.resultSectionTitle}>Completeness</span>
              <p className={styles.resultContent}>{auditResult.completeness}</p>
            </div>
          )}

          {auditResult.inconsistencies && (
            <div className={styles.resultSection}>
              <span className={styles.resultSectionTitle}>Inconsistencies</span>
              <p className={styles.resultContent}>{auditResult.inconsistencies}</p>
            </div>
          )}

          {auditResult.suggestions && (
            <div className={styles.resultSection}>
              <span className={styles.resultSectionTitle}>Suggestions</span>
              <p className={styles.resultContent}>{auditResult.suggestions}</p>
            </div>
          )}

          <div className={styles.resultActions}>
            <button className={styles.followUpBtn} onClick={handleFollowUp}>
              Ask Follow-up
            </button>
            <button className={styles.followUpBtn} onClick={handleRerun}>
              Re-run Audit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Type selector
  return (
    <div className={styles.auditArea}>
      <div className={styles.auditTypeGrid}>
        {AUDIT_TYPES.map((type) => (
          <button
            key={type.id}
            className={`${styles.auditTypeCard} ${selectedType === type.id ? styles.auditTypeCardSelected : ''}`}
            onClick={() => setSelectedType(type.id)}
          >
            <span className={styles.auditTypeIcon}>{type.icon}</span>
            {type.label}
          </button>
        ))}
      </div>

      {selectedType === 'custom' && (
        <input
          type="text"
          className={styles.customInput}
          value={customDescription}
          onChange={(e) => setCustomDescription(e.target.value)}
          placeholder="Describe what to audit…"
        />
      )}

      <button
        className={styles.runBtn}
        disabled={!selectedType || !scopeIds?.length}
        onClick={handleRunAudit}
      >
        Run Audit
      </button>
    </div>
  );
}

export default CopilotAudit;
