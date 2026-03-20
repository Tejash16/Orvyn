import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  toggleCopilot,
  closeCopilot,
  openCopilot,
  sendMessage,
  startStreaming,
  appendStreamChunk,
  finalizeStreamMessage,
  updateIndexProgress,
  updateSessionTitle,
  setCopilotScope,
  setSelectedFiles,
  getIndexStatus,
} from '../../store/copilotSlice';
import { addToast } from '../../store/uiSlice';
import CopilotHeader from './CopilotHeader';
import CopilotTabs from './CopilotTabs';
import CopilotChat from './CopilotChat';
import CopilotInsights from './CopilotInsights';
import CopilotAudit from './CopilotAudit';
import CopilotSimulate from './CopilotSimulate';
import CopilotQuickActions from './CopilotQuickActions';
import CopilotInput from './CopilotInput';
import styles from './CopilotPanel.module.css';

/* ── CopilotPanel ────────────────────────────────────────── */

function CopilotPanel() {
  const dispatch = useDispatch();
  const isOpen = useSelector((s) => s.copilot.isOpen);
  const panelWidth = useSelector((s) => s.copilot.panelWidth);
  const [activeTab, setActiveTab] = useState('chat');

  // File explorer state for context auto-switch
  const currentDataroomId = useSelector((s) => s.fileExplorer.currentDataroomId);
  const currentFolderId = useSelector((s) => s.fileExplorer.currentFolderId);
  const currentPath = useSelector((s) => s.fileExplorer.currentPath);
  const selectedItems = useSelector((s) => s.fileExplorer.selectedItems);

  // DataRoom list — for deleted-DR detection AND multi-DR auto-detection
  const datarooms = useSelector((s) => s.dataroom.datarooms);

  // dataroomNameMap is computed inline from the stable `datarooms` array reference
  // to avoid returning a new object on every render (which triggers unnecessary re-renders).

  /* ── IPC stream listeners ────────────────────────────── */

  useEffect(() => {
    if (!window.api?.copilot) return;

    const cleanups = [];

    // Stream chunk listener
    if (window.api.copilot.onStreamChunk) {
      cleanups.push(
        window.api.copilot.onStreamChunk((chunk) => {
          dispatch(appendStreamChunk(chunk));
        })
      );
    }

    // Stream end listener
    if (window.api.copilot.onStreamEnd) {
      cleanups.push(
        window.api.copilot.onStreamEnd((data) => {
          dispatch(finalizeStreamMessage({
            sources: data?.sources || [],
            session_id: data?.session_id,
            session_title: data?.session_title,
          }));
        })
      );
    }

    // Stream error listener
    if (window.api.copilot.onStreamError) {
      cleanups.push(
        window.api.copilot.onStreamError((data) => {
          dispatch(finalizeStreamMessage({ sources: [] }));
          dispatch(addToast({
            message: data?.message || 'AI service unavailable',
            type: 'error',
          }));
        })
      );
    }

    // Index progress listener
    if (window.api.copilot.onIndexProgress) {
      cleanups.push(
        window.api.copilot.onIndexProgress((progress) => {
          dispatch(updateIndexProgress(progress));
        })
      );
    }

    // Title update listener (fires after title generation completes)
    if (window.api.copilot.onTitleUpdate) {
      cleanups.push(
        window.api.copilot.onTitleUpdate((data) => {
          dispatch(updateSessionTitle(data));
        })
      );
    }

    return () => {
      cleanups.forEach((fn) => { if (typeof fn === 'function') fn(); });
    };
  }, [dispatch]);

  /* ── Keyboard shortcuts ──────────────────────────────── */

  useEffect(() => {
    const TABS = ['chat', 'insights', 'audit', 'simulate'];
    const handler = (e) => {
      // Ctrl+J → toggle
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault();
        dispatch(toggleCopilot());
        return;
      }
      // Escape → close (only if open)
      if (e.key === 'Escape' && isOpen) {
        dispatch(closeCopilot());
        return;
      }
      // Tab → cycle tabs (only if panel is open and not in an input)
      if (e.key === 'Tab' && isOpen && !e.ctrlKey && !e.shiftKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT') return;
        e.preventDefault();
        setActiveTab((prev) => {
          const idx = TABS.indexOf(prev);
          return TABS[(idx + 1) % TABS.length];
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, isOpen]);

  /* ── Context auto-switch ─────────────────────────────── */

  useEffect(() => {
    // When no DataRoom is selected → global scope (multi-dataroom)
    if (!currentDataroomId) {
      dispatch(setSelectedFiles([]));
      dispatch(setCopilotScope({
        scopeType: 'global',
        scopeIds: [],
        scopeName: 'All DataRooms',
      }));
      return;
    }

    const dataroomName = currentPath?.[0]?.name || '';

    if (selectedItems.length > 0) {
      // File(s) selected → scope to files
      const fileIds = selectedItems
        .filter((s) => s.type === 'file')
        .map((s) => s.id);
      if (fileIds.length > 0) {
        dispatch(setSelectedFiles(fileIds));
        dispatch(setCopilotScope({
          scopeType: fileIds.length === 1 ? 'file' : 'files',
          scopeIds: fileIds,
          scopeName: `${fileIds.length} file${fileIds.length > 1 ? 's' : ''} in ${dataroomName}`,
        }));
        return;
      }
    }

    // No files selected — check if inside a folder
    dispatch(setSelectedFiles([]));

    if (currentFolderId && currentPath.length > 1) {
      // Inside a folder → scope to folder
      const folderSegment = currentPath[currentPath.length - 1];
      const folderName = folderSegment?.name || 'Folder';
      dispatch(setCopilotScope({
        scopeType: 'folder',
        scopeIds: [currentFolderId],
        scopeName: `${folderName} (in ${dataroomName})`,
      }));
    } else {
      // At DataRoom root → scope to DataRoom
      dispatch(setCopilotScope({
        scopeType: 'dataroom',
        scopeIds: [currentDataroomId],
        scopeName: dataroomName,
      }));
    }
    dispatch(getIndexStatus(currentDataroomId));
  }, [currentDataroomId, currentFolderId, currentPath, selectedItems, dispatch]);

  /* ── Auto-prompt on file upload ──────────────────────── */

  useEffect(() => {
    if (!window.api?.copilot?.onFilesAdded) return;
    const cleanup = window.api.copilot.onFilesAdded((data) => {
      const count = data?.count || 0;
      const drName = data?.dataroom_name || '';
      if (count > 0) {
        dispatch(openCopilot());
        setActiveTab('chat');
        // Add a system-style prompt as if the assistant said it
        dispatch(finalizeStreamMessage({
          sources: [],
          content: `${count} file${count > 1 ? 's' : ''} added to ${drName}. Would you like me to analyze them?`,
        }));
      }
    });
    return cleanup;
  }, [dispatch]);

  /* ── Tab switching helpers ───────────────────────────── */

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const handleEntitySearch = useCallback((entity) => {
    setActiveTab('chat');
    dispatch(startStreaming());
    dispatch(sendMessage({ message: `Tell me about "${entity}"` }));
  }, [dispatch]);

  /* ── Multi-DataRoom auto-detection ──────────────────────── */
  // Intercepts outgoing messages: if the text mentions 2+ known DataRoom names,
  // scope is auto-set to multi_dataroom before the message goes to Copilot.
  // Does NOT override a manually set multi_dataroom scope.

  const handleSendWithMultiDRDetection = useCallback((messageText) => {
    if (datarooms && datarooms.length >= 2) {
      const lowerText = messageText.toLowerCase();
      const matched = datarooms.filter(
        (dr) => dr.name && lowerText.includes(dr.name.toLowerCase())
      );
      if (matched.length >= 2) {
        dispatch(setCopilotScope({
          scopeType: 'multi_dataroom',
          scopeIds: matched.map((dr) => dr.id),
          scopeName: matched.map((dr) => dr.name).join(', '),
        }));
      }
    }
    dispatch(startStreaming());
    dispatch(sendMessage({ message: messageText }));
  }, [datarooms, dispatch]);

  /* ── Deleted DataRoom check ──────────────────────────── */

  const scopeIds = useSelector((s) => s.copilot.scopeIds);
  const scopeType = useSelector((s) => s.copilot.scopeType);
  const indexStatus = useSelector((s) => s.copilot.indexStatus);
  const dataroomDeleted =
    scopeType === 'dataroom' &&
    scopeIds?.length > 0 &&
    datarooms.length > 0 &&
    !datarooms.some((dr) => dr.id === scopeIds[0]);

  // Block Copilot only while files are actively being indexed (pending/processing).
  // Failed files don't block — user can retry them manually via the header button.
  const activelyIndexing = (indexStatus?.pending ?? 0) + (indexStatus?.processing ?? 0);
  const notFullyIndexed = activelyIndexing > 0;

  // Copilot is unusable when there are no datarooms, or the current dataroom has no files
  const items = useSelector((s) => s.fileExplorer.items);
  const activeDataroom = useSelector((s) => s.dataroom.activeDataroom);
  const hasNoDatarooms = datarooms.length === 0;
  // A dataroom has no files if: no files in items AND no indexed files AND activeDataroom reports 0 files
  const dataroomFileCount = activeDataroom?.files?.length ?? activeDataroom?.file_count ?? 0;
  const hasFilesInItems = items.some((item) => item.type === 'file');
  const hasIndexedFiles = (indexStatus?.total ?? 0) > 0;
  const isDataroomEmpty = !!currentDataroomId && !hasFilesInItems && !hasIndexedFiles && dataroomFileCount === 0;
  // At DataRoom list level, check if all DataRooms have 0 files
  const allDataroomsEmpty = !currentDataroomId && datarooms.length > 0 && datarooms.every((dr) => (dr.file_count ?? 0) === 0);
  const copilotUnavailable = hasNoDatarooms || isDataroomEmpty || allDataroomsEmpty;

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div
      className={`${styles.panel} ${!isOpen ? styles.panelHidden : ''}`}
      style={isOpen ? { width: panelWidth } : undefined}
    >
      <CopilotHeader />
      {!copilotUnavailable && !notFullyIndexed && <CopilotTabs activeTab={activeTab} onTabChange={handleTabChange} />}

      <div className={styles.content}>
        {copilotUnavailable ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>Orvyn Copilot</h2>
            <p className={styles.emptySubtitle}>
              {hasNoDatarooms
                ? 'Create a DataRoom and add files to start using Copilot.'
                : 'Add files to your DataRoom to start using Copilot.'}
            </p>
          </div>
        ) : dataroomDeleted ? (
          <div className={styles.emptyState}>
            <p className={styles.emptySubtitle}>DataRoom no longer exists</p>
          </div>
        ) : notFullyIndexed ? (
          <CopilotChat />
        ) : (
          <>
            {activeTab === 'chat' && <CopilotChat />}
            {activeTab === 'insights' && (
              <CopilotInsights onEntitySearch={handleEntitySearch} />
            )}
            {activeTab === 'audit' && (
              <CopilotAudit onSwitchTab={handleTabChange} />
            )}
            {activeTab === 'simulate' && (
              <CopilotSimulate onSwitchTab={handleTabChange} />
            )}
          </>
        )}
      </div>

      {!copilotUnavailable && !notFullyIndexed && <CopilotQuickActions onSwitchTab={handleTabChange} />}
      <CopilotInput onSend={handleSendWithMultiDRDetection} disabled={copilotUnavailable} />
    </div>
  );
}

export default CopilotPanel;
