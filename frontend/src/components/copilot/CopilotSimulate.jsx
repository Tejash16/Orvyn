import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { simulateReview, clearSimulation } from '../../store/copilotSlice';
import styles from './CopilotPanel.module.css';

/* ── Simulation role SVG icons ────────────────────────────── */

const IconEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);
const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);
const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const IconBuilding = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="2"/><line x1="15" y1="22" x2="15" y2="2"/></svg>
);
const IconBriefcase = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
);
const IconFileText = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
);
const IconStar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
);
const IconPencil = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);

const ROLES = [
  { id: 'critical_reviewer',   label: 'Critical Reviewer',   icon: <IconEye /> },
  { id: 'compliance_officer',  label: 'Compliance Officer',  icon: <IconShield /> },
  { id: 'new_employee',        label: 'New Employee',        icon: <IconUser /> },
  { id: 'external_auditor',    label: 'External Auditor',    icon: <IconBuilding /> },
  { id: 'vc_partner',          label: 'VC Partner',          icon: <IconBriefcase /> },
  { id: 'legal_counsel',       label: 'Legal Counsel',       icon: <IconFileText /> },
  { id: 'board_member',        label: 'Board Member',        icon: <IconStar /> },
  { id: 'custom',              label: 'Custom',              icon: <IconPencil /> },
];

/* ── CopilotSimulate ─────────────────────────────────────── */

function CopilotSimulate({ onSwitchTab }) {
  const dispatch = useDispatch();
  const isSimulating = useSelector((s) => s.copilot.isSimulating);
  const simulationResult = useSelector((s) => s.copilot.simulationResult);
  const scopeIds = useSelector((s) => s.copilot.scopeIds);

  const [selectedRole, setSelectedRole] = useState(null);
  const [customRole, setCustomRole] = useState('');

  const handleRunSimulation = () => {
    if (!scopeIds?.length) return;
    const simulationType = selectedRole === 'custom'
      ? 'custom'
      : selectedRole;
    const customRoleValue = selectedRole === 'custom'
      ? customRole.trim() || undefined
      : undefined;
    dispatch(simulateReview({
      dataroomId: scopeIds[0],
      simulationType,
      customRole: customRoleValue,
    }));
  };

  const handleRerun = () => {
    dispatch(clearSimulation());
  };

  const handleFollowUp = () => {
    onSwitchTab('chat');
  };

  // Loading
  if (isSimulating) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <span>Running role simulation…</span>
      </div>
    );
  }

  // Results
  if (simulationResult) {
    return (
      <div className={styles.auditArea}>
        <div className={styles.resultArea}>
          <div className={styles.resultHeader}>
            <span className={styles.resultTitle}>Simulation Results</span>
          </div>

          {simulationResult.tough_questions && (
            <div className={styles.resultSection}>
              <span className={styles.resultSectionTitle}>Tough Questions</span>
              <p className={styles.resultContent}>{simulationResult.tough_questions}</p>
            </div>
          )}

          {simulationResult.red_flags && (
            <div className={styles.resultSection}>
              <span className={styles.resultSectionTitle}>Red Flags</span>
              <p className={styles.resultContent}>{simulationResult.red_flags}</p>
            </div>
          )}

          {simulationResult.verdict && (
            <div className={styles.resultSection}>
              <span className={styles.resultSectionTitle}>Verdict</span>
              <p className={styles.resultContent}>{simulationResult.verdict}</p>
            </div>
          )}

          <div className={styles.resultActions}>
            <button className={styles.followUpBtn} onClick={handleFollowUp}>
              Ask Follow-up
            </button>
            <button className={styles.followUpBtn} onClick={handleRerun}>
              Re-run Simulation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Role selector
  return (
    <div className={styles.auditArea}>
      <div className={styles.auditTypeGrid}>
        {ROLES.map((role) => (
          <button
            key={role.id}
            className={`${styles.auditTypeCard} ${selectedRole === role.id ? styles.auditTypeCardSelected : ''}`}
            onClick={() => setSelectedRole(role.id)}
          >
            <span className={styles.auditTypeIcon}>{role.icon}</span>
            {role.label}
          </button>
        ))}
      </div>

      {selectedRole === 'custom' && (
        <input
          type="text"
          className={styles.customInput}
          value={customRole}
          onChange={(e) => setCustomRole(e.target.value)}
          placeholder="Describe the role to simulate…"
        />
      )}

      <button
        className={styles.runBtn}
        disabled={!selectedRole || !scopeIds?.length}
        onClick={handleRunSimulation}
      >
        Run Simulation
      </button>
    </div>
  );
}

export default CopilotSimulate;
