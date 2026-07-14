import { createSlice } from '@reduxjs/toolkit';

const billingSlice = createSlice({
  name: 'billing',
  initialState: {
    plan: 'free',          // 'free' | 'pro' | 'enterprise'
    status: 'active',      // 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired'
    currentPeriodEnd: null,
    organizationId: null,  // set when on an enterprise org plan
    isLoading: false,
    error: null,
  },
  reducers: {
    setBillingLoading(state) {
      state.isLoading = true;
      state.error = null;
    },
    setBillingStatus(state, action) {
      const { plan, status, currentPeriodEnd, organizationId } = action.payload;
      state.plan = plan ?? state.plan;
      state.status = status ?? state.status;
      state.currentPeriodEnd = currentPeriodEnd ?? state.currentPeriodEnd;
      state.organizationId = organizationId ?? state.organizationId;
      state.isLoading = false;
      state.error = null;
    },
    setBillingError(state, action) {
      state.isLoading = false;
      state.error = action.payload;
    },
    clearBillingError(state) {
      state.error = null;
    },
    resetBilling(state) {
      state.plan = 'free';
      state.status = 'active';
      state.currentPeriodEnd = null;
      state.organizationId = null;
      state.isLoading = false;
      state.error = null;
    },
  },
});

export const {
  setBillingLoading,
  setBillingStatus,
  setBillingError,
  clearBillingError,
  resetBilling,
} = billingSlice.actions;

export default billingSlice.reducer;

// ── Thunks ────────────────────────────────────────────────

/**
 * Fetch current subscription status from Express via Electron IPC.
 */
export const fetchBillingStatus = () => async (dispatch) => {
  dispatch(setBillingLoading());
  try {
    const result = await window.api.billing.getStatus();
    dispatch(setBillingStatus({
      plan: result.plan || 'free',
      status: result.status || 'active',
      currentPeriodEnd: result.currentPeriodEnd || null,
      organizationId: result.organizationId || null,
    }));
  } catch {
    dispatch(setBillingError('Failed to fetch billing status'));
  }
};

/**
 * Upgrade to a paid plan. Opens Razorpay checkout in the system browser.
 * @param {{ plan: 'pro' | 'enterprise', organizationId?: string, seats?: number }} payload
 */
export const upgradePlan = (payload) => async (dispatch) => {
  dispatch(setBillingLoading());
  try {
    const result = await window.api.billing.upgrade(payload);
    if (result.success) {
      // Checkout opened in browser — status will update via polling
      dispatch(setBillingStatus({ status: 'trialing' }));
    } else {
      dispatch(setBillingError(result.error || 'Failed to start upgrade'));
    }
  } catch (err) {
    dispatch(setBillingError(err.message || 'Failed to start upgrade'));
  }
};

/**
 * Cancel the user's active subscription.
 */
export const cancelSubscription = () => async (dispatch) => {
  dispatch(setBillingLoading());
  try {
    const result = await window.api.billing.cancel();
    if (result.success || result.message) {
      dispatch(setBillingStatus({ status: 'cancelled' }));
    } else {
      dispatch(setBillingError(result.error || 'Failed to cancel subscription'));
    }
  } catch (err) {
    dispatch(setBillingError(err.message || 'Failed to cancel subscription'));
  }
};
