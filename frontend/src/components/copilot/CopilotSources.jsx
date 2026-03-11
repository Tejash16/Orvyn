import styles from './CopilotPanel.module.css';

function CopilotSources({ sources }) {
  if (!sources || sources.length === 0) return null;

  const handleClick = (source) => {
    // Navigate to file in explorer
    if (window.api?.file?.openFile && source.file_id) {
      window.api.file.openFile(source.file_id);
    }
  };

  const handleDoubleClick = (source) => {
    // Open in system app
    if (window.api?.file?.openExternal && source.file_path) {
      window.api.file.openExternal(source.file_path);
    }
  };

  return (
    <div className={styles.sources}>
      <span className={styles.sourcesLabel}>Sources</span>
      {sources.map((source, idx) => (
        <button
          key={`${source.file_name || source.file_id}-${idx}`}
          className={styles.sourceItem}
          onClick={() => handleClick(source)}
          onDoubleClick={() => handleDoubleClick(source)}
          title={source.file_name || 'Source document'}
        >
          <span className={styles.sourceIcon}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <span>
            {source.file_name || 'Document'}
            {source.page && ` (Page ${source.page})`}
            {source.section && ` (${source.section})`}
            {source.sheet && ` (${source.sheet})`}
          </span>
        </button>
      ))}
    </div>
  );
}

export default CopilotSources;
