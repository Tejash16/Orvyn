const path = require('path');
const { app } = require('electron');

const pythonService      = require('../services/pythonService');
const authService        = require('../services/authService');
const userContextService = require('../services/userContextService');
const log                = require('../services/logger');

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let activeStreamController = null;

// ---------------------------------------------------------------------------
// Helpers — URL + auth
// ---------------------------------------------------------------------------

function getPythonUrl() {
  const url = process.env.PYTHON_URL;
  if (!url) throw new Error('PYTHON_URL is not configured in electron/.env');
  return url;
}

function getExpressUrl() {
  const url = process.env.EXPRESS_URL;
  if (!url) throw new Error('EXPRESS_URL is not configured in electron/.env');
  return url;
}

function getToken() {
  const token = authService.getToken();
  if (!token) throw new Error('No active session. Please log in.');
  return token;
}

/** Returns { db_path, chroma_path, user_id } for every Python call. */
function getUserContext() {
  const userId = userContextService.getActiveUserId();
  const dbPath = userContextService.getActiveDatabasePath();
  if (!userId || !dbPath) throw new Error('No active user context.');
  const chromaPath = path.join(app.getPath('userData'), 'users', userId, 'chroma');
  return { db_path: dbPath, chroma_path: chromaPath, user_id: userId };
}

// ---------------------------------------------------------------------------
// Helper — authenticated Express POST (JSON)
// ---------------------------------------------------------------------------

async function expressPost(endpoint, body) {
  const res = await fetch(`${getExpressUrl()}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.detail || `Express ${endpoint} failed.`);
  return data;
}

// ---------------------------------------------------------------------------
// Helper — Python POST (JSON)
// ---------------------------------------------------------------------------

async function pythonPost(endpoint, body) {
  const res = await fetch(`${getPythonUrl()}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Python ${endpoint} failed.`);
  return data;
}

/** Python GET with optional query params */
async function pythonGet(endpoint,  params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${getPythonUrl()}${endpoint}?${qs}` : `${getPythonUrl()}${endpoint}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Python GET ${endpoint} failed.`);
  return data;
}

/** Python DELETE */
async function pythonDelete(endpoint) {
  const res = await fetch(`${getPythonUrl()}${endpoint}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Python DELETE ${endpoint} failed.`);
  return data;
}

// ---------------------------------------------------------------------------
// Helper — build system prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return `You are DocRack Copilot, an intelligent AI assistant for document management and analysis.

You help users understand, search, analyze, and extract information from their documents.
You work with any type of document in any domain: business, legal, financial, medical,
academic, personal, HR, operations, engineering, research, or any other field.

RULES:
1. Answer based ONLY on the provided document excerpts. Never make up information.
2. Always cite sources using [Source: filename] format.
3. If you cannot find the answer, say clearly: "I couldn't find this in your documents."
4. Be precise with numbers, dates, names — quote them exactly as they appear.
5. Note any inconsistencies between documents.
6. Adapt your analysis style to the document domain (legal docs get legal analysis,
   financial docs get financial analysis, technical docs get technical analysis).
7. When summarizing, provide structured summaries with key points.
8. Suggest relevant follow-up questions the user might want to ask.`;
}

// ---------------------------------------------------------------------------
// Helper — build messages array for Gemini
// ---------------------------------------------------------------------------

function buildMessages(formattedChunks, history, userMessage) {
  const messages = [];

  // Add conversation history
  if (history && history.length > 0) {
    for (const msg of history) {
      messages.push({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }],
      });
    }
  }

  // Build user message with document context
  const contextBlock = formattedChunks
    ? `\n\nRelevant document excerpts:\n${formattedChunks}\n\nUser question: ${userMessage}`
    : userMessage;

  messages.push({
    role: 'user',
    parts: [{ text: contextBlock }],
  });

  return messages;
}

// ---------------------------------------------------------------------------
// Helper — Gemini function calling tool definitions
// ---------------------------------------------------------------------------

const COPILOT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'search_documents',
        description: 'Search for information across documents using semantic and keyword search',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'What to search for' },
            scope_type: { type: 'STRING', description: 'file, folder, dataroom, or global' },
            scope_ids: { type: 'ARRAY', items: { type: 'STRING' }, description: 'IDs to scope the search' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_file_content',
        description: 'Get the full extracted text content of a specific file',
        parameters: {
          type: 'OBJECT',
          properties: {
            file_id: { type: 'STRING', description: 'The file ID' },
          },
          required: ['file_id'],
        },
      },
      {
        name: 'list_files',
        description: 'List all files in a DataRoom with their types, sizes, and folders',
        parameters: {
          type: 'OBJECT',
          properties: {
            dataroom_id: { type: 'STRING' },
            folder_id: { type: 'STRING', description: 'Optional: specific folder' },
          },
          required: ['dataroom_id'],
        },
      },
      {
        name: 'get_entities',
        description: 'Get extracted entities (organizations, people, amounts, dates) from a file or DataRoom',
        parameters: {
          type: 'OBJECT',
          properties: {
            scope_type: { type: 'STRING', description: 'file or dataroom' },
            scope_id: { type: 'STRING' },
          },
          required: ['scope_type', 'scope_id'],
        },
      },
      {
        name: 'find_similar',
        description: 'Find documents similar to a given document across all DataRooms',
        parameters: {
          type: 'OBJECT',
          properties: {
            file_id: { type: 'STRING' },
            max_results: { type: 'INTEGER', description: 'Max results, default 5' },
          },
          required: ['file_id'],
        },
      },
    ],
  },
];

// Tool whitelist — only these tools may be executed
const ALLOWED_TOOLS = new Set([
  'search_documents',
  'get_file_content',
  'list_files',
  'get_entities',
  'find_similar',
]);

// ---------------------------------------------------------------------------
// Helper — stream one round from Express SSE, return { text, toolCalls }
// ---------------------------------------------------------------------------

async function streamFromExpress(event, body) {
  const response = await fetch(`${getExpressUrl()}/api/v1/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
    signal: activeStreamController ? activeStreamController.signal : undefined,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || errData.detail || 'Chat stream request failed.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let toolCalls = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // Keep the last incomplete line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      let parsed;
      try {
        parsed = JSON.parse(trimmed.slice(6));
      } catch {
        log.warn('copilot: failed to parse SSE line:', trimmed);
        continue;
      }

      switch (parsed.type) {
        case 'chunk':
          text += parsed.text;
          event.sender.send('copilot:stream-chunk', { text: parsed.text });
          break;
        case 'tool_call':
          toolCalls.push({ name: parsed.name, args: parsed.args });
          break;
        case 'tool_call_stop':
          // Stream ended for this round — tool execution needed
          break;
        case 'error':
          event.sender.send('copilot:stream-error', { message: parsed.message });
          break;
        case 'end':
          // Normal completion
          break;
      }
    }
  }

  return { text, toolCalls };
}

// ---------------------------------------------------------------------------
// Helper — execute a tool via Python
// ---------------------------------------------------------------------------

async function executeTool(name, args) {
  // Whitelist check
  if (!ALLOWED_TOOLS.has(name)) {
    log.warn(`copilot: rejected disallowed tool call: ${name}`);
    return { error: `Tool not allowed: ${name}` };
  }

  const ctx = getUserContext();

  const toolEndpoints = {
    search_documents:  '/api/v1/copilot/tool/search',
    get_file_content:  '/api/v1/copilot/tool/get-file-content',
    list_files:        '/api/v1/copilot/tool/list-files',
    get_entities:      '/api/v1/copilot/tool/get-entities',
    find_similar:      '/api/v1/copilot/tool/find-similar',
  };

  const endpoint = toolEndpoints[name];
  if (!endpoint) return { error: `Unknown tool: ${name}` };

  try {
    return await pythonPost(endpoint, { ...args, ...ctx });
  } catch (err) {
    log.error(`copilot: tool ${name} failed:`, err.message);
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Register all copilot IPC handlers
// ---------------------------------------------------------------------------

/**
 * Registers Copilot IPC handlers.
 *
 * Copilot orchestration:
 *   - Streaming chat with SSE + tool call loop (max 3 rounds)
 *   - Background indexing pipeline (7-step per file)
 *   - Audit, simulate, insights via 3-step flows
 *   - Passthrough handlers for session/suggestions/indexing CRUD
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 */
function registerCopilotHandlers(ipcMain, getMainWindow) {

  // ── copilot:send-message (streaming chat) ────────────────

  ipcMain.handle('copilot:send-message', async (event, data) => {
    try {
      activeStreamController = new AbortController();
      const ctx = getUserContext();

      // Step 1: Embed the user query via Express
      const embedResult = await expressPost('/api/v1/ai/embed', {
        texts: [data.message],
      });
      const queryVector = embedResult.vectors[0];

      // Step 2: Hybrid search via Python
      const searchResults = await pythonPost('/api/v1/copilot/search', {
        query_text: data.message,
        query_vector: queryVector,
        scope_type: data.scope_type,
        scope_ids: data.scope_ids,
        session_id: data.session_id,
        scope_name: data.scope_name,
        ...ctx,
      });

      // Step 3: Stream with tool call loop (max 3 rounds)
      let messages = buildMessages(
        searchResults.formatted_chunks,
        searchResults.history,
        data.message,
      );
      let fullText = '';
      let allToolCalls = [];
      const maxRounds = 3;

      for (let round = 0; round < maxRounds; round++) {
        const isLastRound = round === maxRounds - 1;

        const streamResult = await streamFromExpress(event, {
          system_prompt: buildSystemPrompt(),
          messages,
          tools: isLastRound ? undefined : COPILOT_TOOLS,
          tool_config: isLastRound ? undefined : { mode: 'AUTO' },
        });

        fullText += streamResult.text;

        if (streamResult.toolCalls.length === 0) {
          // Gemini is done — send final event to React
          event.sender.send('copilot:stream-end', {
            sources: searchResults.sources,
            session_id: searchResults.session_id,
          });
          break;
        }

        // Tool call(s) — execute via Python, then loop
        for (const tc of streamResult.toolCalls) {
          allToolCalls.push(tc);
          event.sender.send('copilot:stream-reasoning', {
            step: `Using ${tc.name}...`,
          });

          const toolResult = await executeTool(tc.name, tc.args);

          // Append tool call + result to message history for next round
          messages.push({
            role: 'model',
            parts: [{ functionCall: { name: tc.name, args: tc.args } }],
          });
          messages.push({
            role: 'user',
            parts: [{ functionResponse: { name: tc.name, response: toolResult } }],
          });
        }
        // Loop continues — next round makes a new Express call with updated messages
      }

      // Step 4: Save to SQLite via Python
      await pythonPost('/api/v1/copilot/save-message', {
        session_id: searchResults.session_id,
        user_message: data.message,
        assistant_response: fullText,
        sources: JSON.stringify(searchResults.sources || []),
        tool_calls: JSON.stringify(allToolCalls),
        ...ctx,
      });

      // Generate title if first message in session
      if (!searchResults.session_title) {
        try {
          const titleResult = await expressPost('/api/v1/ai/generate-title', {
            message: data.message,
          });
          await pythonPost('/api/v1/copilot/update-session-title', {
            session_id: searchResults.session_id,
            title: titleResult.title,
            ...ctx,
          });
        } catch (err) {
          log.warn('copilot: title generation failed (non-fatal):', err.message);
        }
      }

      activeStreamController = null;
      return { success: true, session_id: searchResults.session_id };
    } catch (err) {
      activeStreamController = null;
      if (err.name === 'AbortError') {
        log.info('copilot: stream cancelled by user');
        return { success: false, error: 'Stream cancelled.' };
      }
      log.error('copilot:send-message failed:', err.message);
      event.sender.send('copilot:stream-error', { message: err.message });
      return { success: false, error: err.message };
    }
  });

  // ── copilot:cancel-stream ────────────────────────────────

  ipcMain.handle('copilot:cancel-stream', async () => {
    if (activeStreamController) {
      activeStreamController.abort();
      activeStreamController = null;
      log.info('copilot: stream aborted');
    }
    return { success: true };
  });

  // ── copilot:index-files (background indexing pipeline) ───

  ipcMain.handle('copilot:index-files', async (event, { file_ids, dataroom_id }) => {
    const ctx = getUserContext();
    const total = file_ids.length;
    let completed = 0;

    const win = getMainWindow();

    for (const fileId of file_ids) {
      try {
        // 1. Prepare index via Python
        const prepared = await pythonPost('/api/v1/copilot/prepare-index', {
          file_ids: [fileId],
          dataroom_id,
          ...ctx,
        });

        const fileData = prepared.files && prepared.files[0];
        if (!fileData) {
          log.warn(`copilot: prepare-index returned no data for file ${fileId}`);
          completed++;
          continue;
        }

        // If duplicate: skip embedding
        if (fileData.is_duplicate) {
          log.info(`copilot: file ${fileId} is duplicate of ${fileData.duplicate_of}, skipping embedding`);
          completed++;
          if (win && !win.isDestroyed()) {
            win.webContents.send('copilot:index-progress', {
              completed, total, current_file: fileId, status: 'duplicate',
            });
          }
          continue;
        }

        // 2. Embed chunk texts via Express
        const chunkTexts = fileData.chunks.map(c => c.text);
        const embedResult = await expressPost('/api/v1/ai/embed', {
          texts: chunkTexts,
        });

        // 3. Apply index via Python (store in ChromaDB + FTS5)
        await pythonPost('/api/v1/copilot/apply-index', {
          file_id: fileId,
          dataroom_id,
          chunks: fileData.chunks,
          vectors: embedResult.vectors,
          embedding_model: embedResult.model || 'gemini-embedding-001',
          file_size_bytes: fileData.file_size_bytes,
          file_mtime: fileData.file_mtime,
          ...ctx,
        });

        // 4. Extract entities via Express
        try {
          const entityText = fileData.first_2000_chars || '';
          if (entityText.length > 0) {
            const entities = await expressPost('/api/v1/ai/extract-entities', {
              text: entityText,
            });

            // 5. Apply entities via Python
            await pythonPost('/api/v1/copilot/apply-entities', {
              file_id: fileId,
              dataroom_id,
              entities,
              ...ctx,
            });
          }
        } catch (err) {
          log.warn(`copilot: entity extraction failed for file ${fileId} (non-fatal):`, err.message);
        }

        // 6. Summarize file via Express
        try {
          const summaryText = fileData.first_2000_chars || '';
          if (summaryText.length > 0) {
            const summaryResult = await expressPost('/api/v1/ai/summarize-file', {
              text: summaryText,
            });

            // 7. Apply summary via Python
            await pythonPost('/api/v1/copilot/apply-summary', {
              file_id: fileId,
              summary: summaryResult.summary,
              ...ctx,
            });
          }
        } catch (err) {
          log.warn(`copilot: summary generation failed for file ${fileId} (non-fatal):`, err.message);
        }

        completed++;
        if (win && !win.isDestroyed()) {
          win.webContents.send('copilot:index-progress', {
            completed, total, current_file: fileId, status: 'complete',
          });
        }
      } catch (err) {
        log.error(`copilot: indexing failed for file ${fileId}:`, err.message);
        completed++;
        if (win && !win.isDestroyed()) {
          win.webContents.send('copilot:index-progress', {
            completed, total, current_file: fileId, status: 'failed',
          });
        }
        // Continue to next file
      }
    }

    return { success: true, completed, total };
  });

  // ── copilot:audit-dataroom (3-step) ──────────────────────

  ipcMain.handle('copilot:audit-dataroom', async (_event, { dataroom_id, audit_type }) => {
    try {
      const ctx = getUserContext();

      // Step 1: Python prepares audit data
      const auditData = await pythonPost('/api/v1/copilot/prepare-audit', {
        dataroom_id,
        ...ctx,
      });

      // Step 2: Express calls Gemini with audit prompt
      const auditResult = await expressPost('/api/v1/ai/audit', {
        audit_data: auditData,
        audit_type: audit_type || 'general',
      });

      // Step 3: Python applies audit result
      const applied = await pythonPost('/api/v1/copilot/apply-audit', {
        dataroom_id,
        audit_result: auditResult,
        ...ctx,
      });

      return { success: true, audit_result: auditResult, session_id: applied.session_id };
    } catch (err) {
      log.error('copilot:audit-dataroom failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── copilot:simulate-review (3-step) ─────────────────────

  ipcMain.handle('copilot:simulate-review', async (_event, { dataroom_id, simulation_type, custom_role }) => {
    try {
      const ctx = getUserContext();

      // Step 1: Python prepares data (same as audit)
      const simData = await pythonPost('/api/v1/copilot/prepare-audit', {
        dataroom_id,
        ...ctx,
      });

      // Step 2: Express calls Gemini with simulation prompt
      const simResult = await expressPost('/api/v1/ai/simulate', {
        simulation_data: simData,
        simulation_type,
        custom_role,
      });

      // Step 3: Python applies result as chat session
      const applied = await pythonPost('/api/v1/copilot/apply-audit', {
        dataroom_id,
        audit_result: simResult,
        ...ctx,
      });

      return { success: true, simulation_result: simResult, session_id: applied.session_id };
    } catch (err) {
      log.error('copilot:simulate-review failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── copilot:generate-insights (3-step) ───────────────────

  ipcMain.handle('copilot:generate-insights', async (_event, { dataroom_id }) => {
    try {
      const ctx = getUserContext();

      // Step 1: Python prepares insights data
      const insightsData = await pythonPost('/api/v1/copilot/prepare-insights', {
        dataroom_id,
        ...ctx,
      });

      // Step 2: Express generates insights via Gemini
      const insightsResult = await expressPost('/api/v1/ai/generate-insights', {
        insights_data: insightsData,
      });

      // Step 3: Python applies insights
      const applied = await pythonPost('/api/v1/copilot/apply-insights', {
        dataroom_id,
        ...insightsResult,
        ...ctx,
      });

      return { success: true, insights: applied };
    } catch (err) {
      log.error('copilot:generate-insights failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Passthrough handlers (Python direct) ─────────────────

  ipcMain.handle('copilot:get-sessions', async (_event, data) => {
    try {
      const ctx = getUserContext();
      const params = { ...ctx };
      if (data && data.scope_type) params.scope_type = data.scope_type;
      if (data && data.scope_id) params.scope_id = data.scope_id;
      const result = await pythonGet('/api/v1/chat/sessions', params);
      return { success: true, sessions: result.sessions || result };
    } catch (err) {
      log.error('copilot:get-sessions failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('copilot:get-messages', async (_event, data) => {
    try {
      const ctx = getUserContext();
      const result = await pythonGet(
        `/api/v1/chat/sessions/${encodeURIComponent(data.session_id)}/messages`,
        ctx,
      );
      return { success: true, messages: result.messages || result };
    } catch (err) {
      log.error('copilot:get-messages failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('copilot:delete-session', async (_event, data) => {
    try {
      const ctx = getUserContext();
      await pythonDelete(
        `/api/v1/chat/sessions/${encodeURIComponent(data.session_id)}?db_path=${encodeURIComponent(ctx.db_path)}`,
      );
      return { success: true };
    } catch (err) {
      log.error('copilot:delete-session failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('copilot:get-suggestions', async (_event, data) => {
    try {
      const ctx = getUserContext();
      const result = await pythonGet('/api/v1/chat/suggestions', {
        dataroom_id: data.dataroom_id,
        ...ctx,
      });

      // If stale: generate fresh suggestions via Express
      if (result.stale && result.data_for_generation) {
        try {
          const generated = await expressPost('/api/v1/ai/generate-suggestions', {
            file_names: result.data_for_generation.file_names,
            folder_names: result.data_for_generation.folder_names,
          });
          // Apply generated suggestions via Python
          await pythonPost('/api/v1/copilot/apply-insights', {
            dataroom_id: data.dataroom_id,
            suggestions: generated.suggestions,
            ...ctx,
          });
          return { success: true, suggestions: generated.suggestions };
        } catch (err) {
          log.warn('copilot: suggestion generation failed (non-fatal):', err.message);
        }
      }

      return { success: true, suggestions: result.suggestions || [] };
    } catch (err) {
      log.error('copilot:get-suggestions failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('copilot:get-insights', async (_event, data) => {
    try {
      const ctx = getUserContext();
      const result = await pythonGet('/api/v1/chat/insights', {
        dataroom_id: data.dataroom_id,
        ...ctx,
      });
      return { success: true, insights: result.insights || result };
    } catch (err) {
      log.error('copilot:get-insights failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('copilot:get-index-status', async (_event, data) => {
    try {
      const ctx = getUserContext();
      const params = { ...ctx };
      if (data && data.dataroom_id) params.dataroom_id = data.dataroom_id;
      const result = await pythonGet('/api/v1/indexing/status', params);
      return { success: true, ...result };
    } catch (err) {
      log.error('copilot:get-index-status failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('copilot:retry-indexing', async (_event, data) => {
    try {
      const ctx = getUserContext();
      const result = await pythonPost('/api/v1/indexing/retry-failed', {
        dataroom_id: data.dataroom_id,
        ...ctx,
      });
      return { success: true, ...result };
    } catch (err) {
      log.error('copilot:retry-indexing failed:', err.message);
      return { success: false, error: err.message };
    }
  });
}

// ---------------------------------------------------------------------------
// Startup recovery — resume pending indexing jobs
// ---------------------------------------------------------------------------

/**
 * Called from main.js after /init-db completes.
 * Checks for pending indexing jobs and auto-resumes them in the background.
 *
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 */
async function resumePendingIndexing(getMainWindow) {
  try {
    const ctx = getUserContext();
    const status = await pythonGet('/api/v1/indexing/status', ctx);

    if (status.pending > 0) {
      log.info(`copilot: resuming ${status.pending} pending indexing jobs from previous session`);

      // Get the pending file IDs
      const pendingResult = await pythonGet('/api/v1/indexing/pending-files', ctx);
      const pendingFiles = pendingResult.files || [];

      if (pendingFiles.length > 0) {
        // Group by dataroom_id and trigger indexing in background
        const grouped = {};
        for (const f of pendingFiles) {
          if (!grouped[f.dataroom_id]) grouped[f.dataroom_id] = [];
          grouped[f.dataroom_id].push(f.file_id);
        }

        for (const [dataroomId, fileIds] of Object.entries(grouped)) {
          // Fire and forget — runs in background, does not block startup
          const win = getMainWindow();
          const fakeEvent = {
            sender: win && !win.isDestroyed() ? win.webContents : { send: () => {} },
          };
          // Use a pseudo-event that mimics the IPC event shape
          registerCopilotHandlers._indexFilesInternal(fakeEvent, { file_ids: fileIds, dataroom_id: dataroomId })
            .catch(err => log.error('copilot: startup indexing recovery failed:', err.message));
        }
      }
    }
  } catch (err) {
    // Non-fatal — don't crash startup if indexing status check fails
    log.warn('copilot: startup indexing recovery check failed (non-fatal):', err.message);
  }
}

// Expose the index-files logic for startup recovery reuse
registerCopilotHandlers._indexFilesInternal = async function (event, { file_ids, dataroom_id }) {
  const ctx = getUserContext();
  const total = file_ids.length;
  let completed = 0;

  for (const fileId of file_ids) {
    try {
      const prepared = await pythonPost('/api/v1/copilot/prepare-index', {
        file_ids: [fileId], dataroom_id, ...ctx,
      });
      const fileData = prepared.files && prepared.files[0];
      if (!fileData) { completed++; continue; }
      if (fileData.is_duplicate) {
        log.info(`copilot: recovery - file ${fileId} is duplicate, skipping`);
        completed++;
        continue;
      }

      const chunkTexts = fileData.chunks.map(c => c.text);
      const embedResult = await expressPost('/api/v1/ai/embed', { texts: chunkTexts });

      await pythonPost('/api/v1/copilot/apply-index', {
        file_id: fileId, dataroom_id, chunks: fileData.chunks,
        vectors: embedResult.vectors, embedding_model: embedResult.model || 'gemini-embedding-001',
        file_size_bytes: fileData.file_size_bytes, file_mtime: fileData.file_mtime, ...ctx,
      });

      // Entity extraction (best-effort)
      try {
        if (fileData.first_2000_chars) {
          const entities = await expressPost('/api/v1/ai/extract-entities', { text: fileData.first_2000_chars });
          await pythonPost('/api/v1/copilot/apply-entities', { file_id: fileId, dataroom_id, entities, ...ctx });
        }
      } catch { /* non-fatal */ }

      // Summary (best-effort)
      try {
        if (fileData.first_2000_chars) {
          const summary = await expressPost('/api/v1/ai/summarize-file', { text: fileData.first_2000_chars });
          await pythonPost('/api/v1/copilot/apply-summary', { file_id: fileId, summary: summary.summary, ...ctx });
        }
      } catch { /* non-fatal */ }

      completed++;
      if (event.sender && typeof event.sender.send === 'function') {
        event.sender.send('copilot:index-progress', { completed, total, current_file: fileId, status: 'complete' });
      }
    } catch (err) {
      log.error(`copilot: recovery indexing failed for file ${fileId}:`, err.message);
      completed++;
    }
  }
};

module.exports = { registerCopilotHandlers, resumePendingIndexing };
