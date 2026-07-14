# CLAUDE-WEB-ADMIN.md — Admin Panel Reference

Read this file when working in `web-admin/`. Always read the main `CLAUDE.md` first.

---

## Architecture

Admin dashboard React SPA built with **Vite + React + Tailwind CSS + shadcn/ui + Recharts**.
Served by Express as static files at `/admin/*` with SPA catch-all routing.

- **Base path:** `/admin/` (configured in `vite.config.js`)
- **Dev server:** port 5175, proxies `/api` to `http://localhost:8080` (Express)
- **Production:** `vite build` outputs to `web-admin/dist/`, served by Express
- **No `.env` file** — all API calls go to the same Express server
- **No Electron IPC** — this app runs in the browser, not inside Electron

---

## Authentication

Admin auth is handled entirely in the browser:

1. Admin navigates to `/admin/login` and enters email + password
2. `POST /api/v1/admin/login` returns a JWT with admin flag
3. Token stored in `localStorage` (key: `admin_token`)
4. `adminFetch()` attaches `Authorization: Bearer {token}` to all requests
5. On 401 response, token is cleared and user redirected to `/admin/login`
6. `isAuthenticated()` checks token expiry client-side (JWT `exp` claim)

Server-side, `adminAuthenticate` middleware enforces:
- IP whitelist (`ADMIN_ALLOWED_IPS` env var)
- Valid JWT (signed with `ADMIN_SESSION_SECRET` or `JWT_SECRET`)
- User `role === 'admin'` in database

---

## Layout

`AdminLayout` provides the persistent app shell:
- **Sidebar** (`AdminSidebar`): Navigation links to all admin sections, logout button
- **Header**: Page title area
- **Content**: `<Outlet />` for nested routes

All authenticated pages render inside `AdminLayout`. Only `LoginPage` renders standalone.

Protected routes use `ProtectedRoute` component — redirects to `/login` if not authenticated.

---

## Pages

| Page | Route | API Endpoint | Purpose |
|------|-------|-------------|---------|
| `LoginPage` | `/admin/login` | `POST /api/v1/admin/login` | Admin login form |
| `DashboardPage` | `/admin/dashboard` | `GET /api/v1/admin/dashboard/stats` | Stats overview (users, subs, revenue) |
| `UserListPage` | `/admin/users` | `GET /api/v1/admin/users` | Search, filter, paginate users |
| `UserDetailPage` | `/admin/users/:id` | `GET /api/v1/admin/users/:id` | Full user detail + actions (suspend/ban/delete/limits) |
| `PromoListPage` | `/admin/promo-codes` | `GET /api/v1/admin/promo-codes` | List and deactivate promo codes |
| `PromoCreatePage` | `/admin/promo-codes/create` | `POST /api/v1/admin/promo-codes` | Create new promo code |
| `SubListPage` | `/admin/subscriptions` | `GET /api/v1/admin/subscriptions` | List subscriptions by status/plan |
| `OrgListPage` | `/admin/organizations` | `GET /api/v1/admin/organizations` | List organizations |
| `OrgDetailPage` | `/admin/organizations/:id` | `GET /api/v1/admin/organizations/:id` | Org detail with members + seat management |
| `AuditLogPage` | `/admin/audit-logs` | `GET /api/v1/admin/audit-logs` | Paginated, filterable audit logs |
| `BrowserPage` | `/admin/database[/:collection]` | `GET /api/v1/admin/database/*` | Read-only MongoDB collection browser |
| `CollabListPage` | `/admin/collaborations` | `GET /api/v1/admin/collaborations` | View and break collaborations |
| `BroadcastPage` | `/admin/notifications/broadcast` | `POST /api/v1/admin/notifications/broadcast` | Send notifications to users |
| `HealthPage` | `/admin/system-health` | `GET /api/v1/admin/system/health` | MongoDB status, memory, uptime |
| `ExportPage` | `/admin/export` | `GET /api/v1/admin/export/:type` | CSV download (users/usage/audit-logs/subscriptions) |
| `DataRoomListPage` | `/admin/shared-datarooms` | `GET /api/v1/admin/shared-datarooms` | Review all shared DataRooms |

---

## Hooks

| Hook | Purpose |
|------|---------|
| `useAuth()` | Returns `{ authed, setAuthed, logout }`. Checks `isAuthenticated()` on mount, provides logout that clears token and navigates to login. |

---

## API Client

`src/lib/api.js` exports:

| Function | Purpose |
|----------|---------|
| `adminFetch(path, options)` | Authenticated fetch to `/api/v1/admin{path}`. Attaches Bearer token, handles 401 redirect, supports blob downloads. |
| `adminLogin(email, password)` | Login and store token in localStorage |
| `setToken(token)` | Store admin JWT in localStorage |
| `clearToken()` | Remove admin JWT from localStorage |
| `isAuthenticated()` | Check if stored token is present and not expired |

---

## Reusable Components

| Component | Purpose |
|-----------|---------|
| `AdminSidebar` | Navigation sidebar with section links |
| `StatsCard` | Dashboard stat card (label, value, icon, trend) |
| `DataTable` | Paginated table with sorting (used across list pages) |
| `SearchBar` | Search + filter controls |
| `ConfirmDialog` | Destructive action confirmation modal |
| `ui/*` | shadcn/ui components (button, card, input, table, etc.) |

---

## Vite Config

```js
base: '/admin/'       // All assets served under /admin/
server.port: 5175     // Dev server port
server.proxy: { '/api': 'http://localhost:8080' }  // Proxy API calls to Express
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI framework |
| `react-router-dom` | Client-side routing (basename: `/admin`) |
| `recharts` | Dashboard charts and graphs |
| `date-fns` | Date formatting in tables |
| `lucide-react` | Icons |
| `tailwindcss`, `@tailwindcss/vite` | Utility-first CSS |
| `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn/ui utilities |
