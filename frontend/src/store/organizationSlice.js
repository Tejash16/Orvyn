import { createSlice } from '@reduxjs/toolkit';

const organizationSlice = createSlice({
  name: 'organization',
  initialState: {
    organization: null,   // Current org object
    members: [],          // Array of member objects (populated with user info)
    invites: [],          // Array of pending invite objects
    isLoading: false,
    error: null,
  },
  reducers: {
    orgStart(state) {
      state.isLoading = true;
      state.error = null;
    },
    orgFailure(state, action) {
      state.isLoading = false;
      state.error = action.payload;
    },
    setOrganization(state, action) {
      state.organization = action.payload;
      state.isLoading = false;
    },
    setMembers(state, action) {
      state.members = action.payload;
      state.isLoading = false;
    },
    setInvites(state, action) {
      state.invites = action.payload;
      state.isLoading = false;
    },
    clearOrganization(state) {
      state.organization = null;
      state.members = [];
      state.invites = [];
      state.isLoading = false;
      state.error = null;
    },
  },
});

export const {
  orgStart,
  orgFailure,
  setOrganization,
  setMembers,
  setInvites,
  clearOrganization,
} = organizationSlice.actions;

export default organizationSlice.reducer;

// ── Thunks ────────────────────────────────────────────────

export const createOrganization = (name) => async (dispatch) => {
  dispatch(orgStart());
  try {
    const result = await window.api.organization.create(name);
    if (result.success) {
      dispatch(setOrganization(result.organization));
      return result;
    }
    dispatch(orgFailure(result.error));
    return result;
  } catch (err) {
    dispatch(orgFailure(err.message));
    return { success: false, error: err.message };
  }
};

export const fetchOrganization = (orgId) => async (dispatch) => {
  dispatch(orgStart());
  try {
    const result = await window.api.organization.get(orgId);
    if (result.success) {
      dispatch(setOrganization(result.organization));
    } else {
      dispatch(orgFailure(result.error));
    }
  } catch (err) {
    dispatch(orgFailure(err.message));
  }
};

export const fetchMembers = (orgId) => async (dispatch) => {
  dispatch(orgStart());
  try {
    const result = await window.api.organization.getMembers(orgId);
    if (result.success) {
      dispatch(setMembers(result.members));
    } else {
      dispatch(orgFailure(result.error));
    }
  } catch (err) {
    dispatch(orgFailure(err.message));
  }
};

export const fetchInvites = (orgId) => async (dispatch) => {
  dispatch(orgStart());
  try {
    const result = await window.api.organization.listInvites(orgId);
    if (result.success) {
      dispatch(setInvites(result.invites));
    } else {
      dispatch(orgFailure(result.error));
    }
  } catch (err) {
    dispatch(orgFailure(err.message));
  }
};

export const createInviteThunk = (orgId, email, role) => async (dispatch) => {
  try {
    const result = await window.api.organization.createInvite(orgId, email, role);
    if (result.success) {
      // Refresh invites list
      dispatch(fetchInvites(orgId));
    }
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const acceptInviteThunk = (inviteCode) => async (dispatch) => {
  dispatch(orgStart());
  try {
    const result = await window.api.organization.acceptInvite(inviteCode);
    if (result.success) {
      dispatch(setOrganization(result.organization));
      return result;
    }
    dispatch(orgFailure(result.error));
    return result;
  } catch (err) {
    dispatch(orgFailure(err.message));
    return { success: false, error: err.message };
  }
};

export const removeMemberThunk = (orgId, userId) => async (dispatch) => {
  try {
    const result = await window.api.organization.removeMember(orgId, userId);
    if (result.success) {
      dispatch(fetchMembers(orgId));
    }
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateMemberRoleThunk = (orgId, userId, role) => async (dispatch) => {
  try {
    const result = await window.api.organization.updateMemberRole(orgId, userId, role);
    if (result.success) {
      dispatch(fetchMembers(orgId));
    }
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const revokeInviteThunk = (orgId, inviteId) => async (dispatch) => {
  try {
    const result = await window.api.organization.revokeInvite(orgId, inviteId);
    if (result.success) {
      dispatch(fetchInvites(orgId));
    }
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const deleteOrganizationThunk = (orgId) => async (dispatch) => {
  try {
    const result = await window.api.organization.delete(orgId);
    if (result.success) {
      dispatch(clearOrganization());
    }
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
};
