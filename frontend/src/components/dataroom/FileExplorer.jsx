import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  navigateToDataroom,
  navigateToFolder,
  navigateUp,
  navigateToPathIndex,
  navigateDirect,
  refreshCurrentView,
  setViewMode,
  setSortBy,
  setSortOrder,
  setSearchQuery,
  toggleItemSelection,
  selectAll,
  clearSelection,
} from '../../store/fileExplorerSlice';
import { createFolder } from '../../store/folderSlice';
import {
  selectAndRegisterFiles,
  selectAndRegisterFolder,
  openFile,
  renameFile,
  removeFromDocrack,
  deleteFromSystem,
} from '../../store/fileSlice';
import styles from './FileExplorer.module.css';

/* ── File-type helpers ──────────────────────────────────── */

function getExtension(name) {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function getFileTypeInfo(ext) {
  switch (ext) {
    case 'pdf':
      return { label: 'PDF', iconClass: 'iconBgPdf' };
    case 'doc':
    case 'docx':
      return { label: 'DOCX', iconClass: 'iconBgDocx' };
    case 'xls':
    case 'xlsx':
    case 'csv':
      return { label: 'XLSX', iconClass: 'iconBgXlsx' };
    case 'ppt':
    case 'pptx':
      return { label: 'PPTX', iconClass: 'iconBgPptx' };
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'bmp':
    case 'webp':
    case 'svg':
      return { label: 'IMG', iconClass: 'iconBgImage' };
    default:
      return { label: ext.toUpperCase() || 'FILE', iconClass: 'iconBgDefault' };
  }
}

function formatFileSize(bytes) {
  if (bytes == null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function confidenceColor(score) {
  if (score == null) return null;
  if (score >= 0.7) return '#16a34a';
  if (score >= 0.4) return '#eab308';
  return '#dc2626';
}

/* ── SVG Icons ──────────────────────────────────────────── */

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconForward = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconGrid = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const IconList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const IconFolderPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

const IconUpload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

const IconFolder = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconEmptyFolder = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    className={styles.emptyIcon}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconPencil = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const IconOpen = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

/* ── Component ──────────────────────────────────────────── */

function FileExplorer({ dataroomId, onClose }) {
  const dispatch = useDispatch();
  const {
    currentDataroomId,
    currentFolderId,
    currentPath,
    items,
    selectedItems,
    viewMode,
    sortBy,
    sortOrder,
    searchQuery,
    isLoading,
    error,
  } = useSelector((s) => s.fileExplorer);

  // Back / forward history — local state
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isNavigatingRef = useRef(false);

  // New folder inline form
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderRef = useRef(null);

  // Rename inline
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef(null);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState(null);
  const ctxRef = useRef(null);

  // Dropdown menus
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);

  // ── Navigate to DataRoom on mount / dataroomId change ──
  useEffect(() => {
    if (dataroomId && dataroomId !== currentDataroomId) {
      dispatch(navigateToDataroom(dataroomId));
    }
  }, [dataroomId, currentDataroomId, dispatch]);

  // ── Push history entry after navigation ──
  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }
    if (currentDataroomId && currentPath.length > 0) {
      const entry = { folderId: currentFolderId, path: [...currentPath] };
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, entry];
      });
      setHistoryIndex((prev) => prev + 1);
    }
  }, [currentFolderId, currentPath, currentDataroomId]);

  // ── Focus new folder input ──
  useEffect(() => {
    if (showNewFolder) newFolderRef.current?.focus();
  }, [showNewFolder]);

  // ── Focus rename input ──
  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  // ── Close context menu on outside click ──
  useEffect(() => {
    function handleClick(e) {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null);
    }
    if (ctxMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ctxMenu]);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpenDropdown(null);
    }
    if (openDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdown]);

  // ── Filtered items ──
  const filtered = searchQuery
    ? items.filter((i) => (i.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  // ── Navigation handlers ──

  function goBack() {
    if (historyIndex <= 0) return;
    const target = history[historyIndex - 1];
    isNavigatingRef.current = true;
    setHistoryIndex((i) => i - 1);
    dispatch(navigateDirect({ folderId: target.folderId, path: target.path }));
  }

  function goForward() {
    if (historyIndex >= history.length - 1) return;
    const target = history[historyIndex + 1];
    isNavigatingRef.current = true;
    setHistoryIndex((i) => i + 1);
    dispatch(navigateDirect({ folderId: target.folderId, path: target.path }));
  }

  function goHome() {
    if (currentPath.length <= 1) return;
    dispatch(navigateToPathIndex(0));
  }

  function handleBreadcrumb(index) {
    if (index === currentPath.length - 1) return;
    dispatch(navigateToPathIndex(index));
  }

  function handleItemDoubleClick(item) {
    if (item.type === 'folder') {
      dispatch(navigateToFolder({ folderId: item.id, folderName: item.name }));
    } else {
      dispatch(openFile(item.file_path));
    }
  }

  function handleItemClick(e, item) {
    if (e.ctrlKey || e.metaKey) {
      dispatch(toggleItemSelection({ id: item.id, type: item.type }));
    } else {
      dispatch(clearSelection());
      dispatch(toggleItemSelection({ id: item.id, type: item.type }));
    }
  }

  // ── Context menu ──

  function handleContextMenu(e, item) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, item });
  }

  // ── New folder ──

  function submitNewFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) { setShowNewFolder(false); return; }
    dispatch(createFolder({
      dataroomId: currentDataroomId,
      parentFolderId: currentFolderId,
      name: trimmed,
      context: null,
    }));
    setNewFolderName('');
    setShowNewFolder(false);
  }

  function handleNewFolderKeyDown(e) {
    if (e.key === 'Enter') submitNewFolder();
    if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); }
  }

  // ── Rename ──

  function startRename(item) {
    setRenamingId(item.id);
    setRenameValue(item.name);
    setCtxMenu(null);
  }

  function submitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== items.find((i) => i.id === renamingId)?.name) {
      const item = items.find((i) => i.id === renamingId);
      if (item?.type === 'file') {
        dispatch(renameFile({ fileId: renamingId, newName: trimmed }));
      }
    }
    setRenamingId(null);
  }

  function handleRenameKeyDown(e) {
    if (e.key === 'Enter') submitRename();
    if (e.key === 'Escape') setRenamingId(null);
  }

  // ── Upload ──

  function handleUploadFiles() {
    dispatch(selectAndRegisterFiles(currentDataroomId));
    setOpenDropdown(null);
  }

  function handleUploadFolder() {
    dispatch(selectAndRegisterFolder(currentDataroomId));
    setOpenDropdown(null);
  }

  // ── Sort column click (list view) ──

  function handleSortColumn(col) {
    if (sortBy === col) {
      dispatch(setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      dispatch(setSortBy(col));
      dispatch(setSortOrder('asc'));
    }
  }

  // ── Item icon ──

  function renderItemIcon(item, size) {
    const isGrid = size === 'grid';
    const cls = isGrid ? styles.gridCardIcon : styles.listIcon;

    if (item.type === 'folder') {
      return <div className={`${cls} ${styles.iconBgFolder}`}><IconFolder /></div>;
    }

    const ext = getExtension(item.name);
    const info = getFileTypeInfo(ext);
    return <div className={`${cls} ${styles[info.iconClass]}`}><IconFile /></div>;
  }

  // ── Render: navigation bar ──

  function renderNavBar() {
    return (
      <div className={styles.navBar}>
        <button
          className={styles.navBtn}
          onClick={goBack}
          disabled={historyIndex <= 0}
          title="Back"
          type="button"
        >
          <IconBack />
        </button>
        <button
          className={styles.navBtn}
          onClick={goForward}
          disabled={historyIndex >= history.length - 1}
          title="Forward"
          type="button"
        >
          <IconForward />
        </button>
        <button
          className={styles.navBtn}
          onClick={goHome}
          disabled={currentPath.length <= 1}
          title="Home"
          type="button"
        >
          <IconHome />
        </button>
        <button
          className={styles.navBtn}
          onClick={() => dispatch(refreshCurrentView())}
          title="Refresh"
          type="button"
        >
          <IconRefresh />
        </button>

        <div className={styles.navSep} />

        <div className={styles.breadcrumbs}>
          {currentPath.map((seg, i) => (
            <span key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {i > 0 && <span className={styles.crumbSep}>/</span>}
              <button
                className={`${styles.crumb} ${i === currentPath.length - 1 ? styles.crumbActive : ''}`}
                onClick={() => handleBreadcrumb(i)}
                type="button"
              >
                {seg.name}
              </button>
            </span>
          ))}
        </div>
      </div>
    );
  }

  // ── Render: toolbar ──

  function renderToolbar() {
    return (
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button
            className={styles.toolBtn}
            onClick={() => setShowNewFolder(true)}
            type="button"
          >
            <IconFolderPlus /> New Folder
          </button>

          <div className={styles.dropdownWrap} ref={openDropdown === 'upload' ? dropdownRef : null}>
            <button
              className={`${styles.toolBtn} ${styles.toolBtnPrimary}`}
              onClick={() => setOpenDropdown(openDropdown === 'upload' ? null : 'upload')}
              type="button"
            >
              <IconUpload /> Upload <IconChevronDown />
            </button>
            {openDropdown === 'upload' && (
              <div className={styles.dropdown}>
                <button
                  className={styles.dropdownItem}
                  onClick={handleUploadFiles}
                  type="button"
                >
                  Upload Files
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={handleUploadFolder}
                  type="button"
                >
                  Upload Folder
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <input
            className={styles.toolSearch}
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
          />

          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => dispatch(setViewMode('grid'))}
              title="Grid view"
              type="button"
            >
              <IconGrid />
            </button>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => dispatch(setViewMode('list'))}
              title="List view"
              type="button"
            >
              <IconList />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: selection bar ──

  function renderSelectionBar() {
    if (selectedItems.length === 0) return null;

    return (
      <div className={styles.selectionBar}>
        <span className={styles.selectionCount}>
          {selectedItems.length} selected
        </span>
        <button
          className={styles.selectionBtn}
          onClick={() => dispatch(selectAll())}
          type="button"
        >
          Select All
        </button>
        <button
          className={styles.selectionBtn}
          onClick={() => dispatch(clearSelection())}
          type="button"
        >
          Clear
        </button>
        <div className={styles.selectionActions}>
          <button
            className={`${styles.selectionBtn} ${styles.selectionBtnDanger}`}
            onClick={() => {
              selectedItems.forEach((s) => {
                if (s.type === 'file') dispatch(removeFromDocrack(s.id));
              });
              dispatch(clearSelection());
            }}
            type="button"
          >
            <IconTrash /> Remove
          </button>
        </div>
      </div>
    );
  }

  // ── Render: new folder inline ──

  function renderNewFolderBar() {
    if (!showNewFolder) return null;
    return (
      <div className={styles.newFolderInline}>
        <IconFolderPlus />
        <input
          ref={newFolderRef}
          className={styles.newFolderInput}
          type="text"
          placeholder="Folder name..."
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={handleNewFolderKeyDown}
          onBlur={submitNewFolder}
        />
        <button
          className={`${styles.newFolderBtn} ${styles.newFolderBtnConfirm}`}
          onClick={submitNewFolder}
          type="button"
          title="Create"
        >
          <IconCheck />
        </button>
        <button
          className={`${styles.newFolderBtn} ${styles.newFolderBtnCancel}`}
          onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
          type="button"
          title="Cancel"
        >
          <IconX />
        </button>
      </div>
    );
  }

  // ── Render: grid view ──

  function renderGridView() {
    return (
      <div className={styles.grid}>
        {filtered.map((item) => {
          const isSelected = selectedItems.some((s) => s.id === item.id);
          const confColor = item.type === 'file' ? confidenceColor(item.classification_score) : null;

          return (
            <div
              key={item.id}
              className={`${styles.gridCard} ${isSelected ? styles.gridCardSelected : ''}`}
              onClick={(e) => handleItemClick(e, item)}
              onDoubleClick={() => handleItemDoubleClick(item)}
              onContextMenu={(e) => handleContextMenu(e, item)}
            >
              {confColor && (
                <span
                  className={styles.confidenceDot}
                  style={{ backgroundColor: confColor }}
                  title={`Confidence: ${Math.round((item.classification_score || 0) * 100)}%`}
                />
              )}
              {renderItemIcon(item, 'grid')}
              {renamingId === item.id ? (
                <input
                  ref={renameRef}
                  className={styles.renameInput}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={handleRenameKeyDown}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className={styles.gridCardName}>{item.name}</span>
              )}
              {item.type === 'file' && (
                <span className={styles.gridCardMeta}>{formatFileSize(item.size_bytes)}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render: list view ──

  function renderListView() {
    return (
      <table className={styles.listTable}>
        <thead className={styles.listHeader}>
          <tr>
            <th onClick={() => handleSortColumn('name')}>
              Name
              {sortBy === 'name' && (
                <span className={styles.sortIndicator}>{sortOrder === 'asc' ? '▲' : '▼'}</span>
              )}
            </th>
            <th onClick={() => handleSortColumn('size')} style={{ width: 100 }}>
              Size
              {sortBy === 'size' && (
                <span className={styles.sortIndicator}>{sortOrder === 'asc' ? '▲' : '▼'}</span>
              )}
            </th>
            <th onClick={() => handleSortColumn('date')} style={{ width: 130 }}>
              Modified
              {sortBy === 'date' && (
                <span className={styles.sortIndicator}>{sortOrder === 'asc' ? '▲' : '▼'}</span>
              )}
            </th>
            <th style={{ width: 80 }}>Type</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => {
            const isSelected = selectedItems.some((s) => s.id === item.id);
            const ext = item.type === 'file' ? getExtension(item.name) : '';
            const typeInfo = item.type === 'file' ? getFileTypeInfo(ext) : null;
            const confColor = item.type === 'file' ? confidenceColor(item.classification_score) : null;

            return (
              <tr
                key={item.id}
                className={`${styles.listRow} ${isSelected ? styles.listRowSelected : ''}`}
                onClick={(e) => handleItemClick(e, item)}
                onDoubleClick={() => handleItemDoubleClick(item)}
                onContextMenu={(e) => handleContextMenu(e, item)}
              >
                <td>
                  <div className={styles.listNameCell}>
                    {renderItemIcon(item, 'list')}
                    {renamingId === item.id ? (
                      <input
                        ref={renameRef}
                        className={styles.renameInput}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={submitRename}
                        onKeyDown={handleRenameKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        style={{ textAlign: 'left' }}
                      />
                    ) : (
                      <span className={styles.listFileName}>{item.name}</span>
                    )}
                    {confColor && (
                      <span
                        className={styles.confidenceDot}
                        style={{ backgroundColor: confColor, position: 'static', marginLeft: 6 }}
                        title={`Confidence: ${Math.round((item.classification_score || 0) * 100)}%`}
                      />
                    )}
                  </div>
                </td>
                <td className={styles.listMuted}>
                  {item.type === 'file' ? formatFileSize(item.size_bytes) : '—'}
                </td>
                <td className={styles.listMuted}>
                  {formatDate(item.updated_at || item.created_at)}
                </td>
                <td className={styles.listMuted}>
                  {item.type === 'folder' ? 'Folder' : typeInfo?.label || 'File'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // ── Render: empty state ──

  function renderEmptyState() {
    if (searchQuery) {
      return (
        <div className={styles.emptyState}>
          <IconEmptyFolder />
          <span className={styles.emptyTitle}>No results found</span>
          <span className={styles.emptyHint}>
            No files or folders match &quot;{searchQuery}&quot;
          </span>
        </div>
      );
    }

    return (
      <div className={styles.emptyState}>
        <IconEmptyFolder />
        <span className={styles.emptyTitle}>This folder is empty</span>
        <span className={styles.emptyHint}>
          Create a new folder or upload files to get started.
        </span>
        <div className={styles.emptyAction}>
          <button
            className={styles.toolBtn}
            onClick={() => setShowNewFolder(true)}
            type="button"
          >
            <IconFolderPlus /> New Folder
          </button>
          <button
            className={`${styles.toolBtn} ${styles.toolBtnPrimary}`}
            onClick={handleUploadFiles}
            type="button"
          >
            <IconUpload /> Upload Files
          </button>
        </div>
      </div>
    );
  }

  // ── Render: context menu ──

  function renderContextMenu() {
    if (!ctxMenu) return null;
    const { item } = ctxMenu;

    return (
      <div
        ref={ctxRef}
        className={styles.contextMenu}
        style={{ left: ctxMenu.x, top: ctxMenu.y }}
      >
        {item.type === 'folder' && (
          <button
            className={styles.dropdownItem}
            onClick={() => {
              handleItemDoubleClick(item);
              setCtxMenu(null);
            }}
            type="button"
          >
            <IconOpen /> Open
          </button>
        )}
        {item.type === 'file' && (
          <button
            className={styles.dropdownItem}
            onClick={() => {
              dispatch(openFile(item.file_path));
              setCtxMenu(null);
            }}
            type="button"
          >
            <IconOpen /> Open File
          </button>
        )}
        {item.type === 'file' && (
          <button
            className={styles.dropdownItem}
            onClick={() => { startRename(item); }}
            type="button"
          >
            <IconPencil /> Rename
          </button>
        )}
        <div className={styles.dropdownSep} />
        {item.type === 'file' && (
          <button
            className={`${styles.dropdownItem} ${styles.dropdownDanger}`}
            onClick={() => {
              dispatch(removeFromDocrack(item.id));
              setCtxMenu(null);
            }}
            type="button"
          >
            <IconTrash /> Remove
          </button>
        )}
      </div>
    );
  }

  // ── Main render ──

  return (
    <div className={styles.explorer}>
      {renderNavBar()}
      {renderToolbar()}
      {renderSelectionBar()}
      {renderNewFolderBar()}

      {isLoading ? (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
        </div>
      ) : filtered.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className={styles.content} onClick={() => dispatch(clearSelection())}>
          {viewMode === 'grid' ? renderGridView() : renderListView()}
        </div>
      )}

      {error && (
        <div style={{
          padding: '8px 16px',
          fontSize: '0.8125rem',
          color: 'var(--danger-color)',
          textAlign: 'center',
          flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {renderContextMenu()}
    </div>
  );
}

export default FileExplorer;
