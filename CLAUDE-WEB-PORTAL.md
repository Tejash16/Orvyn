# CLAUDE-WEB-PORTAL.md — Web Portal Reference

Read this file when working in `web-portal/`. Always read the main `CLAUDE.md` first.

---

## Architecture

Public-facing React SPA built with **Vite + React + Tailwind CSS + shadcn/ui**.
Served by Express as static files at `/portal/*` with SPA catch-all routing.

- **Base path:** `/portal/` (configured in `vite.config.js`)
- **Dev server:** port 5174, proxies `/api` to `http://localhost:8080` (Express)
- **Production:** `vite build` outputs to `web-portal/dist/`, served by Express
- **No `.env` file** — all config derived from Express API responses or JWT tokens
- **No Electron IPC** — this app runs in the browser, not inside Electron

---

## Pages

| Page | Route | API Call | Purpose |
|------|-------|----------|---------|
| `InvitePage` | `/portal/invite/:code` | `GET /api/v1/organizations/invites/:code` | Org invite landing — shows org name, inviter, role, deep link button |
| `GoogleAuthCallback` | `/portal/auth/google/callback` | `POST /api/v1/auth/google` | Google OAuth callback — exchanges code for tokens, shows deep link |
| `CheckoutPage` | `/portal/checkout/:token` | None (decodes JWT client-side) | Razorpay checkout — decodes plan info from token, opens Razorpay SDK |
| `PaymentSuccess` | `/portal/checkout/success` | None (static) | Post-payment success confirmation |
| `PaymentFailure` | `/portal/checkout/failure` | None (static) | Post-payment failure message |
| `NotFound` | `*` | None | 404 catch-all |

---

## Components

| Component | Purpose |
|-----------|---------|
| `BrandHeader` | Orvyn logo + subtitle (shared across all pages) |
| `DeepLinkButton` | "Open in Orvyn" button using `orvyn://` protocol |
| `PortalCard` | Centered card layout wrapper for all portal pages |
| `StatusCard` | Success/failure card with icon |
| `ui/*` | shadcn/ui components (button, card, etc.) |

---

## Deep Link Protocol

The portal uses `orvyn://` deep links to hand off actions to the Electron desktop app:

| Deep Link | Triggered By | Purpose |
|-----------|-------------|---------|
| `orvyn://invite?code={code}` | InvitePage | Open Orvyn and accept the org invite |
| `orvyn://auth/google?action=login&token={...}&refreshToken={...}` | GoogleAuthCallback (success) | Pass OAuth tokens to Electron |
| `orvyn://auth/google?action=link&email={...}&googleId={...}` | GoogleAuthCallback (linking) | Prompt Electron to link Google account |

---

## API Client

`src/lib/api.js` exports `apiFetch(path, options)` — a thin `fetch()` wrapper that:
- Prepends `/api/v1` to the path
- Sets `Content-Type: application/json`
- Throws on non-OK responses with the server error message

No authentication token is needed — all portal API calls are to public endpoints.

---

## Vite Config

```js
base: '/portal/'      // All assets served under /portal/
server.port: 5174     // Dev server port
server.proxy: { '/api': 'http://localhost:8080' }  // Proxy API calls to Express
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI framework |
| `react-router-dom` | Client-side routing (basename: `/portal`) |
| `lucide-react` | Icons |
| `tailwindcss`, `@tailwindcss/vite` | Utility-first CSS |
| `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn/ui utilities |
