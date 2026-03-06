import { useState } from 'react';
import {
    IconX, IconEmptyFiles, IconFileSmall, IconFolderSmall,
    IconSearch, IconGrid, IconList, IconFilter, IconSort, IconHardDrive,
} from './icons';
import styles from './FileList.module.css';

/* ── Helpers ──────────────────────────────────────────── */

function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getIconClass(ext) {
    switch (ext) {
        case '.pdf': return 'iconPdf';
        case '.doc': case '.docx': return 'iconDocx';
        case '.xls': case '.xlsx': case '.csv': return 'iconXlsx';
        case '.ppt': case '.pptx': return 'iconPptx';
        case '.png': case '.jpg': case '.jpeg': return 'iconImage';
        default: return 'iconDefault';
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

/* ── Component ────────────────────────────────────────── */

function FileList({ files, onRemoveFile, validCount, invalidCount, totalSize, maxFiles }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('list');

    // Count folders (always 0 for upload context, but matches the reference UI)
    const folderCount = 0;

    // Filter files by search query (local UI only)
    const displayFiles = searchQuery.trim()
        ? files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : files;

    return (
        <>
            {/* Search bar + view toggles */}
            <div className={styles.searchBar}>
                <div className={styles.searchInputWrap}>
                    <span className={styles.searchIcon}><IconSearch /></span>
                    <input
                        className={styles.searchInput}
                        type="text"
                        placeholder="Search files and folders..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className={styles.viewToggles}>
                    <button
                        className={`${styles.viewToggle} ${viewMode === 'grid' ? styles.viewToggleActive : ''}`}
                        onClick={() => setViewMode('grid')}
                        type="button"
                        aria-label="Grid view"
                    >
                        <IconGrid />
                    </button>
                    <button
                        className={`${styles.viewToggle} ${viewMode === 'list' ? styles.viewToggleActive : ''}`}
                        onClick={() => setViewMode('list')}
                        type="button"
                        aria-label="List view"
                    >
                        <IconList />
                    </button>
                </div>
            </div>

            {/* Toolbar: file/folder stats + filter/sort */}
            <div className={styles.toolbar}>
                <div className={styles.toolbarStats}>
                    <span className={styles.stat}>
                        <IconFileSmall /> {validCount} files
                    </span>
                    <span className={styles.stat}>
                        <IconFolderSmall /> {folderCount} folders
                    </span>
                    <span className={styles.stat}>
                        <IconHardDrive /> {formatSize(totalSize)}
                    </span>
                </div>
                <div className={styles.toolbarActions}>
                    <button className={styles.toolbarBtn} type="button">
                        <IconFilter /> Filter
                    </button>
                    <button className={styles.toolbarBtn} type="button">
                        <IconSort /> Sort
                    </button>
                </div>
            </div>

            {/* File list or empty state */}
            {displayFiles.length > 0 ? (
                <div className={styles.list}>
                    {displayFiles.map((f) => (
                        <div
                            key={f.path}
                            className={`${styles.item} ${!f.valid ? styles.itemInvalid : ''}`}
                        >
                            <div className={`${styles.itemIcon} ${styles[getIconClass(f.extension)]}`}>
                                {getExtLabel(f.extension).slice(0, 3)}
                            </div>
                            <span className={styles.itemName} title={f.path}>{f.name}</span>
                            <span className={styles.itemSize}>{formatSize(f.size)}</span>
                            {!f.valid && <span className={styles.itemBadge}>Unsupported</span>}
                            <button
                                className={styles.itemRemove}
                                onClick={() => onRemoveFile(f.path)}
                                title="Remove"
                                type="button"
                                aria-label={`Remove ${f.name}`}
                            >
                                <IconX />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}><IconEmptyFiles /></span>
                    <span className={styles.emptyTitle}>No files found</span>
                    <span className={styles.emptyHint}>Upload some files to get started</span>
                </div>
            )}
        </>
    );
}

export default FileList;
