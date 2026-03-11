import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleSidebar, setActivePage } from '../../store/uiSlice';
import { toggleCopilot } from '../../store/copilotSlice';
import styles from './Sidebar.module.css';

/* ── Icons ───────────────────────────────────────────────── */

const IconDataRoom = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const IconUpload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65
      1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0
      9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0
      0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65
      1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65
      1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0
      1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0
      0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconCopilot = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
  </svg>
);

const IconChevron = ({ collapsed }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {collapsed
      ? <polyline points="9 18 15 12 9 6" />
      : <polyline points="15 18 9 12 15 6" />}
  </svg>
);

/* ── NavItem ─────────────────────────────────────────────── */

function NavItem({ icon, label, collapsed, active, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`${styles.navItem} ${active ? styles.active : ''}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Active indicator bar */}
      {active && <span className={styles.activeIndicator} />}

      <span className={styles.navIcon}>{icon}</span>

      {/* Label — hidden when collapsed via CSS */}
      <span className={styles.navLabel}>{label}</span>

      {/* Tooltip — only mounted + visible when collapsed and hovered */}
      {collapsed && hovered && (
        <span className={styles.tooltip} role="tooltip">{label}</span>
      )}
    </div>
  );
}

/* ── Sidebar ─────────────────────────────────────────────── */

function Sidebar() {
  const collapsed = useSelector((state) => state.ui.sidebarCollapsed);
  const activePage = useSelector((state) => state.ui.activePage);
  const copilotOpen = useSelector((state) => state.copilot.isOpen);
  const dispatch = useDispatch();

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>

      {/* Section label */}
      {!collapsed && (
        <div className={styles.sectionLabel}>Navigation</div>
      )}

      {/* Top section */}
      <nav className={styles.topNav} aria-label="Main navigation">
        <NavItem
          icon={<IconDataRoom />}
          label="DataRoom"
          collapsed={collapsed}
          active={activePage === 'dataroom'}
          onClick={() => dispatch(setActivePage('dataroom'))}
        />
        <NavItem
          icon={<IconUpload />}
          label="Upload"
          collapsed={collapsed}
          active={activePage === 'upload'}
          onClick={() => dispatch(setActivePage('upload'))}
        />
      </nav>

      <div className={styles.spacer} />

      {/* Divider before bottom nav */}
      <div className={styles.divider} />

      {/* Bottom section */}
      <nav className={styles.bottomNav} aria-label="Settings">
        <NavItem
          icon={<IconCopilot />}
          label="Copilot"
          collapsed={collapsed}
          active={copilotOpen}
          onClick={() => dispatch(toggleCopilot())}
        />
        <NavItem
          icon={<IconSettings />}
          label="Settings"
          collapsed={collapsed}
          active={activePage === 'settings'}
          onClick={() => dispatch(setActivePage('settings'))}
        />
      </nav>

      {/* Collapse toggle */}
      <button
        className={styles.toggleBtn}
        onClick={() => dispatch(toggleSidebar())}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <IconChevron collapsed={collapsed} />
      </button>

    </aside>
  );
}

export default Sidebar;
