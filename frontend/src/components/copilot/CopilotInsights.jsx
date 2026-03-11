import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchInsights, generateInsights } from '../../store/copilotSlice';
import styles from './CopilotPanel.module.css';

/* ── Entity type labels ──────────────────────────────────── */

const ENTITY_TYPES = [
  { key: 'organizations', label: 'Organizations' },
  { key: 'people',        label: 'People' },
  { key: 'amounts',       label: 'Amounts' },
  { key: 'dates',         label: 'Dates' },
  { key: 'locations',     label: 'Locations' },
  { key: 'key_terms',     label: 'Key Terms' },
];

/* ── CopilotInsights ─────────────────────────────────────── */

function CopilotInsights({ onEntitySearch }) {
  const dispatch = useDispatch();
  const insights = useSelector((s) => s.copilot.insights);
  const isLoading = useSelector((s) => s.copilot.isLoading);
  const scopeIds = useSelector((s) => s.copilot.scopeIds);

  useEffect(() => {
    if (scopeIds?.length > 0 && !insights) {
      dispatch(fetchInsights(scopeIds[0]));
    }
  }, [scopeIds, insights, dispatch]);

  const handleRefresh = () => {
    if (scopeIds?.length > 0) {
      dispatch(generateInsights(scopeIds[0]));
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <span>Generating insights…</span>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className={styles.insightsEmpty}>
        <p className={styles.insightsEmptyText}>
          No insights available yet. Generate insights to get an overview of your DataRoom.
        </p>
        <button className={styles.refreshBtn} onClick={handleRefresh}>
          Generate Insights
        </button>
      </div>
    );
  }

  return (
    <div className={styles.insightsArea}>
      {/* Summary */}
      {insights.summary && (
        <div className={styles.insightSection}>
          <span className={styles.insightSectionTitle}>Summary</span>
          {insights.is_stale && (
            <span className={styles.staleBadge}>Stale</span>
          )}
          <p className={styles.insightSummary}>{insights.summary}</p>
        </div>
      )}

      {/* Key entities */}
      {insights.entities && (
        <div className={styles.insightSection}>
          <span className={styles.insightSectionTitle}>Key Entities</span>
          {ENTITY_TYPES.map(({ key, label }) => {
            const items = insights.entities[key];
            if (!items || items.length === 0) return null;
            return (
              <div key={key} className={styles.entityGroup}>
                <span className={styles.entityGroupLabel}>{label}</span>
                <div className={styles.entityChips}>
                  {items.map((entity, idx) => (
                    <button
                      key={idx}
                      className={styles.entityChip}
                      onClick={() => onEntitySearch(entity)}
                      title={`Search for "${entity}"`}
                    >
                      {entity}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* File type breakdown */}
      {insights.file_breakdown && (
        <div className={styles.insightSection}>
          <span className={styles.insightSectionTitle}>File Types</span>
          <p className={styles.fileBreakdown}>{insights.file_breakdown}</p>
        </div>
      )}

      {/* Missing documents */}
      {insights.missing_documents && insights.missing_documents.length > 0 && (
        <div className={styles.insightSection}>
          <span className={styles.insightSectionTitle}>Missing Documents</span>
          <div className={styles.missingDocs}>
            {insights.missing_documents.map((doc, idx) => (
              <div key={idx} className={styles.missingDocItem}>{doc}</div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh button */}
      <button className={styles.refreshBtn} onClick={handleRefresh}>
        Refresh Insights
      </button>
    </div>
  );
}

export default CopilotInsights;
