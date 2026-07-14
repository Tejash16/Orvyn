const router = require('express').Router();
const { authenticate } = require('../middleware/authenticate');
const sharingController = require('../controllers/sharingController');

// Share a DataRoom (create snapshot)
router.post('/datarooms', authenticate, sharingController.createSharedDataRoom);

// Update shared snapshot (re-share with latest data)
router.put('/datarooms/:shareId', authenticate, sharingController.updateSharedDataRoom);

// Delete shared DataRoom
router.delete('/datarooms/:shareId', authenticate, sharingController.deleteSharedDataRoom);

// Grant access to a user
router.post('/datarooms/:shareId/access', authenticate, sharingController.grantAccess);

// Revoke user access
router.delete('/datarooms/:shareId/access/:userId', authenticate, sharingController.revokeAccess);

// List who has access
router.get('/datarooms/:shareId/access', authenticate, sharingController.listAccess);

// List my shared DataRooms (ones I shared)
router.get('/my-shares', authenticate, sharingController.listMyShares);

// List DataRooms shared with me
router.get('/received', authenticate, sharingController.listReceived);

// Get shared DataRoom snapshot data
router.get('/received/:shareId', authenticate, sharingController.getSharedDataRoom);

// Search users for sharing
router.get('/users/search', authenticate, sharingController.searchUsers);

// ── User-level audit logs ────────────────────────────────
const AuditLog = require('../models/AuditLog');

/**
 * GET /api/v1/sharing/me/audit-logs
 * Individual user's own activity log.
 * Query params: ?page=1&limit=50
 */
router.get('/me/audit-logs', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const logs = await AuditLog.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await AuditLog.countDocuments({ userId: req.user.userId });
    res.json({ logs, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
