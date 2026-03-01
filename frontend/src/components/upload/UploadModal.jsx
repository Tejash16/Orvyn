import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  registerFiles,
  classifyRegisteredFiles,
  generateNewDataroom,
  resetUploadState,
} from '../../store/fileSlice';
import { fetchDatarooms } from '../../store/dataroomSlice';
import { refreshCurrentView } from '../../store/fileExplorerSlice';
import styles from './UploadModal.module.css';

/* ── Constants ──────────────────────────────────────────── */

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv', '.png', '.jpg', '.jpeg',
]);
const MAX_FILES = 50;

/* ── Helpers ────────────────────────────────────────────── */

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getIconClass(ext) {
  switch (ext) {
    case '.pdf': return 'iconBgPdf';
    case '.doc': case '.docx': return 'iconBgDocx';
    case '.xls': case '.xlsx': case '.csv': return 'iconBgXlsx';
    case '.ppt': case '.pptx': return 'iconBgPptx';
    case '.png': case '.jpg': case '.jpeg': return 'iconBgImage';
    default: return 'iconBgDefault';
  }
}

function getExtLabel(ext) {
  const map = {
    '.pdf': 'PDF', '.docx': 'DOC', '.doc': 'DOC',
    '.xlsx': 'XLS', '.xls': 'XLS', '.csv': 'CSV',
    '.pptx': 'PPT', '.ppt': 'PPT',
    '.png': 'PNG', '.jpg': 'JPG', '.jpeg': 'JPG',
    '.txt': 'TXT',
  };
  return map[ext] || ext.replace('.', '').toUpperCase() || 'FILE';
}

/* ── SVG Icons ──────────────────────────────────────────── */

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconUploadCloud = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

const IconFile = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconFolder = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ── Component ──────────────────────────────────────────── */

function UploadModal({ onClose, initialFiles, currentDataroomId, onViewDataroom }) {
  const dispatch = useDispatch();
  const { datarooms } = useSelector((s) => s.dataroom);
  const uploadModal = useSelector((s) => s.file.uploadModal);

  // ── Local state ──
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [mode, setMode] = useState('custom');
  const [step, setStep] = useState('select'); // 'select' | 'progress' | 'results'
  const [progressStep, setProgressStep] = useState('registering');
  const [targetDataroomId, setTargetDataroomId] = useState(currentDataroomId || '');
  const [aiName, setAiName] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Track result dataroom id for "View DataRoom"
  const [resultDataroomId, setResultDataroomId] = useState(null);

  const bodyRef = useRef(null);

  // ── Load initial files (from drag-and-drop) ──
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      loadPathsInfo(initialFiles);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset upload state on unmount ──
  useEffect(() => {
    return () => {
      dispatch(resetUploadState());
    };
  }, [dispatch]);

  // ── Pre-select target dataroom ──
  useEffect(() => {
    if (currentDataroomId && !targetDataroomId) {
      setTargetDataroomId(currentDataroomId);
    }
  }, [currentDataroomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File loading helper ──
  const loadPathsInfo = useCallback(async (paths) => {
    if (paths.length === 0) return;

    // Enforce max limit across existing + new
    const available = MAX_FILES - selectedFiles.length;
    if (available <= 0) {
      setLocalError(`Maximum ${MAX_FILES} files per batch.`);
      return;
    }

    const pathsToLoad = paths.slice(0, available);
    if (paths.length > available) {
      setLocalError(`Only ${available} more files can be added (limit: ${MAX_FILES}).`);
    }

    const result = await window.api.file.getPathsInfo(pathsToLoad);
    if (!result.success) {
      setLocalError(result.error || 'Failed to read file info.');
      return;
    }

    // De-duplicate by path
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.path));
      const newFiles = result.files.filter((f) => !existing.has(f.path));
      return [...prev, ...newFiles];
    });
  }, [selectedFiles.length]);

  // ── File selection handlers ──

  async function handleSelectFiles() {
    setLocalError(null);
    const result = await window.api.file.selectFiles();
    if (!result.success) {
      setLocalError(result.error);
      return;
    }
    if (result.filePaths.length === 0) return;
    await loadPathsInfo(result.filePaths);
  }

  async function handleSelectFolder() {
    setLocalError(null);
    const result = await window.api.file.selectFolder();
    if (!result.success) {
      setLocalError(result.error);
      return;
    }
    if (result.filePaths.length === 0) return;
    await loadPathsInfo(result.filePaths);
  }

  function handleRemoveFile(filePath) {
    setSelectedFiles((prev) => prev.filter((f) => f.path !== filePath));
    setLocalError(null);
  }

  // ── Drag-and-drop inside modal ──

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setLocalError(null);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const paths = [];
    const folderPaths = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      // In Electron, dropped files have a .path property
      if (f.path) {
        // Check if it's a directory by trying to scan
        // Simple heuristic: no extension likely = folder
        const ext = f.name.lastIndexOf('.');
        if (ext === -1 || f.type === '') {
          folderPaths.push(f.path);
        } else {
          paths.push(f.path);
        }
      }
    }

    // Scan folders for supported files
    for (const fp of folderPaths) {
      const scanResult = await window.api.file.scanFolder(fp);
      if (scanResult.success && scanResult.filePaths) {
        paths.push(...scanResult.filePaths);
      }
    }

    if (paths.length > 0) {
      await loadPathsInfo(paths);
    }
  }

  // ── Classify / Generate ──

  async function handleClassify() {
    const validFiles = selectedFiles.filter((f) => f.valid);
    if (validFiles.length === 0) return;

    setLocalError(null);
    setStep('progress');
    setProgressStep('registering');
    dispatch(resetUploadState());

    const filePaths = validFiles.map((f) => f.path);

    try {
      // Step 1: Register files
      let dataroomId;
      let regResult;

      if (mode === 'custom') {
        dataroomId = targetDataroomId;
        regResult = await dispatch(registerFiles({ dataroomId, filePaths })).unwrap();
      } else {
        // AI mode: create a temporary dataroom first via generateNewDataroom
        // which handles creation + classification in one call.
        // But first we need to register files somewhere.
        // The generate-dataroom endpoint expects file IDs, so we need to register first.
        // For AI mode, we register to a new temp dataroom — but the API creates one.
        // Actually, looking at the flow: generateDataroom expects fileIds.
        // We need to register to get fileIds. Let's register without a dataroom first...
        // The register endpoint requires a dataroom_id. For AI mode, we create one inline.

        // For AI mode, we'll pass the file paths and let the generate endpoint handle it.
        // But the existing API expects file_ids. So we need a two-step:
        // 1. Create a temp dataroom
        // 2. Register files to it
        // 3. Generate dataroom structure
        // Actually, generateDataroom will reorganize files already registered.

        // Simplest approach: create a dataroom with the given name, register files, then generate.
        const createResult = await window.api.dataroom.create({
          name: aiName.trim(),
          description: aiDescription.trim(),
        });

        if (!createResult.success) {
          setLocalError(createResult.error || 'Failed to create DataRoom.');
          setStep('select');
          return;
        }

        dataroomId = createResult.dataroom.id;
        regResult = await dispatch(registerFiles({ dataroomId, filePaths })).unwrap();
      }

      if (!regResult || !regResult.registered) {
        setLocalError('No files were registered.');
        setStep('select');
        return;
      }

      // Step 2: Classify or Generate
      setProgressStep('classifying');

      const registeredIds = regResult.registered.map((f) => f.id);

      if (mode === 'custom') {
        const classResult = await dispatch(classifyRegisteredFiles({
          dataroomId,
          fileIds: registeredIds,
        })).unwrap();

        setResultDataroomId(dataroomId);
        setProgressStep('complete');
        setStep('results');
      } else {
        const genResult = await dispatch(generateNewDataroom({
          name: aiName.trim(),
          description: aiDescription.trim(),
          fileIds: registeredIds,
        })).unwrap();

        setResultDataroomId(genResult.dataroom?.id || dataroomId);
        setProgressStep('complete');
        setStep('results');
      }

      // Refresh dataroom list
      dispatch(fetchDatarooms());
      dispatch(refreshCurrentView());
    } catch (err) {
      setLocalError(typeof err === 'string' ? err : err?.message || 'An error occurred.');
      // Stay on progress screen to show error with retry
    }
  }

  function handleRetry() {
    setLocalError(null);
    dispatch(resetUploadState());
    setStep('select');
    setProgressStep('registering');
  }

  function handleUploadMore() {
    setSelectedFiles([]);
    setLocalError(null);
    dispatch(resetUploadState());
    setStep('select');
    setProgressStep('registering');
    setAiName('');
    setAiDescription('');
  }

  function handleViewDataroom() {
    if (resultDataroomId && onViewDataroom) {
      onViewDataroom(resultDataroomId);
    }
    onClose();
  }

  // ── Derived values ──

  const validCount = selectedFiles.filter((f) => f.valid).length;
  const invalidCount = selectedFiles.length - validCount;

  const canClassify = (() => {
    if (validCount === 0) return false;
    if (mode === 'custom' && !targetDataroomId) return false;
    if (mode === 'ai' && !aiName.trim()) return false;
    return true;
  })();

  // ── Render: File Selection Screen ──

  function renderSelectScreen() {
    return (
      <>
        <div className={styles.body} ref={bodyRef}>
          {/* Drop zone */}
          <div
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span className={styles.dropZoneIcon}><IconUploadCloud /></span>
            <span className={styles.dropZoneText}>
              Drag and drop files or folders here
            </span>
            <div className={styles.selectBtns}>
              <button className={styles.selectBtn} onClick={handleSelectFiles} type="button">
                <IconFile /> Select Files
              </button>
              <button className={styles.selectBtn} onClick={handleSelectFolder} type="button">
                <IconFolder /> Select Folder
              </button>
            </div>
          </div>

          {/* File list */}
          {selectedFiles.length > 0 && (
            <>
              <div className={styles.fileCounter}>
                <span className={styles.fileCountText}>
                  {validCount} file{validCount !== 1 ? 's' : ''} selected
                  {invalidCount > 0 && ` (${invalidCount} unsupported)`}
                </span>
                <span className={styles.fileCountLimit}>{selectedFiles.length} / {MAX_FILES}</span>
              </div>
              <div className={styles.fileList}>
                {selectedFiles.map((f) => (
                  <div
                    key={f.path}
                    className={`${styles.fileItem} ${!f.valid ? styles.fileItemInvalid : ''}`}
                  >
                    <div className={`${styles.fileItemIcon} ${styles[getIconClass(f.extension)]}`}>
                      {getExtLabel(f.extension).slice(0, 3)}
                    </div>
                    <span className={styles.fileItemName} title={f.path}>{f.name}</span>
                    <span className={styles.fileItemSize}>{formatSize(f.size)}</span>
                    {!f.valid && <span className={styles.fileItemBadge}>Unsupported</span>}
                    <button
                      className={styles.fileItemRemove}
                      onClick={() => handleRemoveFile(f.path)}
                      title="Remove"
                      type="button"
                    >
                      <IconX />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Mode selector */}
          {selectedFiles.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Classification Mode</div>
              <div className={styles.modeCards}>
                <button
                  className={`${styles.modeCard} ${mode === 'custom' ? styles.modeCardActive : ''}`}
                  onClick={() => setMode('custom')}
                  type="button"
                >
                  <span className={styles.modeCardTitle}>Custom</span>
                  <span className={styles.modeCardDesc}>
                    Classify into an existing DataRoom&apos;s folder structure
                  </span>
                </button>
                <button
                  className={`${styles.modeCard} ${mode === 'ai' ? styles.modeCardActive : ''}`}
                  onClick={() => setMode('ai')}
                  type="button"
                >
                  <span className={styles.modeCardTitle}>AI Auto-Organize</span>
                  <span className={styles.modeCardDesc}>
                    Let AI create folders and organize your files automatically
                  </span>
                </button>
              </div>

              {/* Mode-specific fields */}
              {mode === 'custom' && (
                <div className={styles.field}>
                  <label className={styles.label}>Target DataRoom</label>
                  <select
                    className={styles.select}
                    value={targetDataroomId}
                    onChange={(e) => setTargetDataroomId(e.target.value)}
                  >
                    <option value="">Select a DataRoom...</option>
                    {datarooms.map((dr) => (
                      <option key={dr.id} value={dr.id}>{dr.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {mode === 'ai' && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      DataRoom Name
                    </label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="e.g. Q4 Financial Reports"
                      value={aiName}
                      onChange={(e) => setAiName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Description <span className={styles.labelHint}>(optional)</span>
                    </label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Describe the purpose of this DataRoom..."
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Errors */}
          {localError && (
            <div className={styles.errorText}>{localError}</div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleClassify}
            disabled={!canClassify}
            type="button"
          >
            Classify {validCount > 0 ? `(${validCount} file${validCount !== 1 ? 's' : ''})` : ''}
          </button>
        </div>
      </>
    );
  }

  // ── Render: Progress Screen ──

  function renderProgressScreen() {
    const steps = [
      { key: 'registering', label: 'Registering' },
      { key: 'classifying', label: mode === 'ai' ? 'Organizing' : 'Classifying' },
      { key: 'complete', label: 'Complete' },
    ];

    const currentIndex = steps.findIndex((s) => s.key === progressStep);
    const hasError = localError || uploadModal.error;

    return (
      <>
        <div className={styles.body}>
          <div className={styles.progressWrap}>
            {/* Step indicator */}
            <div className={styles.stepIndicator}>
              {steps.map((s, i) => (
                <span key={s.key} style={{ display: 'contents' }}>
                  <div className={styles.stepNode}>
                    <div className={`${styles.stepDot} ${
                      i < currentIndex ? styles.stepDotDone
                        : i === currentIndex ? styles.stepDotActive : ''
                    }`}>
                      {i < currentIndex ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className={`${styles.stepLabel} ${
                      i < currentIndex ? styles.stepLabelDone
                        : i === currentIndex ? styles.stepLabelActive : ''
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`${styles.stepLine} ${
                      i < currentIndex ? styles.stepLineDone : ''
                    }`} />
                  )}
                </span>
              ))}
            </div>

            {/* Spinner or error */}
            {hasError ? (
              <div className={styles.errorBox}>
                <div className={styles.errorText}>{localError || uploadModal.error}</div>
                <button className={styles.retryBtn} onClick={handleRetry} type="button">
                  Try Again
                </button>
              </div>
            ) : (
              <div className={styles.progressInfo}>
                <div className={styles.spinner} />
                <span className={styles.progressText}>
                  {progressStep === 'registering' && `Registering ${validCount} files...`}
                  {progressStep === 'classifying' && (mode === 'ai'
                    ? 'AI is organizing your files...'
                    : 'Classifying files into folders...'
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </>
    );
  }

  // ── Render: Results Screen ──

  function renderResultsScreen() {
    const classResult = uploadModal.classificationResult;
    const genResult = uploadModal.generationResult;
    const regResult = uploadModal.registrationResult;

    return (
      <>
        <div className={styles.body}>
          <div className={styles.resultsWrap}>
            <div className={styles.resultsSuccess}>
              <div className={styles.successIcon}><IconCheck /></div>
              <span className={styles.successTitle}>
                {mode === 'ai' ? 'DataRoom Created & Organized' : 'Classification Complete'}
              </span>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
              {regResult && (
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{regResult.total_registered ?? regResult.registered?.length ?? 0}</span>
                  <span className={styles.statLabel}>Registered</span>
                </div>
              )}
              {regResult?.total_rejected > 0 && (
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{regResult.total_rejected}</span>
                  <span className={styles.statLabel}>Rejected</span>
                </div>
              )}

              {mode === 'custom' && classResult && (
                <>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{classResult.classified ?? 0}</span>
                    <span className={styles.statLabel}>Classified</span>
                  </div>
                  {classResult.low_confidence_skipped > 0 && (
                    <div className={styles.statCard}>
                      <span className={styles.statValue}>{classResult.low_confidence_skipped}</span>
                      <span className={styles.statLabel}>Low Confidence</span>
                    </div>
                  )}
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{classResult.time_seconds?.toFixed(1) ?? '—'}s</span>
                    <span className={styles.statLabel}>Time</span>
                  </div>
                </>
              )}

              {mode === 'ai' && genResult && (
                <>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{genResult.folders_created ?? 0}</span>
                    <span className={styles.statLabel}>Folders Created</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{genResult.files_assigned ?? 0}</span>
                    <span className={styles.statLabel}>Files Assigned</span>
                  </div>
                  {genResult.files_unassigned > 0 && (
                    <div className={styles.statCard}>
                      <span className={styles.statValue}>{genResult.files_unassigned}</span>
                      <span className={styles.statLabel}>Unassigned</span>
                    </div>
                  )}
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{genResult.time_seconds?.toFixed(1) ?? '—'}s</span>
                    <span className={styles.statLabel}>Time</span>
                  </div>
                </>
              )}
            </div>

            {/* Classification results breakdown */}
            {mode === 'custom' && classResult?.results && classResult.results.length > 0 && (
              <>
                <div className={styles.sectionLabel}>Folder Breakdown</div>
                <div className={styles.resultsFolders}>
                  {Object.entries(
                    classResult.results.reduce((acc, r) => {
                      const folder = r.assigned_folder || 'Unassigned';
                      acc[folder] = (acc[folder] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([folder, count]) => (
                    <div key={folder} className={styles.resultsFolderItem}>
                      <IconFolder />
                      <span>{folder}</span>
                      <span className={styles.resultsFolderCount}>{count} file{count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={handleUploadMore} type="button">
            Upload More
          </button>
          {resultDataroomId && (
            <button className={styles.btnPrimary} onClick={handleViewDataroom} type="button">
              View DataRoom
            </button>
          )}
          {!resultDataroomId && (
            <button className={styles.btnSecondary} onClick={onClose} type="button">
              Close
            </button>
          )}
        </div>
      </>
    );
  }

  // ── Main render ──

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            {step === 'select' && 'Upload & Classify'}
            {step === 'progress' && 'Processing...'}
            {step === 'results' && 'Results'}
          </h2>
          <button className={styles.closeBtn} onClick={onClose} title="Close" type="button">
            <IconClose />
          </button>
        </div>

        {step === 'select' && renderSelectScreen()}
        {step === 'progress' && renderProgressScreen()}
        {step === 'results' && renderResultsScreen()}
      </div>
    </div>
  );
}

export default UploadModal;
