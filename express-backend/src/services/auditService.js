'use strict';

const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

/**
 * Log an auditable action. Call this from controllers/services after the action succeeds.
 * Audit logging should never block the main operation — errors are caught and logged.
 *
 * @param {Object} params
 * @param {string} params.userId - Who performed the action
 * @param {string} params.userName
 * @param {string} params.userEmail
 * @param {string} [params.organizationId] - Org context (if applicable)
 * @param {string} params.action - Action enum value
 * @param {string} params.resourceType - 'dataroom' | 'organization' | 'subscription' | 'user'
 * @param {string} params.resourceId - ID of the affected resource
 * @param {string} [params.resourceName] - Human-readable name
 * @param {Object} [params.metadata] - Extra context (recipientEmail, paymentId, etc.)
 * @param {string} [params.ipAddress]
 */
async function logAudit(params) {
  try {
    await AuditLog.create(params);
  } catch (err) {
    // Audit logging should never block the main operation
    logger.error('Failed to write audit log:', err.message);
  }
}

module.exports = { logAudit };
