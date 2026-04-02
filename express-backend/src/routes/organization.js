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

// ── Audit Logs (Enterprise) ──────────────────────────────
const AuditLog = require('../models/AuditLog');

/**
 * GET /api/v1/organizations/:orgId/audit-logs
 * Query params: ?action=dataroom.shared&page=1&limit=50&from=2026-01-01&to=2026-03-31
 */
router.get('/:orgId/audit-logs', authenticate, orgAuthorize('admin'), async (req, res, next) => {
  try {
    const { action, page = 1, limit = 50, from, to } = req.query;
    const query = { organizationId: req.params.orgId };

    if (action) query.action = action;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await AuditLog.countDocuments(query);

    res.json({ logs, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
