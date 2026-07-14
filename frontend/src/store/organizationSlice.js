import { createSlice } from '@reduxjs/toolkit';

const organizationSlice = createSlice({
  name: 'organization',
  initialState: {
    organization: null,   // Current org object
    members: [],          // Array of member objects (populated with user info)
    invites: [],          // Array of pending invite objects
    isLoading: false,
    error: null,
    // Audit logs
    auditLogs: [],
    auditTotal: 0,
    auditPage: 1,
    auditTotalPages: 0,
    isAuditLoading: false,
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
      state.auditLogs = [];
      state.auditTotal = 0;
      state.auditPage = 1;
      state.auditTotalPages = 0;
      state.isAuditLoading = false;
    },
    // Audit log reducers
    auditStart(state) {
      state.isAuditLoading = true;
    },
    setAuditLogs(state, action) {
      state.auditLogs = action.payload.logs;
      state.auditTotal = action.payload.total;
      state.auditPage = action.payload.page;
      state.auditTotalPages = action.payload.totalPages;
      state.isAuditLoading = false;
    },
    clearAuditLogs(state) {
      state.auditLogs = [];
      state.auditTotal = 0;
      state.auditPage = 1;
      state.auditTotalPages = 0;
      state.isAuditLoading = false;
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
  auditStart,
  setAuditLogs,
  clearAuditLogs,
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

export const fetchAuditLogs = (orgId, filters = {}) => async (dispatch) => {
  dispatch(auditStart());
  try {
    const result = await window.api.organization.getAuditLogs(orgId, filters);
    if (result.success) {
      dispatch(setAuditLogs({
        logs: result.logs,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      }));
    } else {
      dispatch(setAuditLogs({ logs: [], total: 0, page: 1, totalPages: 0 }));
    }
    return result;
  } catch (err) {
    dispatch(setAuditLogs({ logs: [], total: 0, page: 1, totalPages: 0 }));
    return { success: false, error: err.message };
  }
};
