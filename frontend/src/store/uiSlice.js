import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarCollapsed: true,
    theme: 'light',
    activePage: 'dataroom',
    showUploadModal: false,
    // Reflects the background token-refresh scheduler's view of connectivity.
    // true  = access tokens can be silently renewed (online)
    // false = Express unreachable; app operates in local read-only mode
    isOnline: true,
  },
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    setTheme(state, action) {
      state.theme = action.payload;
    },
    setActivePage(state, action) {
      state.activePage = action.payload;
    },
    setOnline(state, action) {
      state.isOnline = action.payload;
    },
    openUploadModal(state) {
      state.showUploadModal = true;
    },
    closeUploadModal(state) {
      state.showUploadModal = false;
    },
  },
});

export const {
  toggleSidebar,
  toggleTheme,
  setTheme,
  setActivePage,
  setOnline,
  openUploadModal,
  closeUploadModal,
} = uiSlice.actions;

export default uiSlice.reducer;
