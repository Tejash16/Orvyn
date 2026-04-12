'use strict';

const express = require('express');
const router = express.Router();
const { adminAuthenticate } = require('../middleware/adminAuthenticate');
const admin = require('../controllers/adminController');

// ── Auth (no middleware) ──
router.post('/login', admin.login);

// ── All other routes require admin auth ──
router.use(adminAuthenticate);

// ── Dashboard ──
router.get('/dashboard/stats', admin.dashboardStats);

// ── Users ──
router.get('/users', admin.listUsers);
router.get('/users/:id', admin.getUserDetail);
router.post('/users/:id/suspend', admin.suspendUser);
router.post('/users/:id/unsuspend', admin.unsuspendUser);
router.post('/users/:id/ban', admin.banUser);
router.delete('/users/:id', admin.deleteUser);
router.post('/users/:id/reset-password', admin.resetUserPassword);
router.put('/users/:id/limits', admin.updateUserLimits);

// ── Promo Codes ──
router.get('/promo-codes', admin.listPromoCodes);
router.post('/promo-codes', admin.createPromoCode);
router.post('/promo-codes/:id/deactivate', admin.deactivatePromoCode);

// ── Subscriptions ──
router.get('/subscriptions', admin.listSubscriptions);

// ── Organizations ──
router.get('/organizations', admin.listOrganizations);
router.get('/organizations/:id', admin.getOrganizationDetail);
router.put('/organizations/:id/seats', admin.updateOrgSeats);

// ── Audit Logs ──
router.get('/audit-logs', admin.listAuditLogs);

// ── Database Browser ──
router.get('/database/collections', admin.listCollections);
router.get('/database/:collection', admin.browseCollection);

// ── Collaborations ──
router.get('/collaborations', admin.listCollaborations);
router.delete('/collaborations/:id', admin.breakCollaboration);

// ── Notifications ──
router.post('/notifications/broadcast', admin.broadcastNotification);

// ── System Health ──
router.get('/system/health', admin.systemHealth);

// ── Export ──
router.get('/export/:type', admin.exportData);

// ── Shared DataRooms ──
router.get('/shared-datarooms', admin.listSharedDataRooms);

module.exports = router;
