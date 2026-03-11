import styles from './CopilotPanel.module.css';

const TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'insights', label: 'Insights' },
  { id: 'audit', label: 'Audit' },
  { id: 'simulate', label: 'Simulate' },
];

function CopilotTabs({ activeTab, onTabChange }) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Copilot tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default CopilotTabs;
