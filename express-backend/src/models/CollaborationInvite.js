'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Placeholder for a collaboration request sent to an email that has no
// Orvyn account yet. When that email registers (authController.verifyEmail
// path), we convert every pending invite for that email into a real
// Collaboration(pending) doc and emit a notification.
const collaborationInviteSchema = new Schema(
  {
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'consumed', 'expired'],
      default: 'pending',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true },
);

collaborationInviteSchema.index({ email: 1, status: 1 });
collaborationInviteSchema.index({ fromUserId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('CollaborationInvite', collaborationInviteSchema);
