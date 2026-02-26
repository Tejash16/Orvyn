import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';
import authReducer from './authSlice';

const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
  },
});

export default store;
