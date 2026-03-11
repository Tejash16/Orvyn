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
  setCopilotScope,
  setSelectedFiles,
  getIndexStatus,
} from '../../store/copilotSlice';
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
  const currentPath = useSelector((s) => s.fileExplorer.currentPath);
  const selectedItems = useSelector((s) => s.fileExplorer.selectedItems);

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
        window.api.copilot.onStreamError(() => {
          dispatch(finalizeStreamMessage({ sources: [] }));
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
    if (!currentDataroomId) return;
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

    // No files selected → scope to DataRoom
    dispatch(setSelectedFiles([]));
    dispatch(setCopilotScope({
      scopeType: 'dataroom',
      scopeIds: [currentDataroomId],
      scopeName: dataroomName,
    }));
    dispatch(getIndexStatus(currentDataroomId));
  }, [currentDataroomId, currentPath, selectedItems, dispatch]);

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

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div
      className={`${styles.panel} ${!isOpen ? styles.panelHidden : ''}`}
      style={isOpen ? { width: panelWidth } : undefined}
    >
      <CopilotHeader />
      <CopilotTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <div className={styles.content}>
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
      </div>

      <CopilotQuickActions onSwitchTab={handleTabChange} />
      <CopilotInput />
    </div>
  );
}

export default CopilotPanel;
