import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';
import authReducer from './authSlice';
import dataroomReducer from './dataroomSlice';
import fileExplorerReducer from './fileExplorerSlice';
import fileReducer from './fileSlice';
import folderReducer from './folderSlice';
import copilotReducer from './copilotSlice';
import organizationReducer from './organizationSlice';
import billingReducer from './billingSlice';
import sharingReducer from './sharingSlice';
import collaborationReducer from './collaborationSlice';
import notificationReducer from './notificationSlice';
import { offlineGuardMiddleware } from './offlineGuardMiddleware';

const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    dataroom: dataroomReducer,
    fileExplorer: fileExplorerReducer,
    file: fileReducer,
    folder: folderReducer,
    copilot: copilotReducer,
    organization: organizationReducer,
    billing: billingReducer,
    sharing: sharingReducer,
    collaboration: collaborationReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(offlineGuardMiddleware),
});

export default store;

