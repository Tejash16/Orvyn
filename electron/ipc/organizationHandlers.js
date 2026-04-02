'use strict';

const expressService = require('../services/expressService');
const log = require('../services/logger');

/**
 * Register all organization-related IPC handlers.
 *
 * Follows the same pattern as authHandlers.js:
 *   - Each handler wraps expressService calls in try-catch
 *   - Returns { success: true, ... } or { success: false, error }
 */
function registerOrganizationHandlers(ipcMain, getMainWindow) {

  // ── Organization CRUD ──────────────────────────────────

  ipcMain.handle('org:create', async (_event, { name }) => {
    try {
      const data = await expressService.createOrganization(name);
      return { success: true, organization: data.organization };
    } catch (err) {
      log.error('org:create failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:get', async (_event, { orgId }) => {
    try {
      const data = await expressService.getOrganization(orgId);
      return { success: true, organization: data.organization };
    } catch (err) {
      log.error('org:get failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:update', async (_event, { orgId, updates }) => {
    try {
      const data = await expressService.updateOrganization(orgId, updates);
      return { success: true, organization: data.organization };
    } catch (err) {
      log.error('org:update failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:delete', async (_event, { orgId }) => {
    try {
      await expressService.deleteOrganization(orgId);
      return { success: true };
    } catch (err) {
      log.error('org:delete failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Members ────────────────────────────────────────────

  ipcMain.handle('org:getMembers', async (_event, { orgId }) => {
    try {
      const data = await expressService.getOrgMembers(orgId);
      return { success: true, members: data.members };
    } catch (err) {
      log.error('org:getMembers failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:updateMemberRole', async (_event, { orgId, userId, role }) => {
    try {
      const data = await expressService.updateMemberRole(orgId, userId, role);
      return { success: true, member: data.member };
    } catch (err) {
      log.error('org:updateMemberRole failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:removeMember', async (_event, { orgId, userId }) => {
    try {
      await expressService.removeOrgMember(orgId, userId);
      return { success: true };
    } catch (err) {
      log.error('org:removeMember failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Invitations ────────────────────────────────────────

  ipcMain.handle('org:createInvite', async (_event, { orgId, email, role }) => {
    try {
      const data = await expressService.createOrgInvite(orgId, email, role);
      return { success: true, invite: data.invite };
    } catch (err) {
      log.error('org:createInvite failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:listInvites', async (_event, { orgId }) => {
    try {
      const data = await expressService.listOrgInvites(orgId);
      return { success: true, invites: data.invites };
    } catch (err) {
      log.error('org:listInvites failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:revokeInvite', async (_event, { orgId, inviteId }) => {
    try {
      await expressService.revokeOrgInvite(orgId, inviteId);
      return { success: true };
    } catch (err) {
      log.error('org:revokeInvite failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:acceptInvite', async (_event, { inviteCode }) => {
    try {
      const data = await expressService.acceptOrgInvite(inviteCode);
      return { success: true, organization: data.organization };
    } catch (err) {
      log.error('org:acceptInvite failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('org:getInviteDetails', async (_event, { inviteCode }) => {
    try {
      const data = await expressService.getInviteDetails(inviteCode);
      return { success: true, invite: data.invite };
    } catch (err) {
      log.error('org:getInviteDetails failed:', err.message);
      return { success: false, error: err.message };
    }
  });
}

module.exports = registerOrganizationHandlers;
