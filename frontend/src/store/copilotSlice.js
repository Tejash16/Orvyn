import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// ── Thunks ───────────────────────────────────────────────────

export const sendMessage = createAsyncThunk(
  'copilot/sendMessage',
  async ({ message, sessionId }, { getState, rejectWithValue }) => {
    const { copilot } = getState();
    const result = await window.api.copilot.sendMessage({
      message,
      session_id: sessionId || copilot.activeSessionId,
      scope_type: copilot.scopeType,
      scope_ids: copilot.scopeIds,
      scope_name: copilot.scopeName,
    });
    if (!result.success) return rejectWithValue(result.error);
    return result;
  }
);

export const fetchSessions = createAsyncThunk(
  'copilot/fetchSessions',
  async ({ scopeType, scopeId } = {}, { rejectWithValue }) => {
    const result = await window.api.copilot.getSessions({ scope_type: scopeType, scope_id: scopeId });
    if (!result.success) return rejectWithValue(result.error);
    return result.sessions;
  }
);

export const loadSession = createAsyncThunk(
  'copilot/loadSession',
  async (sessionId, { rejectWithValue }) => {
    const result = await window.api.copilot.getMessages({ session_id: sessionId });
    if (!result.success) return rejectWithValue(result.error);
    return { sessionId, messages: result.messages };
  }
);

export const deleteSession = createAsyncThunk(
  'copilot/deleteSession',
  async (sessionId, { dispatch, rejectWithValue }) => {
    const result = await window.api.copilot.deleteSession({ session_id: sessionId });
    if (!result.success) return rejectWithValue(result.error);
    dispatch(fetchSessions());
    return sessionId;
  }
);

export const auditDataroom = createAsyncThunk(
  'copilot/auditDataroom',
  async ({ dataroomId, auditType }, { rejectWithValue }) => {
    const result = await window.api.copilot.auditDataroom({
      dataroom_id: dataroomId,
      audit_type: auditType,
    });
    if (!result.success) return rejectWithValue(result.error);
    return result;
  }
);

export const simulateReview = createAsyncThunk(
  'copilot/simulateReview',
  async ({ dataroomId, simulationType, customRole }, { rejectWithValue }) => {
    const result = await window.api.copilot.simulateReview({
      dataroom_id: dataroomId,
      simulation_type: simulationType,
      custom_role: customRole,
    });
    if (!result.success) return rejectWithValue(result.error);
    return result;
  }
);

export const fetchSuggestions = createAsyncThunk(
  'copilot/fetchSuggestions',
  async (dataroomId, { rejectWithValue }) => {
    const result = await window.api.copilot.getSuggestions({ dataroom_id: dataroomId });
    if (!result.success) return rejectWithValue(result.error);
    return result.suggestions;
  }
);

export const fetchInsights = createAsyncThunk(
  'copilot/fetchInsights',
  async (dataroomId, { rejectWithValue }) => {
    const result = await window.api.copilot.getInsights({ dataroom_id: dataroomId });
    if (!result.success) return rejectWithValue(result.error);
    return result.insights;
  }
);

export const generateInsights = createAsyncThunk(
  'copilot/generateInsights',
  async (dataroomId, { rejectWithValue }) => {
    const result = await window.api.copilot.generateInsights({ dataroom_id: dataroomId });
    if (!result.success) return rejectWithValue(result.error);
    return result.insights;
  }
);

export const indexFiles = createAsyncThunk(
  'copilot/indexFiles',
  async ({ fileIds, dataroomId }, { rejectWithValue }) => {
    const result = await window.api.copilot.indexFiles({
      file_ids: fileIds,
      dataroom_id: dataroomId,
    });
    if (!result.success) return rejectWithValue(result.error);
    return result;
  }
);

export const getIndexStatus = createAsyncThunk(
  'copilot/getIndexStatus',
  async (dataroomId, { rejectWithValue }) => {
    const result = await window.api.copilot.getIndexStatus({ dataroom_id: dataroomId });
    if (!result.success) return rejectWithValue(result.error);
    return result;
  }
);

export const retryIndexing = createAsyncThunk(
  'copilot/retryIndexing',
  async (dataroomId, { rejectWithValue }) => {
    const result = await window.api.copilot.retryIndexing({ dataroom_id: dataroomId });
    if (!result.success) return rejectWithValue(result.error);
    return result;
  }
);

// ── Slice ────────────────────────────────────────────────────

const copilotSlice = createSlice({
  name: 'copilot',
  initialState: {
    isOpen: false,
    panelWidth: 380,
    sessions: [],
    activeSessionId: null,
    messages: [],
    scopeType: 'dataroom',
    scopeIds: [],
    scopeName: '',
    selectedFileIds: [],
    isLoading: false,
    isStreaming: false,
    streamingMessage: '',
    isAuditing: false,
    isSimulating: false,
    isIndexing: false,
    indexStatus: null,
    indexProgress: null,
    suggestions: [],
    insights: null,
    auditResult: null,
    simulationResult: null,
    error: null,
  },
  reducers: {
    toggleCopilot(state) {
      state.isOpen = !state.isOpen;
    },
    openCopilot(state) {
      state.isOpen = true;
    },
    closeCopilot(state) {
      state.isOpen = false;
    },
    clearMessages(state) {
      state.messages = [];
      state.activeSessionId = null;
      state.streamingMessage = '';
      state.isStreaming = false;
    },
    clearAudit(state) {
      state.auditResult = null;
    },
    clearSimulation(state) {
      state.simulationResult = null;
    },
    clearError(state) {
      state.error = null;
    },
    setCopilotScope(state, action) {
      const { scopeType, scopeIds, scopeName } = action.payload;
      state.scopeType = scopeType;
      state.scopeIds = scopeIds;
      state.scopeName = scopeName;
    },
    setSelectedFiles(state, action) {
      state.selectedFileIds = action.payload;
    },
    startStreaming(state) {
      state.isStreaming = true;
      state.streamingMessage = '';
      state.error = null;
    },
    appendStreamChunk(state, action) {
      state.streamingMessage += action.payload;
    },
    finalizeStreamMessage(state, action) {
      const { sources, session_id, session_title } = action.payload;
      // Push the accumulated streaming message as a real assistant message
      state.messages.push({
        role: 'assistant',
        content: state.streamingMessage,
        sources: sources || [],
      });
      state.isStreaming = false;
      state.streamingMessage = '';
      if (session_id) state.activeSessionId = session_id;
      if (session_title) {
        // Update session title in the sessions list if present
        const session = state.sessions.find(s => s.id === session_id);
        if (session) session.title = session_title;
      }
    },
    updateIndexProgress(state, action) {
      state.indexProgress = action.payload;
    },
    startNewSession(state, action) {
      const { scopeType, scopeIds, scopeName } = action.payload;
      state.messages = [];
      state.activeSessionId = null;
      state.streamingMessage = '';
      state.isStreaming = false;
      state.scopeType = scopeType;
      state.scopeIds = scopeIds;
      state.scopeName = scopeName;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // sendMessage
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        // Add user message to messages array immediately
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload && action.payload.session_id) {
          state.activeSessionId = action.payload.session_id;
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.isStreaming = false;
        state.error = action.payload;
      });

    // fetchSessions
    builder
      .addCase(fetchSessions.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sessions = action.payload || [];
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // loadSession
    builder
      .addCase(loadSession.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadSession.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeSessionId = action.payload.sessionId;
        state.messages = action.payload.messages || [];
      })
      .addCase(loadSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // deleteSession
    builder
      .addCase(deleteSession.fulfilled, (state, action) => {
        state.sessions = state.sessions.filter(s => s.id !== action.payload);
        if (state.activeSessionId === action.payload) {
          state.activeSessionId = null;
          state.messages = [];
        }
      })
      .addCase(deleteSession.rejected, (state, action) => {
        state.error = action.payload;
      });

    // auditDataroom
    builder
      .addCase(auditDataroom.pending, (state) => {
        state.isAuditing = true;
        state.auditResult = null;
        state.error = null;
      })
      .addCase(auditDataroom.fulfilled, (state, action) => {
        state.isAuditing = false;
        state.auditResult = action.payload.audit_result;
      })
      .addCase(auditDataroom.rejected, (state, action) => {
        state.isAuditing = false;
        state.error = action.payload;
      });

    // simulateReview
    builder
      .addCase(simulateReview.pending, (state) => {
        state.isSimulating = true;
        state.simulationResult = null;
        state.error = null;
      })
      .addCase(simulateReview.fulfilled, (state, action) => {
        state.isSimulating = false;
        state.simulationResult = action.payload.simulation_result;
      })
      .addCase(simulateReview.rejected, (state, action) => {
        state.isSimulating = false;
        state.error = action.payload;
      });

    // fetchSuggestions
    builder
      .addCase(fetchSuggestions.fulfilled, (state, action) => {
        state.suggestions = action.payload || [];
      })
      .addCase(fetchSuggestions.rejected, (state, action) => {
        state.error = action.payload;
      });

    // fetchInsights
    builder
      .addCase(fetchInsights.fulfilled, (state, action) => {
        state.insights = action.payload;
      })
      .addCase(fetchInsights.rejected, (state, action) => {
        state.error = action.payload;
      });

    // generateInsights
    builder
      .addCase(generateInsights.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(generateInsights.fulfilled, (state, action) => {
        state.isLoading = false;
        state.insights = action.payload;
      })
      .addCase(generateInsights.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // indexFiles
    builder
      .addCase(indexFiles.pending, (state) => {
        state.isIndexing = true;
        state.indexProgress = null;
      })
      .addCase(indexFiles.fulfilled, (state) => {
        state.isIndexing = false;
      })
      .addCase(indexFiles.rejected, (state, action) => {
        state.isIndexing = false;
        state.error = action.payload;
      });

    // getIndexStatus
    builder
      .addCase(getIndexStatus.fulfilled, (state, action) => {
        state.indexStatus = action.payload;
      })
      .addCase(getIndexStatus.rejected, (state, action) => {
        state.error = action.payload;
      });

    // retryIndexing
    builder
      .addCase(retryIndexing.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const {
  toggleCopilot,
  openCopilot,
  closeCopilot,
  clearMessages,
  clearAudit,
  clearSimulation,
  clearError,
  setCopilotScope,
  setSelectedFiles,
  startStreaming,
  appendStreamChunk,
  finalizeStreamMessage,
  updateIndexProgress,
  startNewSession,
} = copilotSlice.actions;

export default copilotSlice.reducer;
