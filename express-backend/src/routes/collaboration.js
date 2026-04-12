'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/authenticate');
const {
  listCollaborations,
  listSuggestions,
  requestCollaboration,
  acceptCollaboration,
  rejectCollaboration,
  removeCollaboration,
} = require('../controllers/collaborationController');

const router = Router();

router.get('/',                authenticate, listCollaborations);
router.get('/suggestions',     authenticate, listSuggestions);
router.post('/',               authenticate, requestCollaboration);
router.post('/:id/accept',     authenticate, acceptCollaboration);
router.post('/:id/reject',     authenticate, rejectCollaboration);
router.delete('/:id',          authenticate, removeCollaboration);

module.exports = router;
