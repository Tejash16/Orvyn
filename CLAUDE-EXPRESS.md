# CLAUDE-EXPRESS.md — Express Backend Reference

Read this file when working in `express-backend/`. Always read the main `CLAUDE.md` first.

---

## Classification Engine (Express Side)

The Express backend handles all LLM API calls for classification. The Gemini API key
lives exclusively in `express-backend/.env` — it must NEVER be placed in any file
shipped with the desktop app.

### Batched Parallel Processing

Express splits files into batches of **10 files per Gemini API call**. Up to **5 batches
run in parallel** using `Promise.all()`, processing a maximum of 100 files efficiently.

### AI Model Configuration

- **Model**: `gemini-2.5-flash` (Google Generative AI)
- **Temperature**: `0.1` (low variance for consistent classification)
- **Response format**: Structured JSON with `folder_id`, `confidence`, `reasoning`
- **SDK**: `@google/generative-ai` (npm, Express backend only)

For the data preparation side, see `CLAUDE-PYTHON.md`.
For the orchestration flow, see `CLAUDE-ELECTRON.md`.

---

## Auth Endpoints

| Method | Path | Rate Limit | Purpose |
|--------|------|-----------|---------|
| `POST` | `/api/v1/auth/register` | 5/15min | Register new account |
| `POST` | `/api/v1/auth/verify-email` | — | Verify email with code |
| `POST` | `/api/v1/auth/login` | 5/15min | Login with email/password |
| `GET` | `/api/v1/auth/me` | — | Get current user (requires Bearer token) |
| `POST` | `/api/v1/auth/refresh` | — | Refresh access token |
| `POST` | `/api/v1/auth/logout` | — | Revoke refresh token |
| `POST` | `/api/v1/auth/delete-account` | — | Delete account (requires Bearer token) |
| `POST` | `/api/v1/auth/resend-verification` | 3/15min | Resend verification email |
| `POST` | `/api/v1/auth/forgot-password` | 3/15min | Request password reset code |
| `POST` | `/api/v1/auth/verify-reset-code` | 5/15min | Verify reset code validity |
| `POST` | `/api/v1/auth/reset-password` | 5/15min | Reset password with code |
| `POST` | `/api/v1/auth/resend-reset-code` | 3/15min | Resend password reset code |
| `POST` | `/api/v1/auth/feedback` | 3/15min | Submit user feedback (requires Bearer token) |

### Google OAuth Endpoints

| Method | Path | Rate Limit | Purpose |
|--------|------|-----------|---------|
| `POST` | `/api/v1/auth/google` | 5/15min | Exchange Google auth code for app tokens |
| `POST` | `/api/v1/auth/google/link` | 5/15min | Link Google identity to existing local account |
| `POST` | `/api/v1/auth/set-user-type` | — | Set user type after first login (requires Bearer) |

**Google OAuth edge cases** (enforced in `authService.js`):
- `register()` blocks local registration if email exists as a Google account.
- `loginUser()` blocks email/password login for `provider: 'google'` users (Google-only).
- `forgotPassword()` silently skips code send for Google-only users (prevents enumeration).
- `provider: 'local+google'` users can use both login methods.

### Rate Limiters (15-minute window)

| Limiter | Max Requests | Applied To |
|---------|-------------|------------|
| `registerLimiter` | 5 | `/register` |
| `loginLimiter` | 5 | `/login` |
| `forgotPasswordLimiter` | 3 | `/forgot-password` |
| `resetPasswordLimiter` | 5 | `/reset-password` |
| `resendVerificationLimiter` | 3 | `/resend-verification` |
| `verifyResetCodeLimiter` | 5 | `/verify-reset-code` |
| `resendResetCodeLimiter` | 3 | `/resend-reset-code` |
| `feedbackLimiter` | 3 | `/feedback` |
| `googleLoginLimiter` | 5 | `/google`, `/google/link` |
| `orgCreateLimiter` | 5 | Organization creation |
| `orgInviteLimiter` | 10 | Organization invites |

---

## AI Proxy Endpoints (require Bearer token)

### Classification & Generation

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/ai/classify` | Receive fingerprints + folder tree, call Gemini, return classification results |
| `POST` | `/api/v1/ai/generate-dataroom` | Receive fingerprints + DataRoom info, call Gemini, return folder structure + assignments |
| `POST` | `/api/v1/ai/ocr` | Extract text from images via Gemini Vision |

### Copilot Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/ai/embed` | Batch embed texts via Gemini (`gemini-embedding-001`) |
| `POST` | `/api/v1/ai/chat/stream` | Streaming Gemini chat via SSE — stateless, one round per call |
| `POST` | `/api/v1/ai/chat` | Non-streaming chat fallback |
| `POST` | `/api/v1/ai/extract-entities` | Entity extraction prompt → Gemini → JSON |
| `POST` | `/api/v1/ai/summarize-file` | File summary (2000-char input) → Gemini |
| `POST` | `/api/v1/ai/generate-title` | Session title from first user message |
| `POST` | `/api/v1/ai/audit` | Audit prompt + audit_data → Gemini → structured result |
| `POST` | `/api/v1/ai/simulate` | Role simulation prompt → Gemini → result |
| `POST` | `/api/v1/ai/generate-insights` | DataRoom summary, suggestions, missing-doc detection |
| `POST` | `/api/v1/ai/generate-suggestions` | 4 context-aware suggested questions (domain-agnostic) |

**Streaming protocol:** `text/event-stream` with `data: {JSON}\n\n` lines.
Type values: `chunk`, `tool_call`, `tool_call_stop`, `end`, `error`.

---

## Usage Endpoints (require Bearer token)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/usage/` | Get full usage summary (monthly limits, current usage) |
| `GET` | `/api/v1/usage/check-files?count=N` | Pre-check if user has capacity for N file uploads |

---

## Organization Endpoints (require Bearer token)

All routes mounted at `/api/v1/organizations/`.

### Organization CRUD

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/` | `authenticate` + `orgCreateLimiter` | Create organization |
| `GET` | `/:orgId` | `authenticate` + `orgAuthorize('member')` | Get organization details |
| `PUT` | `/:orgId` | `authenticate` + `orgAuthorize('admin')` | Update organization |
| `DELETE` | `/:orgId` | `authenticate` + `orgAuthorize('owner')` | Delete organization |

### Members

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/:orgId/members` | `orgAuthorize('member')` | List all members (with user info) |
| `PUT` | `/:orgId/members/:userId` | `orgAuthorize('admin')` | Update member role |
| `DELETE` | `/:orgId/members/:userId` | `orgAuthorize('admin')` | Remove member |

### Invitations

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/:orgId/invites` | `orgAuthorize('admin')` + `orgInviteLimiter` | Create invite |
| `GET` | `/:orgId/invites` | `orgAuthorize('admin')` | List pending invites |
| `DELETE` | `/:orgId/invites/:inviteId` | `orgAuthorize('admin')` | Revoke invite |
| `GET` | `/invites/:inviteCode` | Public (no auth) | Get invite details |
| `POST` | `/invites/:inviteCode/accept` | `authenticate` | Accept invite |

### Audit Logs (Enterprise)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/:orgId/audit-logs` | `orgAuthorize('admin')` | Paginated org audit log (filter by action, date range) |

---

## Billing Endpoints

### API Routes (require Bearer token)

All routes mounted at `/api/v1/billing/`.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/create-checkout-session` | Create Razorpay subscription, return checkout URL |
| `GET` | `/status` | Get current subscription status |
| `POST` | `/cancel` | Cancel active subscription |
| `POST` | `/webhook` | Razorpay webhook handler (NO Bearer auth, signature-verified) |

### Checkout Redirects (legacy URLs → web-portal)

Old `/billing/checkout/*` URLs now redirect to the web-portal React app:
- `GET /billing/checkout/:token` → redirects to `/portal/checkout/:token`
- `GET /billing/checkout/success` → redirects to `/portal/checkout/success`
- `GET /billing/checkout/failure` → redirects to `/portal/checkout/failure`

---

## Sharing Endpoints (require Bearer token)

All routes mounted at `/api/v1/sharing/`.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/datarooms` | Share a DataRoom (create snapshot with access) |
| `PUT` | `/datarooms/:shareId` | Update shared snapshot (re-share with latest data) |
| `DELETE` | `/datarooms/:shareId` | Delete shared DataRoom |
| `POST` | `/datarooms/:shareId/access` | Grant access to a user |
| `DELETE` | `/datarooms/:shareId/access/:userId` | Revoke user access |
| `GET` | `/datarooms/:shareId/access` | List who has access |
| `GET` | `/my-shares` | List DataRooms I shared |
| `GET` | `/received` | List DataRooms shared with me |
| `GET` | `/received/:shareId` | Get shared DataRoom full snapshot data |
| `GET` | `/users/search` | Search users for sharing (query param `q`) |
| `GET` | `/me/audit-logs` | Individual user's own activity log (paginated) |

---

## Admin Endpoints (require admin auth)

All routes mounted at `/api/v1/admin/`. Protected by `adminAuthenticate` middleware
(IP whitelist + Bearer token + `role === 'admin'`).

### Auth

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/login` | Admin login (returns JWT with admin flag) |

### Dashboard

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/dashboard/stats` | Aggregate counts (users, subs, revenue, recent signups) |

### Users

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/users` | Paginated user list (query: `q`, `page`, `plan`, `status`) |
| `GET` | `/users/:id` | Full user detail (profile + usage + limits + orgs + audit) |
| `POST` | `/users/:id/suspend` | Suspend user (body: `{ reason, until }`) |
| `POST` | `/users/:id/unsuspend` | Unsuspend user |
| `POST` | `/users/:id/ban` | Ban user (body: `{ reason }`) |
| `DELETE` | `/users/:id` | Force delete user (cascade) |
| `POST` | `/users/:id/reset-password` | Trigger password reset email |
| `PUT` | `/users/:id/limits` | Override UserLimits |

### Promo Codes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/promo-codes` | List all promo codes |
| `POST` | `/promo-codes` | Create promo code |
| `POST` | `/promo-codes/:id/deactivate` | Deactivate promo code |

### Subscriptions

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/subscriptions` | List subscriptions (filterable by status, plan) |

### Organizations

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/organizations` | List organizations |
| `GET` | `/organizations/:id` | Organization detail with members |
| `PUT` | `/organizations/:id/seats` | Update maxSeats |

### Audit Logs

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/audit-logs` | Paginated, filterable audit logs |

### Database Browser

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/database/collections` | List available MongoDB collections |
| `GET` | `/database/:collection` | Paginated read-only documents |

### Collaborations

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/collaborations` | List all collaborations |
| `DELETE` | `/collaborations/:id` | Break a collaboration |

### Notifications

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/notifications/broadcast` | Broadcast notification to all or targeted users |

### System Health

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/system/health` | MongoDB status, memory, uptime |

### Export

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/export/:type` | CSV download (users/usage/audit-logs/subscriptions) |

### Shared DataRooms

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/shared-datarooms` | List all shared DataRooms with owner info |

---

## Health Endpoint

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/health/health` | Health check (no auth required) |

---

## MongoDB Models

| Model | File | Purpose |
|-------|------|---------|
| `User` | `src/models/User.js` | User account (email, password hash, verified status, googleId, profilePicture, userType, activeOrganizationId, provider, role: user/admin, restrictionStatus: active/suspended/banned, restrictionReason, restrictedUntil, restrictedBy) |
| `PendingRegistration` | `src/models/PendingRegistration.js` | Temporary record during email verification flow |
| `UserLimits` | `src/models/UserLimits.js` | Per-user monthly file upload limits, plan, dataroomLimit, isCustomOverride |
| `UserUsage` | `src/models/UserUsage.js` | Track file uploads per user per month (lastDailyReset, lastMonthlyReset) |
| `IdempotencyKey` | `src/models/IdempotencyKey.js` | Idempotent request deduplication for classification/generation |
| `Organization` | `src/models/Organization.js` | Organization entity (name, owner, settings) |
| `OrganizationMember` | `src/models/OrganizationMember.js` | User-org membership (userId, organizationId, role: owner/admin/member) |
| `OrganizationInvite` | `src/models/OrganizationInvite.js` | Pending invitation (email, inviteCode, role, expiry) |
| `Subscription` | `src/models/Subscription.js` | Razorpay billing state (userId, orgId, plan, status, razorpaySubscriptionId) |
| `SharedDataRoom` | `src/models/SharedDataRoom.js` | Shared DataRoom snapshot (folder tree, files, extracted text, metadata) |
| `SharedDataRoomAccess` | `src/models/SharedDataRoomAccess.js` | Per-user access grant (sharedDataRoomId, userId, permission) |
| `AuditLog` | `src/models/AuditLog.js` | Enterprise audit trail (userId, action, resourceType, metadata, TTL 1 year). Includes admin action enums: `admin.user_suspended`, `admin.user_banned`, `admin.user_deleted`, `admin.limits_overridden`, etc. |
| `PromoCode` | `src/models/PromoCode.js` | Promo code (code, discountType: percentage/fixed/trial_extension, discountValue, applicablePlans, maxRedemptions, currentRedemptions, validFrom, validUntil, isActive, createdBy) |

---

## Middleware

| File | Purpose |
|------|---------|
| `authenticate.js` | Bearer token verification, attaches `req.user`. Also checks user restriction status (banned → 403, suspended → 403 if not expired). |
| `adminAuthenticate.js` | Admin-only middleware: IP whitelist check (ADMIN_ALLOWED_IPS), Bearer JWT verification (ADMIN_SESSION_SECRET or JWT_SECRET), user role === 'admin' check. Attaches `req.admin`. |
| `rateLimiter.js` | All rate limiters (auth, Google, org, feedback) |
| `errorHandler.js` | Global error handler |
| `orgAuthorize.js` | Organization role-based access control. Accepts minimum role ('member', 'admin', 'owner'). Verifies user is a member with sufficient role. |
| `enforceLimits.js` | Server-side usage enforcement. Checks file, DataRoom, and message limits based on plan. Applied to AI endpoints (chat, classify, generate). |

---

## Services

| File | Purpose |
|------|---------|
| `authService.js` | Registration, login, token generation, password reset, Google edge case guards |
| `geminiService.js` | All Gemini API calls (classification, chat, embedding, OCR, etc.) |
| `googleAuthService.js` | Google OAuth: `exchangeCodeForProfile()`, `findOrCreateGoogleUser()`, `linkGoogleToLocalAccount()` |
| `razorpayService.js` | Razorpay SDK: create subscriptions, webhook handling, payment emails, subscription status |
| `emailService.js` | Transactional email transport (SMTP or file-log fallback in dev) |
| `emailTemplates.js` | HTML email templates (verification, reset, invites, payments, sharing) |
| `auditService.js` | `logAudit(params)` — fire-and-forget audit log creation (never blocks main operation) |
| `usageService.js` | Usage tracking, limit checks, monthly/daily reset logic |
| `codeService.js` | Verification code generation |
| `logger.js` | Winston logger (file rotation, Morgan HTTP log stream) |

---

## Config

| File | Purpose |
|------|---------|
| `config/db.js` | MongoDB connection via Mongoose |
| `config/planLimits.js` | Plan-to-limits mapping. `PLAN_LIMITS.free`, `.pro`, `.enterprise` with `monthlyFileLimit`, `dailyMessageLimit`, `dataroomLimit`. `-1` = unlimited. |

---

## Gemini Service Functions

All functions in `express-backend/src/services/geminiService.js`:

| Function | Purpose |
|----------|---------|
| `classifyFiles(fingerprints, folderTree, folderIds)` | Classify files into folders (batched 10x5) |
| `generateDataroom(name, description, fingerprints)` | Generate AI folder structure + assignments |
| `embedTexts(texts)` | Batch embed texts via Gemini embedding API |
| `extractEntities(text)` | Extract organizations, people, dates, etc. |
| `extractTextFromImage(imageBase64, mimeType, filename)` | OCR via Gemini Vision |
| `summarizeFile(text)` | Generate 2-3 sentence file summary |
| `generateTitle(message)` | Generate 5-word chat session title |
| `chatStream(res, systemPrompt, messages, tools, toolConfig)` | Stream chat with SSE + tool calling |
| `chatNonStreaming(systemPrompt, messages, tools, toolConfig)` | Non-streaming chat fallback |

Also exports: `CHAT_SYSTEM_PROMPT` constant.

---

## Express Environment Variables

### `express-backend/.env`

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | — | Express server port |
| `MONGO_URI` | — | MongoDB connection string (required) |
| `JWT_SECRET` | — | JWT signing secret (required) |
| `REFRESH_TOKEN_SECRET` | — | Refresh token secret (required) |
| `ACCESS_TOKEN_TTL` | — | Access token time-to-live |
| `REFRESH_TOKEN_TTL` | — | Refresh token time-to-live |
| `CLIENT_URL` | — | Allowed CORS origins |
| `GEMINI_API_KEY` | — | Google Gemini API key (required) |
| `GEMINI_CHAT_MODEL` | `gemini-2.5-flash` | Gemini model for chat and audit |
| `GEMINI_CHAT_TEMPERATURE` | `0.3` | Temperature for chat responses |
| `GEMINI_CHAT_MAX_OUTPUT_TOKENS` | `4096` | Max tokens in a single Gemini response |
| `GEMINI_OCR_MAX_IMAGE_SIZE_MB` | `10` | Max image size for OCR |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | Gemini model for text embeddings |
| `GEMINI_EMBEDDING_DIMENSIONS` | `3072` | Output vector dimensions |
| `SMTP_HOST` | — | Email server host |
| `SMTP_PORT` | — | Email server port |
| `SMTP_SECURE` | — | Email server TLS |
| `SMTP_USER` | — | Email server username |
| `SMTP_PASS` | — | Email server password |
| `MAIL_FROM` | — | From address for emails |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID (public, also in Electron) |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret (Express only) |
| `GOOGLE_REDIRECT_URI` | — | Cloud callback URL for Google OAuth (e.g., `https://api.orvyn.app/portal/auth/google/callback`) |
| `APP_URL` | `http://localhost:8080` | Public URL of this Express backend (used for invite URLs, checkout links) |
| `GEMINI_MODEL_CHAIN` | `gemini-2.5-flash,gemini-1.5-flash,gemini-1.5-pro` | Ordered fallback chain for Gemini 403/503 errors |
| `ADMIN_SESSION_SECRET` | — | Separate JWT secret for admin tokens (falls back to JWT_SECRET if blank) |
| `ADMIN_ALLOWED_IPS` | — | Comma-separated IP whitelist for admin access (blank = allow all in dev) |
| `RAZORPAY_KEY_ID` | — | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | — | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | — | Razorpay webhook signature verification |
| `RAZORPAY_PLAN_ID_PRO` | — | Razorpay plan ID for individual pro |
| `RAZORPAY_PLAN_ID_ENTERPRISE` | — | Razorpay plan ID for enterprise |

### Dependencies Added in V2

| Package | Purpose |
|---------|---------|
| `google-auth-library` | Google OAuth token verification |
| `razorpay` | Razorpay payment SDK |
