'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/authenticate');
const orgAuthorize = require('../middleware/orgAuthorize');
const { orgCreateLimiter, orgInviteLimiter } = require('../middleware/rateLimiter');
const {
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  listMembers,
  updateMemberRole,
  removeMember,
  createInvite,
  listInvites,
  revokeInvite,
  acceptInvite,
  getInviteDetails,
} = require('../controllers/organizationController');

const router = Router();

// ── Public / auth-only invite routes ─────────────────────
// MUST be defined before /:orgId routes to prevent "invites"
// being matched as an orgId parameter.
router.get('/invites/:inviteCode',          getInviteDetails);
router.post('/invites/:inviteCode/accept',  authenticate, acceptInvite);

// ── Organization CRUD ────────────────────────────────────
router.post('/',            authenticate, orgCreateLimiter, createOrganization);
router.get('/:orgId',       authenticate, orgAuthorize('member'), getOrganization);
router.put('/:orgId',       authenticate, orgAuthorize('admin'), updateOrganization);
router.delete('/:orgId',    authenticate, orgAuthorize('owner'), deleteOrganization);

// ── Members ──────────────────────────────────────────────
router.get('/:orgId/members',           authenticate, orgAuthorize('member'), listMembers);
router.put('/:orgId/members/:userId',   authenticate, orgAuthorize('admin'), updateMemberRole);
router.delete('/:orgId/members/:userId', authenticate, orgAuthorize('admin'), removeMember);

// ── Invitations (org-scoped) ─────────────────────────────
router.post('/:orgId/invites',              authenticate, orgAuthorize('admin'), orgInviteLimiter, createInvite);
router.get('/:orgId/invites',               authenticate, orgAuthorize('admin'), listInvites);
router.delete('/:orgId/invites/:inviteId',  authenticate, orgAuthorize('admin'), revokeInvite);

module.exports = router;
