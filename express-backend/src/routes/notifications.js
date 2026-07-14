'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/authenticate');
const {
  listNotifications,
  markRead,
  markAllRead,
  streamNotifications,
} = require('../controllers/notificationController');

const router = Router();

router.get('/stream',        authenticate, streamNotifications);
router.get('/',              authenticate, listNotifications);
router.post('/read-all',     authenticate, markAllRead);
router.post('/:id/read',     authenticate, markRead);

module.exports = router;
