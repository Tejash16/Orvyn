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

module.exports = router;
