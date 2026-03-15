import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  registerFiles,
  classifyRegisteredFiles,
  generateNewDataroom,
  resetUploadState,
} from '../store/fileSlice';
import { fetchDatarooms } from '../store/dataroomSlice';
import { refreshCurrentView } from '../store/fileExplorerSlice';
import {
  setActivePage,
  clearUploadPageState,
  setPendingViewDataroomId,
} from '../store/uiSlice';

import DropZone from '../components/upload/DropZone';
import FileList from '../components/upload/FileList';
import ClassificationModeSelector from '../components/upload/ClassificationModeSelector';
import ProgressView from '../components/upload/ProgressView';
import ResultsView from '../components/upload/ResultsView';

import styles from './UploadPage.module.css';

/* ── Constants ──────────────────────────────────────────── */

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv', '.png', '.jpg', '.jpeg',
]);
const MAX_FILES = 70;

/* ── Component ──────────────────────────────────────────── */

function UploadPage() {
  const dispatch = useDispatch();
  const { datarooms } = useSelector((s) => s.dataroom);
  const uploadModal = useSelector((s) => s.file.uploadModal);
  const uploadInitialFiles = useSelector((s) => s.ui.uploadInitialFiles);
  const uploadPreselectedDataroomId = useSelector((s) => s.ui.uploadPreselectedDataroomId);

  // ── Local state ──
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [mode, setMode] = useState('custom');
  const [step, setStep] = useState('select'); // 'select' | 'progress' | 'results'
  const [progressStep, setProgressStep] = useState('registering');
  const [targetDataroomId, setTargetDataroomId] = useState(uploadPreselectedDataroomId || '');
  const [aiName, setAiName] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [resultDataroomId, setResultDataroomId] = useState(null);

  // ── Read initial files from Redux on mount, then clear ──
  useEffect(() => {
    if (uploadInitialFiles && uploadInitialFiles.length > 0) {
      loadPathsInfo(uploadInitialFiles);
    }
    dispatch(clearUploadPageState());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset upload state on unmount ──
  useEffect(() => {
    return () => {
      dispatch(resetUploadState());
    };
  }, [dispatch]);

  // ── File loading helper ──
  const loadPathsInfo = useCallback(async (paths) => {
    if (paths.length === 0) return;

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

  // ── Drag-and-drop ──

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

    const items = e.dataTransfer.items;
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const paths = [];
    const folderPaths = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.path) continue;

      // Use webkitGetAsEntry for reliable folder vs file detection
      const entry = items?.[i]?.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        folderPaths.push(file.path);
      } else {
        paths.push(file.path);
      }
    }

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

  // ── Navigation helpers ──

  function handleCancel() {
    setSelectedFiles([]);
    setLocalError(null);
    setMode('custom');
    setTargetDataroomId('');
    setAiName('');
    setAiDescription('');
    setResultDataroomId(null);
    dispatch(resetUploadState());
    setStep('select');
    setProgressStep('registering');
  }

  function handleViewDataroom() {
    if (resultDataroomId) {
      dispatch(setPendingViewDataroomId(resultDataroomId));
    }
    dispatch(setActivePage('dataroom'));
  }

  function handleBackToDatarooms() {
    dispatch(setActivePage('dataroom'));
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
      let dataroomId;
      let regResult;

      if (mode === 'custom') {
        dataroomId = targetDataroomId;
        regResult = await dispatch(registerFiles({ dataroomId, filePaths })).unwrap();
      } else {
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

      setProgressStep('classifying');

      const registeredIds = regResult.registered.map((f) => f.id);

      if (mode === 'custom') {
        await dispatch(classifyRegisteredFiles({
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

      dispatch(fetchDatarooms());
      dispatch(refreshCurrentView());
    } catch (err) {
      setLocalError(typeof err === 'string' ? err : err?.message || 'An error occurred.');
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
    setResultDataroomId(null);
  }

  // ── Derived values ──

  const validCount = selectedFiles.filter((f) => f.valid).length;
  const invalidCount = selectedFiles.length - validCount;
  const totalSize = selectedFiles.reduce((sum, f) => sum + (f.size || 0), 0);

  const canClassify = (() => {
    if (validCount === 0) return false;
    if (mode === 'custom' && !targetDataroomId) return false;
    if (mode === 'ai' && !aiName.trim()) return false;
    return true;
  })();

  // ── Main render ──

  return (
    <div
      className={styles.page}
      onDragOver={step === 'select' ? handleDragOver : undefined}
      onDragLeave={step === 'select' ? handleDragLeave : undefined}
      onDrop={step === 'select' ? handleDrop : undefined}
    >
      {/* Full-page drag overlay */}
      {isDragOver && step === 'select' && (
        <div className={styles.dragOverlay}>
          <div className={styles.dragOverlayContent}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
            <span className={styles.dragOverlayTitle}>Drop files here</span>
            <span className={styles.dragOverlayText}>Release to add files to the upload queue</span>
          </div>
        </div>
      )}

      {/* ── Select Screen (always visible) ── */}
      <div className={styles.content}>
        <div className={styles.selectLayout}>
          {/* Left Panel: File Browser */}
          <div className={styles.leftPanel}>
            <FileList
              files={selectedFiles}
              onRemoveFile={handleRemoveFile}
              validCount={validCount}
              invalidCount={invalidCount}
              totalSize={totalSize}
              maxFiles={MAX_FILES}
            />
          </div>

          {/* Right Panel: Upload & Configure */}
          <div className={styles.rightPanel}>
            <DropZone
              onSelectFiles={handleSelectFiles}
              onSelectFolder={handleSelectFolder}
              isDragOver={isDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />

            <ClassificationModeSelector
              mode={mode}
              onModeChange={setMode}
              targetDataroomId={targetDataroomId}
              onTargetChange={setTargetDataroomId}
              aiName={aiName}
              onAiNameChange={setAiName}
              aiDescription={aiDescription}
              onAiDescriptionChange={setAiDescription}
              datarooms={datarooms}
            />

            {/* Status card */}
            <div className={styles.statusCard}>
              <div className={styles.statusHeader}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className={styles.statusTitle}>
                  {mode === 'ai' ? 'AI Organization' : 'Custom Classification'}
                </span>
              </div>
              <span className={styles.statusSubtitle}>
                {mode === 'ai' ? 'Upload files to start organizing' : 'Upload files to start classifying'}
              </span>

              {validCount === 0 ? (
                <>
                  <div className={styles.statusInfo}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    No files uploaded yet
                  </div>
                  <div className={styles.statusGhost}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    Upload Files First
                  </div>
                </>
              ) : (
                <div className={styles.statusActions}>
                  <button className={styles.btnSecondary} onClick={handleCancel} type="button">
                    Cancel
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleClassify}
                    disabled={!canClassify}
                    type="button"
                  >
                    Classify {validCount} file{validCount !== 1 ? 's' : ''}
                  </button>
                </div>
              )}

              <div className={styles.statusHint}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                {validCount === 0
                  ? 'Upload files using the upload zone above to get started'
                  : `${validCount} file${validCount !== 1 ? 's' : ''} ready for ${mode === 'ai' ? 'AI organization' : 'classification'}`
                }
              </div>
            </div>

            {/* Error bar */}
            {localError && step === 'select' && (
              <div className={styles.errorBar}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {localError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress Modal ── */}
      {step === 'progress' && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <ProgressView
              progressStep={progressStep}
              mode={mode}
              validCount={validCount}
              error={localError || uploadModal.error}
              onRetry={handleRetry}
            />
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={handleCancel} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Results Modal ── */}
      {step === 'results' && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <ResultsView
              mode={mode}
              uploadModal={uploadModal}
            />
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={handleBackToDatarooms} type="button">
                Back to DataRooms
              </button>
              <button className={styles.btnSecondary} onClick={handleUploadMore} type="button">
                Upload More
              </button>
              {resultDataroomId && (
                <button className={styles.btnPrimary} onClick={handleViewDataroom} type="button">
                  View DataRoom
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadPage;
