/**
 * AI Controller — Express backend.
 *
 * Receives prepared data from Electron (fingerprints, folder trees),
 * calls Gemini via geminiService, and returns raw AI results.
 * Database updates happen in the Python backend — Express never touches SQLite.
 */

const geminiService = require('../services/geminiService');
const usageService  = require('../services/usageService');
const logger        = require('../services/logger');

// ── Classify files into existing folders ─────────────────

async function classify(req, res, next) {
  try {
    const { fingerprints, folder_tree, folder_ids, requestId } = req.body;

    if (!fingerprints || !Array.isArray(fingerprints) || fingerprints.length === 0) {
      return res.status(400).json({ success: false, error: 'fingerprints array is required and must not be empty.' });
    }

    if (!folder_tree || typeof folder_tree !== 'string') {
      return res.status(400).json({ success: false, error: 'folder_tree string is required.' });
    }

    if (!folder_ids || !Array.isArray(folder_ids) || folder_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'folder_ids array is required and must not be empty.' });
    }

    if (fingerprints.length > 100) {
      return res.status(400).json({ success: false, error: 'Maximum 100 files per classification request.' });
    }

    // ── Usage enforcement: reserve file capacity (atomic) ──
    const fileCount = fingerprints.length;
    const reservation = await usageService.reserveFiles(req.user.userId, fileCount, requestId);

    if (!reservation.reserved && !reservation.idempotent) {
      return res.status(429).json({
        success: false,
        error: `Monthly file upload limit reached (${reservation.limit}). Resets ${reservation.resetsAt?.toISOString()}.`,
        current: reservation.current,
        limit: reservation.limit,
        remaining: reservation.remaining,
        resetsAt: reservation.resetsAt,
      });
    }

    // ── Call Gemini — rollback reservation on failure ──────
    let results;
    try {
      results = await geminiService.classifyFiles(fingerprints, folder_tree, folder_ids);
    } catch (geminiErr) {
      // Rollback: classification failed, don't count these files
      if (reservation.reserved) {
        await usageService.rollbackFiles(req.user.userId, fileCount, requestId);
      }
      throw geminiErr;
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    next(err);
  }
}

// ── Generate DataRoom structure ──────────────────────────

async function generateDataroom(req, res, next) {
  try {
    const { dataroom_name, dataroom_description, fingerprints, requestId } = req.body;

    if (!dataroom_name || typeof dataroom_name !== 'string' || !dataroom_name.trim()) {
      return res.status(400).json({ success: false, error: 'dataroom_name is required.' });
    }

    if (!fingerprints || !Array.isArray(fingerprints) || fingerprints.length === 0) {
      return res.status(400).json({ success: false, error: 'fingerprints array is required and must not be empty.' });
    }

    if (fingerprints.length > 100) {
      return res.status(400).json({ success: false, error: 'Maximum 100 files per generation request.' });
    }

    // ── Usage enforcement: reserve file capacity (atomic) ──
    const fileCount = fingerprints.length;
    const reservation = await usageService.reserveFiles(req.user.userId, fileCount, requestId);

    if (!reservation.reserved && !reservation.idempotent) {
      return res.status(429).json({
        success: false,
        error: `Monthly file upload limit reached (${reservation.limit}). Resets ${reservation.resetsAt?.toISOString()}.`,
        current: reservation.current,
        limit: reservation.limit,
        remaining: reservation.remaining,
        resetsAt: reservation.resetsAt,
      });
    }

    // ── Call Gemini — rollback reservation on failure ──────
    let geminiResult;
    try {
      geminiResult = await geminiService.generateDataroom(
        dataroom_name.trim(),
        dataroom_description || '',
        fingerprints,
      );
    } catch (geminiErr) {
      if (reservation.reserved) {
        await usageService.rollbackFiles(req.user.userId, fileCount, requestId);
      }
      throw geminiErr;
    }

    return res.status(200).json({ success: true, gemini_result: geminiResult });
  } catch (err) {
    next(err);
  }
}

// ── Embed texts (V1 Copilot) ─────────────────────────────

async function embed(req, res, next) {
  try {
    const { texts } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ success: false, error: 'texts array is required and must not be empty.' });
    }

    const vectors = await geminiService.embedTexts(texts);

    return res.status(200).json({ success: true, vectors });
  } catch (err) {
    next(err);
  }
}

// ── Extract entities (V1 Copilot) ────────────────────────

async function extractEntities(req, res, next) {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'text is required.' });
    }

    const entities = await geminiService.extractEntities(text);

    return res.status(200).json({ success: true, entities });
  } catch (err) {
    next(err);
  }
}

// ── Summarize file (V1 Copilot) ──────────────────────────

async function summarizeFile(req, res, next) {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'text is required.' });
    }

    const summary = await geminiService.summarizeFile(text);

    return res.status(200).json({ success: true, summary });
  } catch (err) {
    next(err);
  }
}

// ── Generate title (V1 Copilot) ──────────────────────────

async function generateTitle(req, res, next) {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'message is required.' });
    }

    const title = await geminiService.generateTitle(message);

    return res.status(200).json({ success: true, title });
  } catch (err) {
    next(err);
  }
}




// ── Phase C2 — Copilot Chat, Audit, Simulate, Insights ──

// Gemini function calling tool declarations
// IMPORTANT: Only include tools that Electron can execute via executeTool() in a single
// Python call. Multi-step tools (compare_documents, summarize_dataroom, extract_data_point,
// audit_dataroom) have their own dedicated IPC handlers and should NOT be offered here.
const COPILOT_TOOL_DECLARATIONS = [
  {
    name: 'search_documents',
    description: 'Search through indexed documents for relevant content using semantic and keyword matching.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The search query to find relevant document content',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_file_content',
    description: 'Get the full extracted text content of a specific file.',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_id: {
          type: 'STRING',
          description: 'The ID of the file to retrieve content from',
        },
      },
      required: ['file_id'],
    },
  },
  {
    name: 'list_files',
    description: 'List all files in the current scope with their names, types, sizes, and summaries.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_entities',
    description: 'Get extracted entities (organizations, people, dates, monetary values, etc.) from document scope.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'find_similar',
    description: 'Find documents that are similar to a specific file across all DataRooms.',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_id: {
          type: 'STRING',
          description: 'The ID of the file to find similar documents for',
        },
      },
      required: ['file_id'],
    },
  },
];


/**
 * POST /api/v1/ai/chat/stream
 * Streaming chat via SSE. Each tool round is a fresh request — max 3 rounds.
 */
async function chatStream(req, res, next) {
  try {
    const { system_prompt, messages, tools_enabled, tool_round, requestId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'messages array is required.' });
    }

    // Enforce max 3 tool rounds
    const currentRound = tool_round || 0;
    if (currentRound >= 3) {
      return res.status(400).json({ success: false, error: 'Maximum tool call rounds (3) exceeded.' });
    }

    // ── Usage enforcement: check + increment message count ─
    // Only count on round 0 (the initial user message, not tool-call follow-ups)
    if (currentRound === 0) {
      const msgCheck = await usageService.checkMessageLimit(req.user.userId);
      if (!msgCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: `Daily copilot message limit reached (${msgCheck.limit}). Resets ${msgCheck.resetsAt?.toISOString()}.`,
          current: msgCheck.current,
          limit: msgCheck.limit,
          remaining: msgCheck.remaining,
          resetsAt: msgCheck.resetsAt,
        });
      }

      // Increment BEFORE LLM call (charge-on-entry)
      await usageService.incrementMessages(req.user.userId, requestId);
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Pass tool declarations only if enabled
    const tools = tools_enabled !== false ? COPILOT_TOOL_DECLARATIONS : null;

    await geminiService.chatStream(
      res,
      system_prompt || null,
      messages,
      tools,
      tools_enabled !== false ? { mode: 'AUTO' } : null,
    );

    res.end();
  } catch (err) {
    // If headers already sent, write error as SSE
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    } else {
      next(err);
    }
  }
}

/**
 * POST /api/v1/ai/chat
 * Non-streaming chat fallback.
 */
async function chat(req, res, next) {
  try {
    const { system_prompt, messages, tools_enabled, requestId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'messages array is required.' });
    }

    // ── Usage enforcement: check + increment message count ─
    const msgCheck = await usageService.checkMessageLimit(req.user.userId);
    if (!msgCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Daily copilot message limit reached (${msgCheck.limit}). Resets ${msgCheck.resetsAt?.toISOString()}.`,
        current: msgCheck.current,
        limit: msgCheck.limit,
        remaining: msgCheck.remaining,
        resetsAt: msgCheck.resetsAt,
      });
    }

    // Increment BEFORE LLM call (charge-on-entry)
    await usageService.incrementMessages(req.user.userId, requestId);

    const tools = tools_enabled !== false ? COPILOT_TOOL_DECLARATIONS : null;

    const result = await geminiService.chatNonStreaming(
      system_prompt || null,
      messages,
      tools,
      tools_enabled !== false ? { mode: 'AUTO' } : null,
    );

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/ai/audit
 * Run a DataRoom audit via Gemini.
 */
async function auditDataroom(req, res, next) {
  try {
    const { audit_data, audit_type, custom_prompt } = req.body;

    if (!audit_data || typeof audit_data !== 'object') {
      return res.status(400).json({ success: false, error: 'audit_data object is required.' });
    }

    const result = await geminiService.audit(
      audit_data,
      audit_type || 'general',
      custom_prompt,
    );

    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/ai/simulate
 * Run a role simulation via Gemini.
 */
async function simulateRole(req, res, next) {
  try {
    const { simulation_data, simulation_type, custom_role } = req.body;

    if (!simulation_data || typeof simulation_data !== 'object') {
      return res.status(400).json({ success: false, error: 'simulation_data object is required.' });
    }

    const result = await geminiService.simulate(
      simulation_data,
      simulation_type || 'critical_reviewer',
      custom_role,
    );

    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/ai/generate-insights
 * Generate DataRoom insights via Gemini.
 */
async function insightsGenerate(req, res, next) {
  try {
    const { insights_data } = req.body;

    if (!insights_data || typeof insights_data !== 'object') {
      return res.status(400).json({ success: false, error: 'insights_data object is required.' });
    }

    const result = await geminiService.generateInsights(insights_data);

    return res.status(200).json({ success: true, insights: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/ai/generate-suggestions
 * Generate context-aware suggested questions via Gemini.
 */
async function suggestionsGenerate(req, res, next) {
  try {
    const { file_names, folder_names } = req.body;

    if (!file_names || !Array.isArray(file_names)) {
      return res.status(400).json({ success: false, error: 'file_names array is required.' });
    }

    const result = await geminiService.generateSuggestions(
      file_names,
      folder_names || [],
    );

    return res.status(200).json({ success: true, suggestions: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  classify,
  generateDataroom,
  embed,
  extractEntities,
  summarizeFile,
  generateTitle,
  // Phase C2
  chatStream,
  chat,
  auditDataroom,
  simulateRole,
  insightsGenerate,
  suggestionsGenerate,
};
