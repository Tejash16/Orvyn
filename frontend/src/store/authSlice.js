import { createSlice } from '@reduxjs/toolkit';
import { setTheme } from './uiSlice';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    isAuthenticated: false,
    /**
     * User object shape (set by loginSuccess):
     *   _id, name, email, provider ('local'|'google'|'local+google'),
     *   isEmailVerified, createdAt,
     *   googleId?, profilePicture?, userType ('individual'|'enterprise'),
     *   activeOrganizationId?
     */
    user: null,
    loading: false,
    error: null,
    // True on every launch until the session restore attempt completes.
    // App.jsx renders a blank shell while this is true.
    isRestoring: true,

    // ── Subscription / plan state (Phase 2) ────────────────
    plan: 'free',      // 'free' | 'pro' | 'enterprise'
    limits: null,      // { dataroomLimit, monthlyFileLimit, dailyMessageLimit }
    usage: null,       // { filesUploadedThisPeriod, messagesToday }
  },
  reducers: {
    loginStart(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action) {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.loading = false;
      state.error = null;
    },
    loginFailure(state, action) {
      state.isAuthenticated = false;
      state.user = null;
      state.loading = false;
      state.error = action.payload;
    },
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
      state.loading = false;
      state.error = null;
      state.plan = null;
      state.limits = null;
      state.usage = null;
    },
    // Dispatched after the restore attempt finishes (success or failure).
    // Transitions the app from the loading shell to the real UI.
    restoreComplete(state) {
      state.isRestoring = false;
    },

    // ── Subscription state updates ──────────────────────────
    setLimits(state, action) {
      const { plan, limits, usage } = action.payload;
      state.plan = plan ?? state.plan;
      state.limits = limits ?? state.limits;
      state.usage = usage ?? state.usage;
    },
  },
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  restoreComplete,
  setLimits,
} = authSlice.actions;
export default authSlice.reducer;

/**
 * Thunk: performs the full login flow and hydrates theme on success.
 *
 * Electron returns { success, user, theme } from the login IPC handler.
 * Theme is sourced from SQLite via Python — no localStorage involved.
 *
 * @param {{ email: string, password: string }} credentials
 */
export const loginThunk = (credentials) => async (dispatch) => {
  dispatch(loginStart());
  try {
    const result = await window.api.auth.login(credentials);
    if (result.success) {
      dispatch(loginSuccess(result.user));
      dispatch(setTheme(result.theme ?? 'light'));
    } else {
      dispatch(loginFailure(result.error));
    }
  } catch (err) {
    dispatch(loginFailure(err.message));
  }
};

/**
 * Thunk: fetches plan, limits, and usage from Express via Electron IPC.
 * Populates the subscription state in Redux.
 */
export const fetchLimits = () => async (dispatch) => {
  try {
    const result = await window.api.usage.getLimits();
    if (result.success) {
      dispatch(setLimits({
        plan: result.plan,
        limits: result.limits,
        usage: result.usage,
      }));
    }
  } catch {
    // Non-fatal — limits can be fetched later
  }
};

