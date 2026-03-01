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
import {
  createFolder,
  renameFolder,
  deleteFolder,
  updateFolderContext,
} from '../../store/folderSlice';
import {
  openFile,
  openFileWith,
  copyFilePath,
  copyFileToClipboard,
  moveFileToFolder,
  renameFile,
  relocateFile,
  removeFromDocrack,
  deleteFromSystem,
} from '../../store/fileSlice';
import { addToast } from '../../store/uiSlice';
import ContextMenu from '../common/ContextMenu';
import FolderPicker from '../common/FolderPicker';
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

const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconMove = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <polyline points="12 11 12 17" /><polyline points="9 14 12 17 15 14" />
  </svg>
);

const IconLink = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconFileText = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

/* ── Component ──────────────────────────────────────────── */

function FileExplorer({ dataroomId, onClose, onOpenUpload }) {
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
  const [renamingType, setRenamingType] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef(null);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState(null);

  // Dropdown menus
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);

  // Folder picker (Move to Folder)
  const [folderPickerTarget, setFolderPickerTarget] = useState(null);

  // Confirmation dialogs
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState(null);

  // Subfolder dialog
  const [subfolderDialog, setSubfolderDialog] = useState(null);
  const [subfolderName, setSubfolderName] = useState('');
  const [subfolderContext, setSubfolderContext] = useState('');
  const subfolderRef = useRef(null);

  // Edit description dialog
  const [editDescDialog, setEditDescDialog] = useState(null);
  const [editDescValue, setEditDescValue] = useState('');
  const editDescRef = useRef(null);

  // Drag-and-drop
  const [isDragOver, setIsDragOver] = useState(false);

  // Ref for keyboard shortcuts
  const explorerRef = useRef(null);

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

  // ── Focus inputs ──
  useEffect(() => {
    if (showNewFolder) newFolderRef.current?.focus();
  }, [showNewFolder]);

  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    if (subfolderDialog && subfolderRef.current) subfolderRef.current.focus();
  }, [subfolderDialog]);

  useEffect(() => {
    if (editDescDialog && editDescRef.current) editDescRef.current.focus();
  }, [editDescDialog]);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpenDropdown(null);
    }
    if (openDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdown]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e) {
      // Don't handle if inside an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      // Don't handle if a modal is open
      if (folderPickerTarget || removeConfirm || deleteConfirm || deleteFolderConfirm || subfolderDialog || editDescDialog) return;

      const selected = selectedItems.length === 1
        ? items.find((it) => it.id === selectedItems[0].id)
        : null;

      if (e.key === 'Escape') {
        if (ctxMenu) { setCtxMenu(null); return; }
        dispatch(clearSelection());
        return;
      }

      if (e.key === 'Delete' && selected) {
        e.preventDefault();
        if (selected.type === 'file') {
          setRemoveConfirm(selected);
        } else {
          setDeleteFolderConfirm(selected);
        }
        return;
      }

      if (e.key === 'F2' && selected) {
        e.preventDefault();
        startRename(selected);
        return;
      }

      if (e.key === 'Enter' && selected) {
        e.preventDefault();
        handleItemDoubleClick(selected);
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        dispatch(navigateUp());
        return;
      }

      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        dispatch(selectAll());
        return;
      }

      if (e.ctrlKey && e.key === 'c' && selected && selected.type === 'file') {
        e.preventDefault();
        dispatch(copyFilePath(selected.file_path));
        dispatch(addToast({ message: 'Path copied', type: 'info' }));
        return;
      }
    }

    const el = explorerRef.current;
    if (el) {
      el.addEventListener('keydown', handleKeyDown);
      return () => el.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedItems, items, ctxMenu, folderPickerTarget, removeConfirm, deleteConfirm, deleteFolderConfirm, subfolderDialog, editDescDialog, dispatch]);

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
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, item });
  }

  function handleBackgroundContextMenu(e) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, item: null });
  }

  function buildFileContextMenuItems(item) {
    return [
      { type: 'action', label: 'Open', icon: <IconOpen />, shortcut: 'Enter', onClick: () => dispatch(openFile(item.file_path)) },
      { type: 'action', label: 'Open With...', icon: <IconOpen />, onClick: () => dispatch(openFileWith(item.file_path)) },
      { type: 'separator' },
      { type: 'action', label: 'Copy', icon: <IconCopy />, onClick: () => { dispatch(copyFileToClipboard(item.file_path)); dispatch(addToast({ message: 'File copied to clipboard', type: 'success' })); } },
      { type: 'action', label: 'Copy Path', icon: <IconCopy />, shortcut: 'Ctrl+C', onClick: () => { dispatch(copyFilePath(item.file_path)); dispatch(addToast({ message: 'Path copied', type: 'info' })); } },
      { type: 'separator' },
      { type: 'action', label: 'Move to Folder...', icon: <IconMove />, onClick: () => setFolderPickerTarget(item) },
      { type: 'separator' },
      { type: 'action', label: 'Rename', icon: <IconPencil />, shortcut: 'F2', onClick: () => startRename(item) },
      { type: 'action', label: 'Relocate', icon: <IconLink />, onClick: () => { dispatch(relocateFile(item.id)); dispatch(addToast({ message: 'File relocated', type: 'success' })); } },
      { type: 'separator' },
      { type: 'action', label: 'Remove from DocRack', icon: <IconTrash />, danger: true, shortcut: 'Del', onClick: () => setRemoveConfirm(item) },
      { type: 'action', label: 'Delete from System', icon: <IconTrash />, danger: true, onClick: () => setDeleteConfirm(item) },
    ];
  }

  function buildFolderContextMenuItems(item) {
    return [
      { type: 'action', label: 'Open', icon: <IconOpen />, shortcut: 'Enter', onClick: () => dispatch(navigateToFolder({ folderId: item.id, folderName: item.name })) },
      { type: 'separator' },
      { type: 'action', label: 'New Subfolder', icon: <IconFolderPlus />, onClick: () => { setSubfolderDialog(item); setSubfolderName(''); setSubfolderContext(''); } },
      { type: 'separator' },
      { type: 'action', label: 'Rename', icon: <IconPencil />, shortcut: 'F2', onClick: () => startRename(item) },
      { type: 'action', label: 'Edit Description', icon: <IconFileText />, onClick: () => { setEditDescDialog(item); setEditDescValue(item.context || ''); } },
      { type: 'separator' },
      { type: 'action', label: 'Delete Folder', icon: <IconTrash />, danger: true, shortcut: 'Del', onClick: () => setDeleteFolderConfirm(item) },
    ];
  }

  function buildBackgroundContextMenuItems() {
    return [
      { type: 'action', label: 'New Folder', icon: <IconFolderPlus />, onClick: () => setShowNewFolder(true) },
      { type: 'action', label: 'Upload Files', icon: <IconUpload />, onClick: () => { if (onOpenUpload) onOpenUpload('files'); } },
      { type: 'action', label: 'Upload Folder', icon: <IconUpload />, onClick: () => { if (onOpenUpload) onOpenUpload('folder'); } },
      { type: 'separator' },
      { type: 'label', text: 'View' },
      { type: 'action', label: viewMode === 'grid' ? 'Switch to List' : 'Switch to Grid', icon: viewMode === 'grid' ? <IconList /> : <IconGrid />, onClick: () => dispatch(setViewMode(viewMode === 'grid' ? 'list' : 'grid')) },
      { type: 'separator' },
      { type: 'action', label: 'Refresh', icon: <IconRefresh />, onClick: () => dispatch(refreshCurrentView()) },
    ];
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
    setRenamingType(item.type);
    setRenameValue(item.name);
    setCtxMenu(null);
  }

  function submitRename() {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    const item = items.find((i) => i.id === renamingId);
    if (item && trimmed !== item.name) {
      if (renamingType === 'file') {
        dispatch(renameFile({ fileId: renamingId, newName: trimmed }));
      } else {
        dispatch(renameFolder({ folderId: renamingId, newName: trimmed }));
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
    setOpenDropdown(null);
    if (onOpenUpload) onOpenUpload('files');
  }

  function handleUploadFolder() {
    setOpenDropdown(null);
    if (onOpenUpload) onOpenUpload('folder');
  }

  // ── Drag-and-drop ──

  function handleExplorerDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }

  function handleExplorerDragLeave(e) {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }

  async function handleExplorerDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const paths = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].path) paths.push(files[i].path);
    }
    if (paths.length > 0 && onOpenUpload) {
      onOpenUpload('drop', paths);
    }
  }

  // ── Move to Folder ──

  function handleMoveToFolder(folderId) {
    if (!folderPickerTarget) return;
    dispatch(moveFileToFolder({ fileId: folderPickerTarget.id, folderId }));
    dispatch(addToast({ message: `Moved "${folderPickerTarget.name}"`, type: 'success' }));
    setFolderPickerTarget(null);
  }

  // ── Confirmations ──

  function confirmRemove() {
    if (!removeConfirm) return;
    dispatch(removeFromDocrack(removeConfirm.id));
    dispatch(addToast({ message: `Removed "${removeConfirm.name}"`, type: 'info' }));
    setRemoveConfirm(null);
  }

  function confirmDeleteFromSystem() {
    if (!deleteConfirm) return;
    if (deleteConfirmName !== deleteConfirm.name) return;
    dispatch(deleteFromSystem(deleteConfirm.id));
    dispatch(addToast({ message: `Deleted "${deleteConfirm.name}" from system`, type: 'info' }));
    setDeleteConfirm(null);
    setDeleteConfirmName('');
  }

  function confirmDeleteFolder() {
    if (!deleteFolderConfirm) return;
    dispatch(deleteFolder(deleteFolderConfirm.id));
    dispatch(addToast({ message: `Deleted folder "${deleteFolderConfirm.name}"`, type: 'info' }));
    setDeleteFolderConfirm(null);
  }

  // ── Subfolder ──

  function submitSubfolder() {
    const trimmed = subfolderName.trim();
    if (!trimmed || !subfolderDialog) return;
    dispatch(createFolder({
      dataroomId: currentDataroomId,
      parentFolderId: subfolderDialog.id,
      name: trimmed,
      context: subfolderContext.trim() || null,
    }));
    dispatch(addToast({ message: `Created subfolder "${trimmed}"`, type: 'success' }));
    setSubfolderDialog(null);
  }

  // ── Edit description ──

  function submitEditDesc() {
    if (!editDescDialog) return;
    dispatch(updateFolderContext({ folderId: editDescDialog.id, context: editDescValue.trim() }));
    dispatch(addToast({ message: 'Description updated', type: 'success' }));
    setEditDescDialog(null);
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
        <button className={styles.navBtn} onClick={goBack} disabled={historyIndex <= 0} title="Back" type="button"><IconBack /></button>
        <button className={styles.navBtn} onClick={goForward} disabled={historyIndex >= history.length - 1} title="Forward" type="button"><IconForward /></button>
        <button className={styles.navBtn} onClick={goHome} disabled={currentPath.length <= 1} title="Home" type="button"><IconHome /></button>
        <button className={styles.navBtn} onClick={() => dispatch(refreshCurrentView())} title="Refresh" type="button"><IconRefresh /></button>

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
          <button className={styles.toolBtn} onClick={() => setShowNewFolder(true)} type="button">
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
                <button className={styles.dropdownItem} onClick={handleUploadFiles} type="button">Upload Files</button>
                <button className={styles.dropdownItem} onClick={handleUploadFolder} type="button">Upload Folder</button>
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
            ><IconGrid /></button>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => dispatch(setViewMode('list'))}
              title="List view"
              type="button"
            ><IconList /></button>
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
        <span className={styles.selectionCount}>{selectedItems.length} selected</span>
        <button className={styles.selectionBtn} onClick={() => dispatch(selectAll())} type="button">Select All</button>
        <button className={styles.selectionBtn} onClick={() => dispatch(clearSelection())} type="button">Clear</button>
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
        <button className={`${styles.newFolderBtn} ${styles.newFolderBtnConfirm}`} onClick={submitNewFolder} type="button" title="Create"><IconCheck /></button>
        <button className={`${styles.newFolderBtn} ${styles.newFolderBtnCancel}`} onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} type="button" title="Cancel"><IconX /></button>
      </div>
    );
  }

  // ── Render inline rename ──

  function renderInlineRename(item) {
    if (renamingId !== item.id) return null;
    return (
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
              {renamingId === item.id ? renderInlineRename(item) : (
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
              {sortBy === 'name' && <span className={styles.sortIndicator}>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
            </th>
            <th onClick={() => handleSortColumn('size')} style={{ width: 100 }}>
              Size
              {sortBy === 'size' && <span className={styles.sortIndicator}>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
            </th>
            <th onClick={() => handleSortColumn('date')} style={{ width: 130 }}>
              Modified
              {sortBy === 'date' && <span className={styles.sortIndicator}>{sortOrder === 'asc' ? '▲' : '▼'}</span>}
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
                <td className={styles.listMuted}>{item.type === 'file' ? formatFileSize(item.size_bytes) : '—'}</td>
                <td className={styles.listMuted}>{formatDate(item.updated_at || item.created_at)}</td>
                <td className={styles.listMuted}>{item.type === 'folder' ? 'Folder' : typeInfo?.label || 'File'}</td>
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
          <button className={styles.toolBtn} onClick={() => setShowNewFolder(true)} type="button">
            <IconFolderPlus /> New Folder
          </button>
          <button className={`${styles.toolBtn} ${styles.toolBtnPrimary}`} onClick={handleUploadFiles} type="button">
            <IconUpload /> Upload Files
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ──

  return (
    <div
      ref={explorerRef}
      className={styles.explorer}
      tabIndex={-1}
      onDragOver={handleExplorerDragOver}
      onDragLeave={handleExplorerDragLeave}
      onDrop={handleExplorerDrop}
    >
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
        <div
          className={styles.content}
          onClick={() => dispatch(clearSelection())}
          onContextMenu={handleBackgroundContextMenu}
        >
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

      {/* Drag-and-drop overlay */}
      {isDragOver && (
        <div className={styles.dropOverlay}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
          <span>Drop files here to upload &amp; classify</span>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={
            ctxMenu.item === null
              ? buildBackgroundContextMenuItems()
              : ctxMenu.item.type === 'file'
                ? buildFileContextMenuItems(ctxMenu.item)
                : buildFolderContextMenuItems(ctxMenu.item)
          }
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Folder picker modal */}
      {folderPickerTarget && (
        <FolderPicker
          dataroomId={currentDataroomId}
          dataroomName={currentPath[0]?.name || 'DataRoom'}
          currentFolderId={currentFolderId}
          onSelect={handleMoveToFolder}
          onClose={() => setFolderPickerTarget(null)}
        />
      )}

      {/* Remove from DocRack confirmation */}
      {removeConfirm && (
        <div className={styles.confirmBackdrop} onClick={() => setRemoveConfirm(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Remove from DocRack</h3>
            <p className={styles.confirmText}>
              Remove &quot;{removeConfirm.name}&quot; from DocRack?
              The file will NOT be deleted from your computer.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmBtnSecondary} onClick={() => setRemoveConfirm(null)} type="button">Cancel</button>
              <button className={styles.confirmBtnDanger} onClick={confirmRemove} type="button">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete from System — double confirmation */}
      {deleteConfirm && (
        <div className={styles.confirmBackdrop} onClick={() => { setDeleteConfirm(null); setDeleteConfirmName(''); }}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Delete from System</h3>
            <p className={styles.confirmText}>
              This will <strong>PERMANENTLY DELETE</strong> &quot;{deleteConfirm.name}&quot; from your computer.
              This cannot be undone.
            </p>
            <p className={styles.confirmText} style={{ marginTop: 12 }}>
              Type the filename to confirm:
            </p>
            <input
              className={styles.confirmInput}
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={deleteConfirm.name}
              autoFocus
            />
            <div className={styles.confirmActions}>
              <button className={styles.confirmBtnSecondary} onClick={() => { setDeleteConfirm(null); setDeleteConfirmName(''); }} type="button">Cancel</button>
              <button
                className={styles.confirmBtnDanger}
                onClick={confirmDeleteFromSystem}
                disabled={deleteConfirmName !== deleteConfirm.name}
                type="button"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete folder confirmation */}
      {deleteFolderConfirm && (
        <div className={styles.confirmBackdrop} onClick={() => setDeleteFolderConfirm(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Delete Folder</h3>
            <p className={styles.confirmText}>
              Delete &quot;{deleteFolderConfirm.name}&quot;?
              All files inside will become unclassified.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmBtnSecondary} onClick={() => setDeleteFolderConfirm(null)} type="button">Cancel</button>
              <button className={styles.confirmBtnDanger} onClick={confirmDeleteFolder} type="button">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* New subfolder dialog */}
      {subfolderDialog && (
        <div className={styles.confirmBackdrop} onClick={() => setSubfolderDialog(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>New Subfolder in &quot;{subfolderDialog.name}&quot;</h3>
            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Name</label>
              <input
                ref={subfolderRef}
                className={styles.confirmInput}
                type="text"
                value={subfolderName}
                onChange={(e) => setSubfolderName(e.target.value)}
                placeholder="Folder name..."
                onKeyDown={(e) => { if (e.key === 'Enter') submitSubfolder(); if (e.key === 'Escape') setSubfolderDialog(null); }}
              />
            </div>
            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <textarea
                className={styles.confirmTextarea}
                value={subfolderContext}
                onChange={(e) => setSubfolderContext(e.target.value)}
                placeholder="What kind of files go here..."
                rows={2}
              />
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmBtnSecondary} onClick={() => setSubfolderDialog(null)} type="button">Cancel</button>
              <button className={styles.confirmBtnPrimary} onClick={submitSubfolder} disabled={!subfolderName.trim()} type="button">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit description dialog */}
      {editDescDialog && (
        <div className={styles.confirmBackdrop} onClick={() => setEditDescDialog(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Edit Description — &quot;{editDescDialog.name}&quot;</h3>
            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Description</label>
              <textarea
                ref={editDescRef}
                className={styles.confirmTextarea}
                value={editDescValue}
                onChange={(e) => setEditDescValue(e.target.value)}
                placeholder="Describe what kind of files belong in this folder..."
                rows={3}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) submitEditDesc(); if (e.key === 'Escape') setEditDescDialog(null); }}
              />
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmBtnSecondary} onClick={() => setEditDescDialog(null)} type="button">Cancel</button>
              <button className={styles.confirmBtnPrimary} onClick={submitEditDesc} type="button">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileExplorer;
