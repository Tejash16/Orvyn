import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';
import authReducer from './authSlice';
import dataroomReducer from './dataroomSlice';
import fileExplorerReducer from './fileExplorerSlice';
import fileReducer from './fileSlice';
import folderReducer from './folderSlice';

const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    dataroom: dataroomReducer,
    fileExplorer: fileExplorerReducer,
    file: fileReducer,
    folder: folderReducer,
  },
});

export default store;
