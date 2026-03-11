/**
 * Gemini Service — Express backend only.
 *
 * Owns the GEMINI_API_KEY and all Google Gemini API communication.
 * No other layer may call Gemini directly — this is the single gateway.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL_NAME = 'gemini-2.0-flash';
const TEMPERATURE = 0.1;
const MAX_RETRIES = 3;
const BATCH_SIZE = 10;
const MAX_PARALLEL_BATCHES = 5;

// ── Gemini client ────────────────────────────────────────

function _getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in express-backend/.env');
  return new GoogleGenerativeAI(apiKey);
}

// ── Low-level Gemini call with retries ───────────────────

async function _callGemini(systemPrompt, userPrompt, retries = MAX_RETRIES) {
  const genAI = _getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
    generationConfig: { temperature: TEMPERATURE },
  });

  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await model.generateContent(userPrompt);
      let raw = result.response.text();

      // Strip markdown code fences if present
      raw = raw.replace(/^```(?:json)?\s*\n?/gm, '');
      raw = raw.replace(/\n?```\s*$/gm, '');
      raw = raw.trim();

      // Validate it's parseable JSON
      JSON.parse(raw);
      return raw;
    } catch (e) {
      lastError = e;

      // On second attempt, append a re-prompt hint for JSON issues
      if (e instanceof SyntaxError && attempt === 1) {
        userPrompt +=
          '\n\nIMPORTANT: Your previous response was not valid JSON. ' +
          'Return ONLY a valid JSON object/array with no extra text.';
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }

  throw new Error(`Gemini API failed after ${retries} attempts: ${lastError?.message}`);
}

// ── Classification ───────────────────────────────────────

const CLASSIFY_SYSTEM_PROMPT =
  'You are a document classification AI. You assign files to the most ' +
  'appropriate folder based on file name, content preview, and folder context descriptions.\n\n' +
  'Rules:\n' +
  '1. Return ONLY a JSON array — no markdown, no explanation.\n' +
  '2. Each element must have: file_id, folder_id (or null), confidence (0.0-1.0), reasoning (short string).\n' +
  '3. folder_id must be one of the provided folder IDs, or null if no folder fits.\n' +
  '4. confidence should reflect how well the file matches the chosen folder.\n';

async function _classifyBatch(batch, folderTree, folderIdsSet) {
  const filesJson = JSON.stringify(batch, null, 2);

  const userPrompt =
    `## Folder structure\n${folderTree}\n\n` +
    `## Files to classify\n${filesJson}\n\n` +
    'Classify each file into the best-matching folder. ' +
    'Return a JSON array of objects with keys: file_id, folder_id, confidence, reasoning.';

  const raw = await _callGemini(CLASSIFY_SYSTEM_PROMPT, userPrompt);
  const results = JSON.parse(raw);

  // Validate and sanitise folder IDs
  return results.map((r) => ({
    file_id: r.file_id,
    folder_id: r.folder_id != null && folderIdsSet.has(r.folder_id) ? r.folder_id : null,
    confidence: parseFloat(r.confidence || 0),
    reasoning: r.reasoning || '',
  }));
}

/**
 * Classify files into folders using Gemini.
 *
 * @param {Array} fingerprints - File fingerprint objects from Python
 * @param {string} folderTree  - Text representation of folder hierarchy
 * @param {string[]} folderIds - Valid folder IDs
 * @returns {Promise<Array>} Classification results
 */
async function classifyFiles(fingerprints, folderTree, folderIds) {
  const folderIdsSet = new Set(folderIds);

  // Split into batches of BATCH_SIZE
  const batches = [];
  for (let i = 0; i < fingerprints.length; i += BATCH_SIZE) {
    batches.push(fingerprints.slice(i, i + BATCH_SIZE));
  }

  // Process batches in chunks of MAX_PARALLEL_BATCHES
  const allResults = [];
  for (let i = 0; i < batches.length; i += MAX_PARALLEL_BATCHES) {
    const chunk = batches.slice(i, i + MAX_PARALLEL_BATCHES);
    const batchResults = await Promise.all(
      chunk.map((batch) => _classifyBatch(batch, folderTree, folderIdsSet))
    );
    for (const br of batchResults) {
      allResults.push(...br);
    }
  }

  return allResults;
}

// ── DataRoom generation ──────────────────────────────────

const GENERATE_SYSTEM_PROMPT =
  'You are a document organization AI. Given a set of files, you create ' +
  'a logical folder structure and assign each file to the best folder.\n\n' +
  'Rules:\n' +
  '1. Return ONLY a JSON object — no markdown, no explanation.\n' +
  '2. The JSON must have two keys: \'folders\' and \'assignments\'.\n' +
  '3. \'folders\' is an array of objects with: name, context (description of what belongs here), ' +
  'children (array of nested folder objects, same structure, can be empty).\n' +
  '4. \'assignments\' is an array of objects with: file_id, folder_path (array of folder names ' +
  'from root to target, e.g. [\'Legal\', \'Contracts\']), confidence (0.0-1.0), reasoning.\n' +
  '5. Create 3-10 top-level folders. Use subfolders only when clearly needed.\n' +
  '6. Every file must appear in assignments, even if confidence is low.\n' +
  '7. folder_path must match exactly the folder names you defined.\n';

/**
 * Generate a DataRoom folder structure and file assignments using Gemini.
 *
 * @param {string} name         - DataRoom name
 * @param {string} description  - DataRoom description
 * @param {Array} fingerprints  - File fingerprint objects from Python
 * @returns {Promise<Object>} Gemini result with folders and assignments
 */
async function generateDataroom(name, description, fingerprints) {
  const filesJson = JSON.stringify(fingerprints, null, 2);

  const userPrompt =
    `## DataRoom: ${name}\n` +
    `## Description: ${description || 'No description provided'}\n\n` +
    `## Files to organize (${fingerprints.length} files)\n${filesJson}\n\n` +
    'Create an organized folder structure and assign each file to the best folder.';

  const raw = await _callGemini(GENERATE_SYSTEM_PROMPT, userPrompt);
  return JSON.parse(raw);
}

// ── Embeddings (V1 Copilot) ──────────────────────────────

const EMBEDDING_BATCH_SIZE = 50;

/**
 * Batch embed texts via Gemini embedding API.
 *
 * @param {string[]} texts - Array of text strings to embed
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function embedTexts(texts) {
  const genAI = _getClient();
  const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

  const model = genAI.getGenerativeModel({ model: embeddingModel });

  const allVectors = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await model.batchEmbedContents({
          requests: batch.map((text) => ({
            content: { parts: [{ text }] },
          })),
        });

        for (const emb of result.embeddings) {
          allVectors.push(emb.values);
        }
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        }
      }
    }

    if (lastError) {
      throw new Error(`Embedding failed after ${MAX_RETRIES} attempts: ${lastError.message}`);
    }
  }

  return allVectors;
}

// ── Entity extraction (V1 Copilot) ──────────────────────

const ENTITY_EXTRACTION_PROMPT =
  'Extract all notable entities from this document. Return JSON only, no markdown:\n' +
  '{\n' +
  '  "organizations": [],\n' +
  '  "people": [],\n' +
  '  "monetary_values": [],\n' +
  '  "dates": [],\n' +
  '  "locations": [],\n' +
  '  "key_terms": []\n' +
  '}\n' +
  'Do NOT assume any industry. Extract what\'s actually in the document.';

/**
 * Extract entities from document text via Gemini.
 *
 * @param {string} text - Document text to extract entities from
 * @returns {Promise<Object>} Parsed entity JSON
 */
async function extractEntities(text) {
  const raw = await _callGemini(ENTITY_EXTRACTION_PROMPT, text);
  return JSON.parse(raw);
}

// ── File summary (V1 Copilot) ────────────────────────────

const SUMMARIZE_SYSTEM_PROMPT =
  'Summarize this document in 2-3 sentences. Be specific about names, numbers, dates, key terms. ' +
  'Return ONLY the summary text, no JSON, no markdown formatting.';

/**
 * Generate a file summary via Gemini.
 *
 * @param {string} text - Document text (first 2000 chars)
 * @returns {Promise<string>} Summary text
 */
async function summarizeFile(text) {
  const genAI = _getClient();
  const chatModel = process.env.GEMINI_CHAT_MODEL || MODEL_NAME;
  const model = genAI.getGenerativeModel({
    model: chatModel,
    systemInstruction: SUMMARIZE_SYSTEM_PROMPT,
    generationConfig: { temperature: 0.2 },
  });

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(text);
      return result.response.text().trim();
    } catch (e) {
      lastError = e;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
  throw new Error(`Summarize failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

// ── Chat title generation (V1 Copilot) ───────────────────

const TITLE_SYSTEM_PROMPT =
  'Generate a concise 5-word title for a chat that starts with the given message. ' +
  'Return ONLY the title, nothing else. No quotes, no punctuation at the end.';

/**
 * Generate a chat session title via Gemini.
 *
 * @param {string} message - First user message
 * @returns {Promise<string>} Generated title
 */
async function generateTitle(message) {
  const genAI = _getClient();
  const chatModel = process.env.GEMINI_CHAT_MODEL || MODEL_NAME;
  const model = genAI.getGenerativeModel({
    model: chatModel,
    systemInstruction: TITLE_SYSTEM_PROMPT,
    generationConfig: { temperature: 0.3, maxOutputTokens: 20 },
  });

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(message);
      return result.response.text().trim();
    } catch (e) {
      lastError = e;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
  throw new Error(`Title generation failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

// ── Chat streaming (Phase C2 — Copilot) ──────────────────

// Whitelist of tools Electron may execute — reject anything else
const ALLOWED_TOOLS = new Set([
  'search_documents',
  'get_file_content',
  'list_files',
  'get_entities',
  'find_similar',
]);

const CHAT_SYSTEM_PROMPT =
  'You are DocRack Copilot, an intelligent AI assistant for document management and analysis.\n\n' +
  'You help users understand, search, analyze, and extract information from their documents.\n' +
  'You work with any type of document in any domain: business, legal, financial, medical,\n' +
  'academic, personal, HR, operations, engineering, research, or any other field.\n\n' +
  'RULES:\n' +
  '1. Answer based ONLY on the provided document excerpts. Never make up information.\n' +
  '2. Always cite sources using [Source: filename] format.\n' +
  '3. If you cannot find the answer, say clearly: "I couldn\'t find this in your documents."\n' +
  '4. Be precise with numbers, dates, names — quote them exactly as they appear.\n' +
  '5. Note any inconsistencies between documents.\n' +
  '6. Adapt your analysis style to the document domain (legal docs get legal analysis,\n' +
  '   financial docs get financial analysis, technical docs get technical analysis).\n' +
  '7. When summarizing, provide structured summaries with key points.\n' +
  '8. Suggest relevant follow-up questions the user might want to ask.\n';

/**
 * Stream chat responses via Gemini generateContentStream.
 * Writes SSE events to the Express response object.
 *
 * Events:
 *   data: {"type":"chunk","text":"..."}
 *   data: {"type":"tool_call","name":"...","args":{...}}
 *   data: {"type":"tool_call_stop"}
 *   data: {"type":"error","message":"..."}
 *   data: {"type":"end"}
 *
 * When Gemini returns a tool_call, the stream ends with tool_call_stop.
 * Electron executes the tool, then makes a NEW POST with updated messages.
 * Express does NOT hold the connection open. Each tool round is a fresh request.
 *
 * @param {object} res        - Express response object (for SSE writing)
 * @param {string} systemPrompt - System instruction (or null for default)
 * @param {Array}  messages    - Gemini conversation messages
 * @param {Array}  [tools]     - Gemini function declarations
 * @param {object} [toolConfig] - Gemini tool config
 */
async function chatStream(res, systemPrompt, messages, tools, toolConfig) {
  const genAI = _getClient();
  const chatModel = process.env.GEMINI_CHAT_MODEL || MODEL_NAME;
  const chatTemp = parseFloat(process.env.GEMINI_CHAT_TEMPERATURE || '0.3');
  const maxTokens = parseInt(process.env.GEMINI_CHAT_MAX_OUTPUT_TOKENS || '4096', 10);

  const modelConfig = {
    model: chatModel,
    systemInstruction: systemPrompt || CHAT_SYSTEM_PROMPT,
    generationConfig: { temperature: chatTemp, maxOutputTokens: maxTokens },
  };

  // Only add tools if provided
  if (tools && tools.length > 0) {
    modelConfig.tools = [{ functionDeclarations: tools }];
  }
  if (toolConfig) {
    modelConfig.toolConfig = { functionCallingConfig: { mode: toolConfig.mode || 'AUTO' } };
  }

  const model = genAI.getGenerativeModel(modelConfig);

  try {
    const result = await model.generateContentStream({ contents: messages });
    let hasToolCall = false;

    for await (const chunk of result.stream) {
      // Check for text content
      const textContent = chunk.candidates?.[0]?.content?.parts
        ?.filter(p => p.text)
        ?.map(p => p.text)
        ?.join('') || '';

      if (textContent) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: textContent })}\n\n`);
      }

      // Check for function calls
      const functionCalls = chunk.candidates?.[0]?.content?.parts
        ?.filter(p => p.functionCall) || [];

      if (functionCalls.length > 0) {
        for (const part of functionCalls) {
          // Whitelist check — reject hallucinated or unexpected tool names
          if (!ALLOWED_TOOLS.has(part.functionCall.name)) {
            console.warn(`[chatStream] Rejected tool call: ${part.functionCall.name}`);
            res.write(`data: ${JSON.stringify({
              type: 'error',
              message: `Blocked disallowed tool: ${part.functionCall.name}`,
            })}\n\n`);
            continue;
          }
          hasToolCall = true;
          res.write(`data: ${JSON.stringify({
            type: 'tool_call',
            name: part.functionCall.name,
            args: part.functionCall.args,
          })}\n\n`);
        }
      }
    }

    if (hasToolCall) {
      // Signal Electron to execute tool and make a new request
      res.write(`data: ${JSON.stringify({ type: 'tool_call_stop' })}\n\n`);
    } else {
      // Normal end — Gemini is done
      res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
  }
}

/**
 * Non-streaming chat fallback (for testing).
 *
 * @param {string} systemPrompt
 * @param {Array}  messages
 * @param {Array}  [tools]
 * @param {object} [toolConfig]
 * @returns {Promise<{response: string, tool_calls: Array}>}
 */
async function chatNonStreaming(systemPrompt, messages, tools, toolConfig) {
  const genAI = _getClient();
  const chatModel = process.env.GEMINI_CHAT_MODEL || MODEL_NAME;
  const chatTemp = parseFloat(process.env.GEMINI_CHAT_TEMPERATURE || '0.3');
  const maxTokens = parseInt(process.env.GEMINI_CHAT_MAX_OUTPUT_TOKENS || '4096', 10);

  const modelConfig = {
    model: chatModel,
    systemInstruction: systemPrompt || CHAT_SYSTEM_PROMPT,
    generationConfig: { temperature: chatTemp, maxOutputTokens: maxTokens },
  };

  if (tools && tools.length > 0) {
    modelConfig.tools = [{ functionDeclarations: tools }];
  }
  if (toolConfig) {
    modelConfig.toolConfig = { functionCallingConfig: { mode: toolConfig.mode || 'AUTO' } };
  }

  const model = genAI.getGenerativeModel(modelConfig);

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent({ contents: messages });
      const parts = result.response.candidates?.[0]?.content?.parts || [];

      const textParts = parts.filter(p => p.text).map(p => p.text);
      const toolCalls = parts.filter(p => p.functionCall).map(p => ({
        name: p.functionCall.name,
        args: p.functionCall.args,
      }));

      return { response: textParts.join(''), tool_calls: toolCalls };
    } catch (e) {
      lastError = e;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
  throw new Error(`Chat failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

// ── Audit (Phase C2 — Copilot) ───────────────────────────

const AUDIT_PROMPTS = {
  general:
    'You are a document management expert. Analyze this DataRoom comprehensively:\n' +
    '1. OVERVIEW: 2-3 sentence summary of the DataRoom contents\n' +
    '2. COMPLETENESS: What document types are present? What appears to be missing?\n' +
    '3. ORGANIZATION: Rate the folder structure quality. Are files well-categorized?\n' +
    '4. INCONSISTENCIES: Are there data mismatches, duplicates, or conflicting information?\n' +
    '5. SUGGESTIONS: 3-5 specific improvements\n' +
    '6. READINESS SCORE: Rate 1-10 with justification\n' +
    'Be thorough but concise. Cite specific files by name.',

  fundraising:
    'You are a fundraising due diligence expert. Review this DataRoom for investor readiness:\n' +
    '1. OVERVIEW of contents\n' +
    '2. REQUIRED DOCS: Check for cap table, pitch deck, financials, term sheet, IP docs, corporate docs\n' +
    '3. FINANCIAL CONSISTENCY: Do the numbers align across documents?\n' +
    '4. RED FLAGS: Missing docs, inconsistencies, governance gaps\n' +
    '5. INVESTOR READINESS SCORE: 1-10 with justification\n' +
    'Cite specific files by name.',

  legal:
    'You are a legal review expert. Analyze this DataRoom for legal completeness:\n' +
    '1. OVERVIEW of contents\n' +
    '2. CONTRACT STATUS: Active, expired, missing signatures?\n' +
    '3. COMPLIANCE CHECK: Are required regulatory docs present?\n' +
    '4. RISK AREAS: NDAs, IP protection, governance gaps\n' +
    '5. LEGAL READINESS SCORE: 1-10 with justification\n' +
    'Cite specific files by name.',

  financial:
    'You are a financial analyst. Review this DataRoom for financial completeness:\n' +
    '1. OVERVIEW of contents\n' +
    '2. REVENUE & EXPENSES: Consistency across documents\n' +
    '3. PROJECTIONS: Are they realistic based on historical data?\n' +
    '4. GAPS: Missing statements, periods, or metrics\n' +
    '5. FINANCIAL HEALTH SCORE: 1-10 with justification\n' +
    'Cite specific files by name.',

  compliance:
    'You are a compliance officer. Review this DataRoom:\n' +
    '1. OVERVIEW of contents\n' +
    '2. REGULATORY FILINGS: Present vs. required\n' +
    '3. CERTIFICATIONS: Current, expired, missing\n' +
    '4. DATA PRIVACY: GDPR, CCPA, HIPAA compliance indicators\n' +
    '5. COMPLIANCE READINESS SCORE: 1-10\n' +
    'Cite specific files by name.',

  hr:
    'You are an HR compliance expert. Review this DataRoom:\n' +
    '1. OVERVIEW of contents\n' +
    '2. EMPLOYEE DOCS: Agreements, offer letters, policies\n' +
    '3. ORGANIZATION: Org chart, role definitions\n' +
    '4. GAPS: Missing onboarding docs, expired agreements\n' +
    '5. HR READINESS SCORE: 1-10\n' +
    'Cite specific files by name.',

  technical:
    'You are a technical architect. Review this DataRoom:\n' +
    '1. OVERVIEW of contents\n' +
    '2. ARCHITECTURE DOCS: Design docs, API specs, diagrams\n' +
    '3. SECURITY: Audit reports, vulnerability assessments\n' +
    '4. TEST COVERAGE: Testing docs and reports\n' +
    '5. TECHNICAL MATURITY SCORE: 1-10\n' +
    'Cite specific files by name.',

  academic:
    'You are an academic reviewer. Analyze this DataRoom:\n' +
    '1. OVERVIEW of contents\n' +
    '2. RESEARCH QUALITY: Methodology, citations, data sets\n' +
    '3. COMPLETENESS: Required sections, appendices, supplementary materials\n' +
    '4. CONSISTENCY: Cross-references, citation accuracy\n' +
    '5. ACADEMIC RIGOR SCORE: 1-10\n' +
    'Cite specific files by name.',

  real_estate:
    'You are a real estate due diligence expert. Review this DataRoom:\n' +
    '1. OVERVIEW of contents\n' +
    '2. PROPERTY DOCS: Deeds, titles, surveys, permits\n' +
    '3. FINANCIAL: Appraisals, rent rolls, operating statements\n' +
    '4. COMPLIANCE: Inspections, environmental reports, zoning\n' +
    '5. DEAL READINESS SCORE: 1-10\n' +
    'Cite specific files by name.',

  medical:
    'You are a medical records reviewer. Analyze this DataRoom:\n' +
    '1. OVERVIEW of contents\n' +
    '2. RECORDS: Patient records, lab results, prescriptions\n' +
    '3. COMPLETENESS: Missing tests, referrals, follow-ups\n' +
    '4. COMPLIANCE: HIPAA indicators, consent forms\n' +
    '5. DOCUMENTATION QUALITY SCORE: 1-10\n' +
    'Cite specific files by name.',
};

/**
 * Run a DataRoom audit via Gemini.
 *
 * @param {object} auditData  - Prepared audit data from Python
 * @param {string} auditType  - Audit type (general, fundraising, legal, etc.)
 * @param {string} [customPrompt] - Custom audit prompt (when auditType='custom')
 * @returns {Promise<string>} Audit result text
 */
async function audit(auditData, auditType, customPrompt) {
  const systemPrompt = auditType === 'custom' && customPrompt
    ? customPrompt
    : (AUDIT_PROMPTS[auditType] || AUDIT_PROMPTS.general);

  const filesDesc = auditData.files.map(f => {
    let desc = `- ${f.name} (${f.type}, ${f.folder})`;
    if (f.summary) desc += `\n  Summary: ${f.summary}`;
    else if (f.preview) desc += `\n  Preview: ${f.preview}`;
    return desc;
  }).join('\n');

  const foldersDesc = auditData.folders.map(f =>
    `- ${f.name}: ${f.context || 'No description'}`
  ).join('\n');

  const userPrompt =
    `## DataRoom: ${auditData.dataroom_name}\n` +
    `Description: ${auditData.dataroom_description || 'None'}\n\n` +
    `## Folders (${auditData.folder_count})\n${foldersDesc}\n\n` +
    `## Files (${auditData.file_count})\n${filesDesc}\n\n` +
    'Perform a complete audit based on the documents listed above.';

  const genAI = _getClient();
  const chatModel = process.env.GEMINI_CHAT_MODEL || MODEL_NAME;
  const model = genAI.getGenerativeModel({
    model: chatModel,
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
  });

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(userPrompt);
      return result.response.text().trim();
    } catch (e) {
      lastError = e;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
  throw new Error(`Audit failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

// ── Role simulation (Phase C2 — Copilot) ─────────────────

const SIMULATION_PROMPTS = {
  critical_reviewer:
    'You are a Critical Reviewer. Your job is to find weaknesses, gaps, inconsistencies, ' +
    'and problems in these documents. Be thorough and adversarial. Point out everything ' +
    'that could be improved, is missing, or doesn\'t add up. Cite specific files.',

  compliance_officer:
    'You are a Compliance Officer reviewing these documents for regulatory issues, ' +
    'missing compliance requirements, data privacy concerns, and governance gaps. ' +
    'Be specific about what regulations might apply and what\'s missing.',

  new_employee:
    'You are a new employee who just joined the organization. Review these documents ' +
    'and explain what this DataRoom contains as if you\'re trying to understand the ' +
    'organization and its operations. Ask questions about things that are unclear.',

  external_auditor:
    'You are an External Auditor reviewing these documents for completeness, accuracy, ' +
    'and proper documentation practices. Provide a professional audit opinion with ' +
    'specific findings and recommendations.',

  vc_partner:
    'You are a Venture Capital Partner evaluating this company for investment. Review ' +
    'the documents looking for: market opportunity, team quality, financial metrics, ' +
    'traction, competitive moat, and red flags. Would you invest? Why or why not?',

  legal_counsel:
    'You are Legal Counsel reviewing these documents. Focus on: contract risks, IP protection, ' +
    'liability exposure, compliance gaps, and governance issues. Provide specific legal ' +
    'observations and recommendations.',

  board_member:
    'You are a Board Member reviewing these documents for governance, strategic direction, ' +
    'financial health, and risk management. Provide your assessment from a board oversight ' +
    'perspective.',

  tax_auditor:
    'You are a Tax Auditor reviewing these documents. Focus on: financial accuracy, ' +
    'tax compliance, deduction validity, reporting completeness, and potential audit risks.',

  hr_director:
    'You are an HR Director reviewing these documents. Focus on: employee documentation, ' +
    'policy compliance, organizational structure, compensation practices, and HR risks.',

  technical_lead:
    'You are a Technical Lead reviewing these documents. Focus on: architecture quality, ' +
    'code standards, security practices, testing coverage, and technical debt.',
};

/**
 * Run a role simulation via Gemini.
 *
 * @param {object} simulationData  - Same data structure as audit
 * @param {string} simulationType  - Role type
 * @param {string} [customRole]    - Custom role description
 * @returns {Promise<string>} Simulation result text
 */
async function simulate(simulationData, simulationType, customRole) {
  const systemPrompt = simulationType === 'custom' && customRole
    ? `You are acting as: ${customRole}. Review the following documents from that perspective. ` +
    'Be thorough, specific, and cite file names. Provide actionable observations.'
    : (SIMULATION_PROMPTS[simulationType] || SIMULATION_PROMPTS.critical_reviewer);

  const filesDesc = simulationData.files.map(f => {
    let desc = `- ${f.name} (${f.type}, ${f.folder})`;
    if (f.summary) desc += `\n  Summary: ${f.summary}`;
    else if (f.preview) desc += `\n  Preview: ${f.preview}`;
    return desc;
  }).join('\n');

  const foldersDesc = simulationData.folders.map(f =>
    `- ${f.name}: ${f.context || 'No description'}`
  ).join('\n');

  const userPrompt =
    `## DataRoom: ${simulationData.dataroom_name}\n` +
    `Description: ${simulationData.dataroom_description || 'None'}\n\n` +
    `## Folders (${simulationData.folder_count})\n${foldersDesc}\n\n` +
    `## Files (${simulationData.file_count})\n${filesDesc}\n\n` +
    'Review these documents from your role perspective. Provide detailed observations.';

  const genAI = _getClient();
  const chatModel = process.env.GEMINI_CHAT_MODEL || MODEL_NAME;
  const model = genAI.getGenerativeModel({
    model: chatModel,
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
  });

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(userPrompt);
      return result.response.text().trim();
    } catch (e) {
      lastError = e;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
  throw new Error(`Simulation failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

// ── DataRoom insights (Phase C2 — Copilot) ───────────────

const INSIGHTS_SYSTEM_PROMPT =
  'You are a DataRoom analysis assistant. Given information about a DataRoom\'s contents, ' +
  'generate insights. Return JSON only, no markdown:\n' +
  '{\n' +
  '  "summary": "2-3 sentence summary of the DataRoom",\n' +
  '  "suggestions": ["question 1", "question 2", "question 3", "question 4"],\n' +
  '  "missing_docs": "What important documents might be missing based on what\'s present"\n' +
  '}\n' +
  'Be specific to the ACTUAL content. Do NOT assume any industry or domain.';

/**
 * Generate DataRoom insights via Gemini.
 *
 * @param {object} insightsData - Prepared insights data from Python
 * @returns {Promise<object>} { summary, suggestions, missing_docs }
 */
async function generateInsights(insightsData) {
  const filesDesc = insightsData.files.map(f =>
    `${f.name} (${f.type}, folder: ${f.folder})`
  ).join(', ');

  const foldersDesc = insightsData.folders.map(f =>
    `${f.name}: ${f.context || 'No description'}`
  ).join('; ');

  const userPrompt =
    `DataRoom: ${insightsData.dataroom_name}\n` +
    `Description: ${insightsData.dataroom_description || 'None'}\n` +
    `File types: ${insightsData.file_type_breakdown}\n` +
    `Files (${insightsData.file_count}): ${filesDesc}\n` +
    `Folders (${insightsData.folder_count}): ${foldersDesc}\n` +
    `Entities found: ${JSON.stringify(insightsData.entities || {})}\n\n` +
    'Generate insights for this DataRoom.';

  const raw = await _callGemini(INSIGHTS_SYSTEM_PROMPT, userPrompt);
  return JSON.parse(raw);
}

// ── Suggested questions (Phase C2 — Copilot) ─────────────

const SUGGESTIONS_SYSTEM_PROMPT =
  'Given information about a DataRoom\'s contents, generate 4 useful questions ' +
  'a user might ask about these documents. Questions should be specific to the ' +
  'ACTUAL content, not generic. Do NOT assume any specific industry or domain. ' +
  'Return a JSON array of exactly 4 strings.';

/**
 * Generate context-aware suggested questions.
 *
 * @param {string[]} fileNames   - File names in the DataRoom
 * @param {string[]} folderNames - Folder names in the DataRoom
 * @returns {Promise<string[]>} Array of 4 suggested questions
 */
async function generateSuggestions(fileNames, folderNames) {
  const userPrompt =
    `Folders: ${folderNames.join(', ') || 'None'}\n` +
    `Files: ${fileNames.join(', ') || 'None'}\n\n` +
    'Generate 4 useful questions a user might ask about these documents. ' +
    'Return a JSON array of 4 strings.';

  const raw = await _callGemini(SUGGESTIONS_SYSTEM_PROMPT, userPrompt);
  return JSON.parse(raw);
}

module.exports = {
  classifyFiles,
  generateDataroom,
  embedTexts,
  extractEntities,
  summarizeFile,
  generateTitle,
  chatStream,
  chatNonStreaming,
  audit,
  simulate,
  generateInsights,
  generateSuggestions,
  CHAT_SYSTEM_PROMPT,
};
