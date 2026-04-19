# Orvyn Pilot Operational Cost Estimate

Prepared on April 16, 2026 from the current repo state and current vendor pricing.

## What I verified in this repo

Orvyn currently uses Gemini and GCP in these places:

- Classification into an existing DataRoom uses `gemini-2.5-flash` and sends files in batches of 10, with up to 100 files per request.
- AI-generated DataRoom creation also uses Gemini and sends the full file fingerprint set in one request.
- Copilot indexing uses:
  - `gemini-embedding-001` for embeddings
  - Gemini entity extraction on the first 2,000 characters
  - Gemini summarization on the first 2,000 characters
- OCR runs through Gemini for image files during the upload flow.
- Importing a shared DataRoom auto-triggers Copilot indexing for the recipient, so embeddings/entity extraction/summary cost is incurred again for the imported files.
- The cloud backend is an Express container deployed to Cloud Run in `asia-south1` and serves the API plus the portal/admin builds from the same container.

Repo files checked:

- `express-backend/src/services/geminiService.js`
- `express-backend/src/controllers/aiController.js`
- `python-backend/app/services/classification_service.py`
- `python-backend/app/services/embedding_service.py`
- `electron/ipc/copilotHandlers.js`
- `electron/ipc/sharingHandlers.js`
- `electron/ipc/fileHandlers.js`
- `electron/config.js`
- `express-backend/Dockerfile`

## Current vendor pricing checked on April 16, 2026

Gemini Developer API:

- Gemini 2.5 Flash: $0.30 / 1M input tokens, $2.50 / 1M output tokens
- Gemini Embedding (`gemini-embedding-001`): $0.15 / 1M input tokens

Cloud Run request-based pricing in Mumbai (`asia-south1`):

- Active CPU: $0.000024 per vCPU-second
- Active memory: $0.0000025 per GiB-second
- Idle min instance CPU: $0.0000025 per vCPU-second
- Idle min instance memory: $0.0000025 per GiB-second
- Requests: $0.40 per 1,000,000 requests
- Free tier: 180,000 vCPU-seconds, 360,000 GiB-seconds, and 2M requests per month

Official sources:

- https://ai.google.dev/gemini-api/docs/pricing
- https://cloud.google.com/run/pricing

## Repo-based cost assumptions

These assumptions are based on the way the current code builds prompts and chunks text:

- Average indexed text file: about 15,000 characters
- Chunking: 3,750 chars with 750-char overlap, which is about 5 chunks for a typical file
- Entity extraction: first 2,000 chars only
- Summary: first 2,000 chars only
- Average Copilot question: about 1.5 Gemini rounds on average because tool calling can trigger follow-up rounds
- OCR estimate: conservative assumption of about 3,000 image-equivalent input tokens and 600 output tokens per scanned page

## Estimated direct unit cost

These are the useful working numbers for the meeting:

| Item | Estimated direct cost |
| --- | ---: |
| Classify 100 files into an existing DataRoom | ~$0.02 to $0.03 |
| AI-generate a new DataRoom for 100 files | ~$0.01 |
| Index 1 average text file for Copilot | ~$0.0018 |
| OCR 1 scanned page | ~$0.0024 |
| 1 Copilot question | ~$0.004 to $0.005 |
| Share/import 1 file to another user | adds another ~$0.0018 per imported file because indexing repeats |

Important note:

- The share action itself does not call Gemini.
- The cost appears when the recipient imports the shared DataRoom and Orvyn auto-indexes those files for Copilot.

## Monthly pilot scenarios

These scenarios are for one pilot client organization.

### 1. Light pilot

Usage assumption:

- 200 files uploaded/indexed
- 50 OCR pages
- 200 Copilot questions
- 50 imported shared files

Estimated direct AI/API cost:

- Classification/generation: ~$0.05
- Indexing: ~$0.36
- OCR: ~$0.12
- Copilot chat: ~$0.89
- Shared import re-indexing: ~$0.09

Total direct AI/API cost: about **$1.50/month**

### 2. Standard pilot

Usage assumption:

- 500 files uploaded/indexed
- 150 OCR pages
- 500 Copilot questions
- 150 imported shared files

Estimated direct AI/API cost:

- Classification/generation: ~$0.12
- Indexing: ~$0.89
- OCR: ~$0.36
- Copilot chat: ~$2.23
- Shared import re-indexing: ~$0.27

Total direct AI/API cost: about **$3.86/month**

### 3. Heavy pilot

Usage assumption:

- 1,000 files uploaded/indexed
- 500 OCR pages
- 1,500 Copilot questions
- 600 imported shared files

Estimated direct AI/API cost:

- Classification/generation: ~$0.23
- Indexing: ~$1.78
- OCR: ~$1.20
- Copilot chat: ~$6.69
- Shared import re-indexing: ~$1.07

Total direct AI/API cost: about **$10.97/month**

## Cloud Run hosting cost

This is shared backend cost, not per-client cost unless you allocate it that way.

Best case:

- If Cloud Run is running with `min instances = 0` and traffic stays low, Cloud Run may stay near zero or remain mostly covered by free tier.

Warm backend case:

- If you keep 1 warm Cloud Run instance at 1 vCPU / 512 MiB all month, the idle baseline is about **$9.72/month**
- If that warm instance is 1 vCPU / 1 GiB, the idle baseline is about **$12.96/month**

Per-client allocation example:

- 1 pilot client only: almost the full warm-instance cost lands on that client
- 5 pilot clients sharing the backend: about **$1.94/client/month** on a 1 vCPU / 512 MiB warm instance

## Practical pricing takeaway

If you want to quote Orvyn to a pilot client at roughly operational cost only:

- If Cloud Run is `min instances = 0`: quote about **$5 to $10 per pilot client organization per month**
- If you want a warm backend or a small safety buffer: quote about **$12 to $20 per pilot client organization per month**

Simple meeting version:

> We are currently offering Orvyn to pilot clients close to our live operating cost. Based on the current stack, that is roughly $5 to $10 per month for light-to-standard pilot usage, and closer to $12 to $20 per month if usage is heavier or if we keep dedicated warm backend capacity ready.

## Recommended client-facing version

For the meeting, I would use this wording:

> For the pilot phase, we can offer Orvyn at operational cost only. On the current build, that comes out to roughly $10 per month per pilot client organization for standard usage, with heavier OCR, sharing, or Copilot usage pushing it closer to the $15 to $20 range.

## Important exclusions

This estimate does **not** include:

- MongoDB cost, if your `MONGO_URI` points to a paid external Mongo/Atlas deployment
- SMTP/email sending cost
- Razorpay/payment fees
- Engineering support time, onboarding time, or custom work
- Any increase caused by Gemini falling back from `gemini-2.5-flash` to `gemini-2.5-pro`

## Bottom line

On the current repo, the direct Gemini cost is low. Copilot chat and re-indexing on shared imports are the biggest recurring AI drivers. The main non-AI variable is whether your Cloud Run service is truly scale-to-zero or whether you are keeping a warm backend instance up all month.
