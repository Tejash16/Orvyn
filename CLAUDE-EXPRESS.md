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

## Health Endpoint

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/health/health` | Health check (no auth required) |

---

## MongoDB Models

| Model | File | Purpose |
|-------|------|---------|
| `User` | `src/models/User.js` | User account with auth fields (email, password hash, verified status) |
| `PendingRegistration` | `src/models/PendingRegistration.js` | Temporary record during email verification flow |
| `UserLimits` | `src/models/UserLimits.js` | Per-user monthly file upload limits |
| `UserUsage` | `src/models/UserUsage.js` | Track file uploads per user per month |
| `IdempotencyKey` | `src/models/IdempotencyKey.js` | Idempotent request deduplication for classification/generation |

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
