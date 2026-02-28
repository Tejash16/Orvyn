import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { refreshCurrentView } from './fileExplorerSlice';

// ── Thunks ───────────────────────────────────────────────────

export const createFolder = createAsyncThunk(
  'folder/createFolder',
  async ({ dataroomId, parentFolderId, name, context }, { dispatch, rejectWithValue }) => {
    const result = await window.api.folder.create(dataroomId, parentFolderId, name, context);
    if (!result.success) return rejectWithValue(result.error);
    dispatch(refreshCurrentView());
    return result.folder;
  }
);

export const renameFolder = createAsyncThunk(
  'folder/renameFolder',
  async ({ folderId, newName }, { dispatch, rejectWithValue }) => {
    const result = await window.api.folder.rename(folderId, newName);
    if (!result.success) return rejectWithValue(result.error);
    dispatch(refreshCurrentView());
    return result.folder;
  }
);

export const deleteFolder = createAsyncThunk(
  'folder/deleteFolder',
  async (folderId, { dispatch, rejectWithValue }) => {
    const result = await window.api.folder.delete(folderId);
    if (!result.success) return rejectWithValue(result.error);
    dispatch(refreshCurrentView());
    return result;
  }
);

export const moveFolder = createAsyncThunk(
  'folder/moveFolder',
  async ({ folderId, newParentId }, { dispatch, rejectWithValue }) => {
    const result = await window.api.folder.move(folderId, newParentId);
    if (!result.success) return rejectWithValue(result.error);
    dispatch(refreshCurrentView());
    return result.folder;
  }
);

export const updateFolderContext = createAsyncThunk(
  'folder/updateFolderContext',
  async ({ folderId, context }, { dispatch, rejectWithValue }) => {
    const result = await window.api.folder.updateContext(folderId, context);
    if (!result.success) return rejectWithValue(result.error);
    dispatch(refreshCurrentView());
    return result.folder;
  }
);

// ── Slice ────────────────────────────────────────────────────

const folderSlice = createSlice({
  name: 'folder',
  initialState: {
    isCreating: false,
    error: null,
  },
  reducers: {
    clearFolderError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // createFolder
    builder
      .addCase(createFolder.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createFolder.fulfilled, (state) => {
        state.isCreating = false;
      })
      .addCase(createFolder.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload;
      });

    // All mutation thunks — track errors
    const mutationThunks = [renameFolder, deleteFolder, moveFolder, updateFolderContext];
    for (const thunk of mutationThunks) {
      builder.addCase(thunk.rejected, (state, action) => {
        state.error = action.payload;
      });
    }
  },
});

export const { clearFolderError } = folderSlice.actions;
export default folderSlice.reducer;
