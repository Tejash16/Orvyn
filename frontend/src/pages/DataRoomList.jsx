import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchDatarooms,
  updateDataroom,
  deleteDataroom,
} from '../store/dataroomSlice';
import CreateDataRoomModal from '../components/dataroom/CreateDataRoomModal';
import FileExplorer from '../components/dataroom/FileExplorer';
import styles from './DataRoomList.module.css';

/* ── Icons ───────────────────────────────────────────────── */

const IconDataRoom = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const IconDots = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const IconStar = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconPencil = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconEmptyBox = () => (
  <svg className={styles.emptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

/* ── Component ───────────────────────────────────────────── */

function DataRoomList() {
  const dispatch = useDispatch();
  const { datarooms, isLoading } = useSelector((s) => s.dataroom);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Favorites — visual only, local state (V1)
  const [favorites, setFavorites] = useState(new Set());

  // Inline rename
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef(null);

  // Dropdown menu
  const [menuOpenId, setMenuOpenId] = useState(null);
  const menuRef = useRef(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Fetch DataRooms on mount
  useEffect(() => {
    dispatch(fetchDatarooms());
  }, [dispatch]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    }
    if (menuOpenId) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpenId]);

  // ── Filtered list ──────────────────────────────────────

  const filtered = datarooms.filter((dr) =>
    dr.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Handlers ───────────────────────────────────────────

  function handleSelect(id) {
    setSelectedId(id);
    setMenuOpenId(null);
  }

  function handleToggleStar(e, id) {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleMenuToggle(e, id) {
    e.stopPropagation();
    setMenuOpenId((prev) => (prev === id ? null : id));
  }

  function startRename(dr) {
    setRenamingId(dr.id);
    setRenameValue(dr.name);
    setMenuOpenId(null);
  }

  function submitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== datarooms.find((d) => d.id === renamingId)?.name) {
      dispatch(updateDataroom({ id: renamingId, updates: { name: trimmed } }));
    }
    setRenamingId(null);
  }

  function handleRenameKeyDown(e) {
    if (e.key === 'Enter') submitRename();
    if (e.key === 'Escape') setRenamingId(null);
  }

  function startDelete(dr) {
    setDeleteTarget(dr);
    setMenuOpenId(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    dispatch(deleteDataroom(deleteTarget.id));
    if (selectedId === deleteTarget.id) setSelectedId(null);
    setDeleteTarget(null);
  }

  function handleCreated(dataroomId) {
    setSelectedId(dataroomId);
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className={styles.container}>
      {/* ── Left panel ─────────────────────────────────── */}
      <div className={styles.listPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Data Rooms</span>
          <span className={styles.panelCount}>{datarooms.length}</span>
        </div>

        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search data rooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className={styles.loadingList}>
            <div className={styles.loadingDots}>
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} />
            </div>
          </div>
        ) : (
          <div className={styles.dataroomList}>
            {filtered.map((dr) => (
              <div
                key={dr.id}
                className={`${styles.dataroomItem} ${
                  selectedId === dr.id ? styles.dataroomItemActive : ''
                }`}
                onClick={() => handleSelect(dr.id)}
              >
                <div className={styles.drIcon}>
                  <IconDataRoom />
                </div>

                <div className={styles.drInfo}>
                  {renamingId === dr.id ? (
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
                    <span className={styles.drName}>{dr.name}</span>
                  )}
                  {dr.description && (
                    <span className={styles.drDesc}>{dr.description}</span>
                  )}
                  <div className={styles.drMeta}>
                    <span>{dr.folder_count ?? 0} folders</span>
                    <span>{dr.file_count ?? 0} files</span>
                  </div>
                </div>

                <button
                  className={`${styles.starBtn} ${
                    favorites.has(dr.id) ? styles.starBtnActive : ''
                  }`}
                  onClick={(e) => handleToggleStar(e, dr.id)}
                  title={favorites.has(dr.id) ? 'Unfavorite' : 'Favorite'}
                  type="button"
                >
                  <IconStar filled={favorites.has(dr.id)} />
                </button>

                <button
                  className={`${styles.menuBtn} ${
                    menuOpenId === dr.id ? styles.menuBtnOpen : ''
                  }`}
                  onClick={(e) => handleMenuToggle(e, dr.id)}
                  title="Options"
                  type="button"
                >
                  <IconDots />
                </button>

                {menuOpenId === dr.id && (
                  <div
                    className={styles.dropdown}
                    ref={menuRef}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={styles.dropdownItem}
                      onClick={() => startRename(dr)}
                      type="button"
                    >
                      <IconPencil /> Rename
                    </button>
                    <button
                      className={`${styles.dropdownItem} ${styles.dropdownDanger}`}
                      onClick={() => startDelete(dr)}
                      type="button"
                    >
                      <IconTrash /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}

            {!isLoading && filtered.length === 0 && datarooms.length > 0 && (
              <div className={styles.emptyState} style={{ padding: '24px 16px' }}>
                <span className={styles.emptyHint}>No data rooms match your search.</span>
              </div>
            )}
          </div>
        )}

        <div className={styles.newBtnWrap}>
          <button
            className={styles.newBtn}
            onClick={() => setShowCreateModal(true)}
            type="button"
          >
            <IconPlus /> New Data Room
          </button>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────── */}
      <div className={styles.mainPanel}>
        {selectedId ? (
          <FileExplorer
            dataroomId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className={styles.emptyState}>
            <IconEmptyBox />
            <span className={styles.emptyTitle}>Select a DataRoom or create a new one</span>
            <span className={styles.emptyHint}>
              Choose a data room from the left panel to view its contents.
            </span>
          </div>
        )}
      </div>

      {/* ── Create modal ───────────────────────────────── */}
      {showCreateModal && (
        <CreateDataRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}

      {/* ── Delete confirmation ────────────────────────── */}
      {deleteTarget && (
        <div className={styles.confirmBackdrop} onClick={() => setDeleteTarget(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Delete DataRoom</h3>
            <p className={styles.confirmText}>
              Are you sure you want to delete &quot;{deleteTarget.name}&quot;?
              This will remove all folders, files, and classifications within it.
              This action cannot be undone.
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={styles.btnDanger}
                onClick={confirmDelete}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataRoomList;
