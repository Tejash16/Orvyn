# CLAUDE-FRONTEND.md — Frontend Reference

Read this file when working in `frontend/`. Always read the main `CLAUDE.md` first.

---

## UI Architecture Rules (Redux & Theme)

Orvyn uses Redux as the official global state management layer.

### Redux Rules

- Redux is the only permitted global state manager.
- Claude must NOT introduce alternative state libraries (Zustand, MobX, Recoil, Context API for global state, etc.).
- All cross-component state (auth state, user profile, dataroom state, UI state) must live in Redux.
- Local component state (`useState`) is allowed only for temporary UI concerns (modal open/close, form input typing, etc.).
- Redux store must be defined under `frontend/src/store/`.
- Redux slices must be organized by domain (`authSlice`, `dataroomSlice`, `uiSlice`, etc.).
- Business logic must not leak into React components — use thunks or middleware when needed.

### Persistence Rules

- Only non-sensitive UI preferences may be persisted (e.g., theme).
- Sensitive data (JWT tokens, API keys, secrets) must NEVER be persisted in Redux or localStorage.
- Authentication tokens must be handled securely via Electron runtime or secure storage.
- Theme, sidebar state, or any UI preference must NOT use `localStorage`, `sessionStorage`, or cookies.
- Theme persistence is implemented via SQLite (managed by the Python backend through Electron IPC).

### Theme Architecture

- Default theme is `light` on every application launch.
- Theme state is managed exclusively in Redux (`uiSlice`).
- Theme is applied at the root container level via a `data-theme` attribute on the `app-shell` element.
- All colors must be defined as CSS custom properties (variables) scoped to `[data-theme="light"]` and `[data-theme="dark"]`.
- No component may hardcode color values — all colors must use CSS variables.
- Future UI components must support both light and dark themes from the start.
- Do not apply theme at the `document`, `html`, or `body` level — it must apply at the `app-shell` container.
- Do not introduce CSS-in-JS libraries without approval.

---

## Redux Slices

All slices are in `frontend/src/store/`. Each slice uses Redux Toolkit's `createSlice` and
`createAsyncThunk`.

### `authSlice.js` — Authentication State

```
State shape:
  isAuthenticated: false     — User is logged in
  user: null                 — Current user object (shape below)
  loading: false             — Login in progress
  error: null                — Error message
  isRestoring: true          — True on launch until session restore completes
  plan: null                 — 'free' | 'pro' | 'enterprise'
  limits: null               — { dataroomLimit, monthlyFileLimit, dailyMessageLimit }
  usage: null                — { filesUploadedThisPeriod, messagesToday }

User object shape (set by loginSuccess):
  _id, name, email, provider ('local'|'google'|'local+google'),
  isEmailVerified, createdAt,
  googleId?, profilePicture?, userType ('individual'|'enterprise'),
  activeOrganizationId?

Reducers: loginStart, loginSuccess, loginFailure, logout, restoreComplete, setLimits

Thunks:
  loginThunk(credentials) — Full login flow with theme hydration
  fetchLimits()           — Fetch plan, limits, usage from Express via Electron IPC
```

### `dataroomSlice.js` — DataRoom CRUD State

```
State shape:
  datarooms: []              — Array of all DataRooms
  activeDataroom: null       — Currently viewed DataRoom (with folders/files)
  isLoading: false           — Fetch in progress
  isCreating: false          — Creation in progress
  error: null                — Error message

Thunks: fetchDatarooms, fetchDataroom, createDataroom, updateDataroom,
        toggleStarDataroom, deleteDataroom

Reducers: clearError, clearActiveDataroom
```

### `fileExplorerSlice.js` — Navigation & View State

```
State shape:
  currentDataroomId: null    — Active DataRoom ID
  currentFolderId: null      — Current folder (null = root)
  currentPath: []            — Breadcrumb path [{id, name, type}, ...]
  items: []                  — Current view items (files + folders merged)
  selectedItems: []          — Multi-selection [{id, type}, ...]
  viewMode: 'grid'           — 'grid' | 'list'
  sortBy: 'name'             — 'name' | 'size' | 'date'
  sortOrder: 'asc'           — 'asc' | 'desc'
  searchQuery: ''            — Local search filter
  isLoading: false           — Navigation in progress
  error: null                — Error message
  pendingMoves: []           — Files pending move operation
  contentChangedIds: []      — File IDs with detected content changes
  isNavigatingToFile: false  — Navigating to a specific file

Thunks: navigateToDataroom, navigateToFolder, navigateUp,
        navigateToPathIndex, navigateDirect, refreshCurrentView,
        navigateToFile

Reducers: setViewMode, setSortBy, setSortOrder, setSearchQuery,
          setSelectedItems, selectItem, deselectItem, clearSelection,
          updatePathSegmentName, markPendingMove, clearPendingMoves,
          markContentChanged, clearContentChanged
```

### `fileSlice.js` — File Operations & Upload Modal

```
State shape:
  isRegistering: false              — File registration in progress
  isClassifying: false              — Classification in progress
  classificationResults: null       — Results from AI classification
  error: null                       — Error message
  uploadModal:
    registrationResult: null        — { registered, rejected }
    classificationResult: null      — Full classify response
    generationResult: null          — Full generate-dataroom response
    isRegistering: false
    isClassifying: false
    isGenerating: false
    error: null

Thunks: selectAndRegisterFiles, selectAndRegisterFolder, classifyFiles,
        generateDataroom, registerFiles, classifyRegisteredFiles,
        generateNewDataroom, moveFileToFolder, removeFromOrvyn,
        deleteFromSystem, openFile, openFileWith, copyFilePath,
        copyFileToClipboard, relocateFile, renameFile

Reducers: clearFileError, clearClassificationResults, resetUploadState
```

### `folderSlice.js` — Folder Operations

```
State shape:
  isCreating: false          — Folder creation in progress
  error: null                — Error message

Thunks: createFolder, renameFolder, fetchFolderDeletePreview,
        deleteFolder({ folderId, fileAction }), moveFolder, updateFolderContext

Reducers: clearFolderError
```

### `uiSlice.js` — Global UI State

```
State shape:
  sidebarCollapsed: true     — Sidebar collapsed/expanded
  theme: 'light'             — 'light' | 'dark'
  activePage: 'dataroom'     — Current page identifier (see below)
  toasts: []                 — Toast notifications [{id, message, type}, ...]
  toastCounter: 0            — Auto-increment toast ID
  isOnline: true             — Express backend reachable
  uploadInitialFiles: null   — Pre-loaded files for upload page
  uploadPreselectedDataroomId: null — Pre-selected DataRoom for upload
  pendingViewDataroomId: null — After classification, navigate to this DataRoom

activePage values: 'dataroom', 'upload', 'settings', 'collaboration', 'organization-settings'

Reducers: toggleSidebar, toggleTheme, setTheme, setActivePage,
          setOnline, setUploadInitialFiles, setUploadPreselectedDataroomId,
          clearUploadPageState, setPendingViewDataroomId,
          clearPendingViewDataroomId, addToast, removeToast
```

### `copilotSlice.js` — Copilot Chat & Indexing State

```
State shape:
  isOpen: false              — Panel open/closed
  panelWidth: 380            — Current panel width in px

  sessions: []               — Array of { id, title, scope_type, scope_name, updated_at }
  activeSessionId: null      — ID of the currently loaded session
  messages: []               — Array of { role, content, sources } for active session

  scopeType: 'dataroom'      — 'file' | 'files' | 'folder' | 'dataroom' | 'multi_dataroom' | 'global'
  scopeIds: []               — IDs matching the scope type
  scopeName: ''              — Human-readable scope label for the header
  selectedFileIds: []        — File IDs currently selected in the explorer

  isLoading: false           — Generic loading (sessions fetch, session load)
  isSessionsLoading: false   — Sessions list loading separately
  isStreaming: false          — Chat stream in progress
  streamingMessage: ''       — Accumulated text during streaming
  isIndexing: false          — Index-files pipeline in progress
  indexStatus: null           — { total, pending, processing, complete, failed } from Python
  indexProgress: null        — { completed, total, current_file, status } — last progress event
  error: null                — Last error message (string)

Reducers:
  toggleCopilot, openCopilot, closeCopilot, setPanelWidth
  clearMessages, clearError
  setCopilotScope({ scopeType, scopeIds, scopeName })
  setSelectedFiles(fileIds[])
  startStreaming           — resets streamingMessage, sets isStreaming=true
  appendStreamChunk(text)  — appends to streamingMessage
  finalizeStreamMessage({ sources, session_id, session_title })
  updateIndexProgress(progressObj)

Thunks: sendMessage, fetchSessions, loadSession, deleteSession,
        indexFiles, getIndexStatus, retryIndexing
```

### `organizationSlice.js` — Organization State

```
State shape:
  organization: null         — Current org object
  members: []                — Array of member objects (populated with user info)
  invites: []                — Array of pending invite objects
  isLoading: false
  error: null
  auditLogs: []              — Audit log entries for current org
  auditTotal: 0              — Total audit log count
  auditPage: 1               — Current pagination page
  auditTotalPages: 0         — Total pages available
  isAuditLoading: false      — Audit log fetch in progress

Reducers: orgStart, orgFailure, setOrganization, setMembers,
          setInvites, clearOrganization, auditStart, setAuditLogs,
          clearAuditLogs

Thunks: createOrganization, fetchOrganization, fetchMembers,
        fetchInvites, createInviteThunk, acceptInviteThunk,
        removeMemberThunk, updateMemberRoleThunk, revokeInviteThunk,
        deleteOrganizationThunk, fetchAuditLogs
```

### `billingSlice.js` — Billing & Subscription State

```
State shape:
  plan: 'free'               — 'free' | 'pro' | 'enterprise'
  status: 'active'           — 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired'
  currentPeriodEnd: null     — Subscription period end date
  organizationId: null       — Set when on an enterprise org plan
  isLoading: false
  error: null

Reducers: setBillingLoading, setBillingStatus, setBillingError,
          clearBillingError, resetBilling

Thunks: fetchBillingStatus, upgradePlan({ plan, organizationId?, seats? }),
        cancelSubscription
```

### `sharingSlice.js` — DataRoom Sharing State

```
State shape:
  received: []               — DataRooms shared with me
  myShares: []               — DataRooms I shared
  searchResults: []          — User search results
  accessList: []             — Access records for a specific share
  isLoading: false
  isSharing: false           — Share operation in progress
  isImporting: false         — Import operation in progress
  error: null

Reducers: clearSharingError, clearSearchResults, clearAccessList

Thunks (all createAsyncThunk):
  fetchReceived, fetchMyShares, shareDataroom({ dataroomId, recipientEmail }),
  importDataroom(shareId), searchUsers(query),
  updateShare({ shareId, dataroomId }), deleteShare(shareId),
  grantAccess({ shareId, email, permission }),
  revokeAccess({ shareId, userId }), listAccess(shareId)
```

---

## File Explorer Architecture

The File Explorer (`frontend/src/components/dataroom/FileExplorer.jsx`) is the primary
interface for browsing DataRoom contents. It mimics Windows Explorer behavior.

### File Interaction

- Files are displayed by their `original_name` and metadata from the database.
- Double-clicking a file calls `file:open` (uses `shell.openPath()`).
- If the file no longer exists at `original_path`, the UI shows a "File not found" state
  with a **Relocate** button.
- **Shared DataRoom files** (`is_shared=true`): file operations (open, relocate, delete, rename)
  are disabled. These files have `original_path='SHARED'` and are read-only.

### Navigation & Views

- Breadcrumb bar with clickable path segments, back/up buttons, folder double-click to navigate.
- Navigation state managed by `fileExplorerSlice` with `currentPath[]`.
- **Grid view** — Cards with icons, names (2-line clamp), size. **List view** — Sortable table (Name, Type, Size, Date, Confidence).
- Click to select, Ctrl+click to toggle. Selection bar with count and batch actions.

### Right-Click Context Menus (`ContextMenu` component in `components/common/`)

- **File**: Open, Open With, Copy File, Copy Path, Move to Folder, Rename (F2), Relocate, Remove from Orvyn, Delete from System.
- **Folder**: Open, New Subfolder, Rename, Edit Description, Delete Folder.
- **Background**: New Folder, Upload Files, Upload Folder, Refresh.

### Confirmation Dialogs

- **Remove from Orvyn** — Single confirmation (file stays on disk).
- **Delete from System** — Double confirmation: user types exact filename to confirm. Permanently deletes from disk.
- **Delete Folder** — Single confirmation (files become unclassified).
- All dialogs: **Escape** to cancel, **Enter** to confirm.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Delete` | Remove selected file(s) from Orvyn |
| `F2` | Rename selected item |
| `Enter` | Open file / navigate into folder |
| `Backspace` | Navigate to parent folder |
| `Escape` | Clear selection |
| `Ctrl+A` | Select all items |
| `Ctrl+C` | Copy selected file to clipboard |

### Drag-and-Drop Upload

- Dragging files over the explorer shows a drop overlay.
- Dropping files opens the Upload Page with pre-loaded file paths.
- Folder drops are detected and recursively scanned via `file:scan-folder`.

---

## Component Structure

```
frontend/src/components/
├── auth/                   # Authentication components
│   ├── AuthLayout.jsx      # Wrapper for auth pages
│   ├── Login.jsx           # Login form (email/password + Google sign-in)
│   ├── Register.jsx        # Registration form (+ Google sign-up)
│   ├── ForgotPassword.jsx  # Password reset request
│   ├── VerifyCode.jsx      # Email verification
│   ├── ResetCode.jsx       # Password reset with code
│   ├── AccountLinkDialog.jsx  # [V2] Google account linking password dialog
│   ├── UserTypeSelection.jsx  # [V2] Post-auth user type picker (individual/enterprise)
│   ├── CreateOrganization.jsx # [V2] Organization creation form
│   └── JoinOrganization.jsx   # [V2] Accept invite flow
├── layout/                 # Layout components
│   ├── Header.jsx          # Top navigation bar
│   └── Sidebar.jsx         # Left sidebar navigation (incl. Collaboration item)
├── dataroom/               # DataRoom browsing
│   ├── CreateDataRoomModal.jsx
│   ├── FileExplorer.jsx    # Main file/folder browser
│   ├── FolderTreeNode.jsx  # Folder tree item
│   └── MoveMarkedFilesModal.jsx
├── upload/                 # File upload & classification
│   ├── ClassificationModeSelector.jsx
│   ├── DropZone.jsx
│   ├── FileList.jsx
│   ├── ProgressView.jsx
│   ├── ResultsView.jsx
│   └── icons.jsx
├── copilot/                # Copilot chat panel
│   ├── CopilotPanel.jsx    # Resizable right panel container
│   ├── CopilotChat.jsx     # Chat message display area
│   ├── CopilotHeader.jsx   # Panel header with session info
│   ├── CopilotInput.jsx    # Message input box
│   ├── CopilotMessage.jsx  # Individual message component
│   ├── CopilotQuickActions.jsx
│   ├── CopilotReasoningSteps.jsx
│   ├── CopilotSessionList.jsx
│   └── CopilotSources.jsx
├── settings/               # [V2] Settings components
│   ├── BillingSettings.jsx     # Subscription management UI
│   └── BillingSettings.module.css
├── sharing/                # [V2] Sharing components
│   ├── ShareDialog.jsx     # Share DataRoom modal (user search + send)
│   ├── SharedWithMe.jsx    # Received DataRooms grid (import action)
│   └── MyShares.jsx        # Sent DataRooms grid (update/delete actions)
└── common/                 # Shared utility components
    ├── ContextMenu.jsx     # Right-click context menu
    ├── FolderPicker.jsx    # Folder selection dialog
    └── Toast.jsx           # Toast notification system
```

### Page Components

| Page | File | Purpose |
|------|------|---------|
| Auth | `pages/AuthPage.jsx` | Routes to login/register/reset |
| DataRoom List | `pages/DataRoomList.jsx` | Main view: list datarooms, open file explorer |
| Upload | `pages/UploadPage.jsx` | Upload files, choose classification mode |
| Reset Password | `pages/ResetPassword.jsx` | Password reset flow |
| Settings | `pages/setting.jsx` | User settings, theme toggle, usage stats, billing |
| Collaboration | `pages/CollaborationPage.jsx` | [V2] Shared DataRooms hub (SharedWithMe + MyShares tabs) |
| Organization Settings | `pages/OrganizationSettings.jsx` | [V2] Org management (members, invites, settings, activity log) |

### Sidebar Navigation

The Sidebar (`components/layout/Sidebar.jsx`) includes these navigation items:
- **DataRooms** — `activePage: 'dataroom'`
- **Upload** — `activePage: 'upload'`
- **Collaboration** — `activePage: 'collaboration'` (V2)
- **Settings** — `activePage: 'settings'`

Organization Settings is accessed from within the Settings page or via the organization
section, setting `activePage: 'organization-settings'`.
