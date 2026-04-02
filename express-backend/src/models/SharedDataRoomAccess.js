const mongoose = require('mongoose');

const sharedDataRoomAccessSchema = new mongoose.Schema({
  sharedDataRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SharedDataRoom',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  permission: {
    type: String,
    enum: ['viewer', 'editor'],
    default: 'viewer',
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active',
  },
  // Track if recipient has seen the latest version
  lastViewedVersion: { type: Number, default: 0 },
}, { timestamps: true });

sharedDataRoomAccessSchema.index({ sharedDataRoomId: 1, userId: 1 }, { unique: true });
sharedDataRoomAccessSchema.index({ userId: 1, status: 1 }); // For "shared with me" queries

module.exports = mongoose.model('SharedDataRoomAccess', sharedDataRoomAccessSchema);
