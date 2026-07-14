'use strict';

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  userName: { type: String, required: true }, // Denormalized for fast reads
  userEmail: { type: String, required: true },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      // Sharing
      'dataroom.shared',
      'dataroom.share_revoked',
      'dataroom.share_updated',
      'dataroom.accessed',        // Recipient viewed shared DataRoom
      'dataroom.imported',        // Recipient imported shared DataRoom

      // Organization
      'org.member_invited',
      'org.member_joined',
      'org.member_removed',
      'org.member_role_changed',
      'org.settings_updated',

      // Billing
      'billing.subscription_created',
      'billing.payment_success',
      'billing.payment_failed',
      'billing.subscription_cancelled',
      'billing.plan_downgraded',

      // DataRoom lifecycle
      'dataroom.created',
      'dataroom.deleted',

      // Admin actions
      'admin.user_suspended',
      'admin.user_unsuspended',
      'admin.user_banned',
      'admin.user_deleted',
      'admin.limits_overridden',
      'admin.promo_code_created',
      'admin.promo_code_deactivated',
      'admin.notification_broadcast',
      'admin.collaboration_broken',
    ],
    index: true,
  },
  resourceType: {
    type: String,
    enum: ['dataroom', 'organization', 'subscription', 'user'],
    required: true,
  },
  resourceId: { type: String, required: true }, // ID of the affected resource
  resourceName: { type: String, default: null }, // Human-readable (e.g., DataRoom name)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // E.g., { recipientEmail, permission, paymentId, oldRole, newRole }
  ipAddress: { type: String, default: null },
}, {
  timestamps: true, // createdAt serves as the event timestamp
});

// Compound index for org-level audit queries
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
// User-level audit queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
// TTL index: auto-delete logs older than 1 year (configurable)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
