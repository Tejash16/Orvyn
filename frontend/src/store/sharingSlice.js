import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// ── Thunks ────────────────────────────────────────────────

export const fetchReceived = createAsyncThunk(
  'sharing/fetchReceived',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.api.sharing.getReceived();
      if (result.error) return rejectWithValue(result.error);
      return result.received || [];
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchMyShares = createAsyncThunk(
  'sharing/fetchMyShares',
  async (_, { rejectWithValue }) => {
    try {
      const result = await window.api.sharing.getMyShares();
      if (result.error) return rejectWithValue(result.error);
      return result.shares || [];
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const shareDataroom = createAsyncThunk(
  'sharing/shareDataroom',
  async ({ dataroomId, recipientEmail }, { rejectWithValue }) => {
    try {
      const result = await window.api.sharing.shareDataroom({ dataroomId, recipientEmail });
      if (result.error) return rejectWithValue(result.error);
      return result;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const importDataroom = createAsyncThunk(
  'sharing/importDataroom',
  async (shareId, { rejectWithValue }) => {
    try {
      const result = await window.api.sharing.importDataroom(shareId);
      if (result.error) return rejectWithValue(result.error);
      return result;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const searchUsers = createAsyncThunk(
  'sharing/searchUsers',
  async (query, { rejectWithValue }) => {
    try {
      const result = await window.api.sharing.searchUsers(query);
      return result.users || [];
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateShare = createAsyncThunk(
  'sharing/updateShare',
  async ({ shareId, dataroomId }, { rejectWithValue }) => {
    try {
      const result = await window.api.sharing.updateShare({ shareId, dataroomId });
      if (result.error) return rejectWithValue(result.error);
      return result;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteShare = createAsyncThunk(
  'sharing/deleteShare',
  async (shareId, { rejectWithValue }) => {
    try {
      const result = await window.api.sharing.deleteShare(shareId);
      if (result.error) return rejectWithValue(result.error);
      return shareId;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const grantAccess = createAsyncThunk(
  'sharing/grantAccess',
  async ({ shareId, email, permission }, { rejectWithValue }) => {
    try {
      const result = await window.api.sharing.grantAccess({ shareId, email, permission });
      if (result.error) return rejectWithValue(result.error);
      return result;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const revokeAccess = createAsyncThunk(
  'sharing/revokeAccess',
  async ({ shareId, userId }, { rejectWithValue }) => {
    try {
      const result = await window.api.sharing.revokeAccess({ shareId, userId });
      if (result.error) return rejectWithValue(result.error);
      return { shareId, userId };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const listAccess = createAsyncThunk(
  'sharing/listAccess',
  async (shareId, { rejectWithValue }) => {
    try {
      const result = await window.api.sharing.listAccess(shareId);
      if (result.error) return rejectWithValue(result.error);
      return result.accesses || [];
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ── Slice ─────────────────────────────────────────────────

const sharingSlice = createSlice({
  name: 'sharing',
  initialState: {
    received: [],        // DataRooms shared with me
    myShares: [],        // DataRooms I shared
    searchResults: [],   // User search results
    accessList: [],      // Access records for a specific share
    isLoading: false,
    isSharing: false,
    isImporting: false,
    error: null,
  },
  reducers: {
    clearSharingError: (state) => { state.error = null; },
    clearSearchResults: (state) => { state.searchResults = []; },
    clearAccessList: (state) => { state.accessList = []; },
  },
  extraReducers: (builder) => {
    builder
      // fetchReceived
      .addCase(fetchReceived.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchReceived.fulfilled, (state, action) => { state.isLoading = false; state.received = action.payload; })
      .addCase(fetchReceived.rejected, (state, action) => { state.isLoading = false; state.error = action.payload; })

      // fetchMyShares
      .addCase(fetchMyShares.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchMyShares.fulfilled, (state, action) => { state.isLoading = false; state.myShares = action.payload; })
      .addCase(fetchMyShares.rejected, (state, action) => { state.isLoading = false; state.error = action.payload; })

      // shareDataroom
      .addCase(shareDataroom.pending, (state) => { state.isSharing = true; state.error = null; })
      .addCase(shareDataroom.fulfilled, (state) => { state.isSharing = false; })
      .addCase(shareDataroom.rejected, (state, action) => { state.isSharing = false; state.error = action.payload; })

      // importDataroom
      .addCase(importDataroom.pending, (state) => { state.isImporting = true; state.error = null; })
      .addCase(importDataroom.fulfilled, (state) => { state.isImporting = false; })
      .addCase(importDataroom.rejected, (state, action) => { state.isImporting = false; state.error = action.payload; })

      // searchUsers
      .addCase(searchUsers.fulfilled, (state, action) => { state.searchResults = action.payload; })

      // updateShare
      .addCase(updateShare.pending, (state) => { state.isSharing = true; })
      .addCase(updateShare.fulfilled, (state) => { state.isSharing = false; })
      .addCase(updateShare.rejected, (state, action) => { state.isSharing = false; state.error = action.payload; })

      // deleteShare
      .addCase(deleteShare.fulfilled, (state, action) => {
        state.myShares = state.myShares.filter(s => s._id !== action.payload);
      })

      // listAccess
      .addCase(listAccess.fulfilled, (state, action) => { state.accessList = action.payload; });
  },
});

export const { clearSharingError, clearSearchResults, clearAccessList } = sharingSlice.actions;
export default sharingSlice.reducer;
