import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// ── Thunks ────────────────────────────────────────────────

export const fetchCollaborations = createAsyncThunk(
  'collaboration/fetch',
  async (_, { rejectWithValue }) => {
    const result = await window.api.collaboration.list();
    if (result.error) return rejectWithValue(result.error);
    return {
      accepted: result.accepted || [],
      incoming: result.incoming || [],
      outgoing: result.outgoing || [],
    };
  },
);

export const fetchSuggestions = createAsyncThunk(
  'collaboration/fetchSuggestions',
  async (_, { rejectWithValue }) => {
    const result = await window.api.collaboration.suggestions();
    if (result.error) return rejectWithValue(result.error);
    return result.suggestions || [];
  },
);

export const requestCollaboration = createAsyncThunk(
  'collaboration/request',
  async (email, { rejectWithValue, dispatch }) => {
    const result = await window.api.collaboration.request(email);
    if (result.error) return rejectWithValue(result.error);
    dispatch(fetchCollaborations());
    return result;
  },
);

export const acceptCollaboration = createAsyncThunk(
  'collaboration/accept',
  async (id, { rejectWithValue, dispatch }) => {
    const result = await window.api.collaboration.accept(id);
    if (result.error) return rejectWithValue(result.error);
    dispatch(fetchCollaborations());
    dispatch(fetchSuggestions());
    return id;
  },
);

export const rejectCollaboration = createAsyncThunk(
  'collaboration/reject',
  async (id, { rejectWithValue, dispatch }) => {
    const result = await window.api.collaboration.reject(id);
    if (result.error) return rejectWithValue(result.error);
    dispatch(fetchCollaborations());
    return id;
  },
);

export const removeCollaboration = createAsyncThunk(
  'collaboration/remove',
  async (id, { rejectWithValue, dispatch }) => {
    const result = await window.api.collaboration.remove(id);
    if (result.error) return rejectWithValue(result.error);
    dispatch(fetchCollaborations());
    dispatch(fetchSuggestions());
    return id;
  },
);

// ── Slice ─────────────────────────────────────────────────

const collaborationSlice = createSlice({
  name: 'collaboration',
  initialState: {
    accepted: [],
    incoming: [],
    outgoing: [],
    suggestions: [],
    isLoading: false,
    isRequesting: false,
    error: null,
  },
  reducers: {
    clearCollaborationError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCollaborations.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchCollaborations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.accepted = action.payload.accepted;
        state.incoming = action.payload.incoming;
        state.outgoing = action.payload.outgoing;
      })
      .addCase(fetchCollaborations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchSuggestions.fulfilled, (state, action) => {
        state.suggestions = action.payload;
      })
      .addCase(requestCollaboration.pending, (state) => { state.isRequesting = true; state.error = null; })
      .addCase(requestCollaboration.fulfilled, (state) => { state.isRequesting = false; })
      .addCase(requestCollaboration.rejected, (state, action) => {
        state.isRequesting = false;
        state.error = action.payload;
      });
  },
});

export const { clearCollaborationError } = collaborationSlice.actions;
export default collaborationSlice.reducer;
