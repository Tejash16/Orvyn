import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// ── Thunks ────────────────────────────────────────────────

// Incremental poll: pass `since` to fetch only items newer than the
// last successful poll. The slice also tracks unreadCount returned by
// the server so the bell badge stays accurate without a second call.
export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async ({ since } = {}, { rejectWithValue }) => {
    const result = await window.api.notifications.list(since ? { since } : {});
    if (result.error) return rejectWithValue(result.error);
    return {
      notifications: result.notifications || [],
      unreadCount: result.unreadCount ?? 0,
    };
  },
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id, { rejectWithValue }) => {
    const result = await window.api.notifications.markRead(id);
    if (result.error) return rejectWithValue(result.error);
    return id;
  },
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    const result = await window.api.notifications.markAllRead();
    if (result.error) return rejectWithValue(result.error);
    return true;
  },
);

// ── Slice ─────────────────────────────────────────────────

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],          // newest first
    unreadCount: 0,
    lastFetchedAt: null, // ISO string, used as `since` cursor for next poll
    isLoading: false,
    error: null,
  },
  reducers: {
    clearNotificationError: (state) => { state.error = null; },
    // Handles pushes from the SSE stream. Mirrors the merge contract of
    // fetchNotifications.fulfilled so a live push + a fallback poll can't
    // double-insert the same document.
    notificationReceived: (state, action) => {
      const n = action.payload;
      if (!n || !n._id) return;
      if (state.items.some((x) => x._id === n._id)) return;
      state.items = [n, ...state.items].slice(0, 100);
      if (!n.read) state.unreadCount += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.error = null; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        const { notifications, unreadCount } = action.payload;
        // Merge: prepend new items that aren't already in state.items.
        const existingIds = new Set(state.items.map((n) => n._id));
        const fresh = notifications.filter((n) => !existingIds.has(n._id));
        state.items = [...fresh, ...state.items].slice(0, 100);
        state.unreadCount = unreadCount;
        state.lastFetchedAt = new Date().toISOString();
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const n = state.items.find((x) => x._id === action.payload);
        if (n && !n.read) {
          n.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items.forEach((n) => { n.read = true; });
        state.unreadCount = 0;
      });
  },
});

export const { clearNotificationError, notificationReceived } = notificationSlice.actions;
export default notificationSlice.reducer;
