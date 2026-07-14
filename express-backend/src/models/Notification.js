'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Lightweight notification record surfaced to the user via polling.
// `data` is intentionally flexible (Mixed) so different types can carry
// whatever context the UI needs without schema migrations.
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'collab_request',
        'collab_accepted',
        'collab_rejected',
        'dataroom_shared',
        'dataroom_updated',
      ],
      required: true,
    },
    data: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
