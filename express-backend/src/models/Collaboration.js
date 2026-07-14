'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Canonical pair ordering so (A,B) and (B,A) collapse to a single document.
// We always store the lexicographically smaller ObjectId hex as userA.
function canonicalPair(id1, id2) {
  const a = String(id1);
  const b = String(id2);
  return a < b ? { userA: id1, userB: id2 } : { userA: id2, userB: id1 };
}

const collaborationSchema = new Schema(
  {
    userA: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

collaborationSchema.index({ userA: 1, userB: 1 }, { unique: true });
collaborationSchema.index({ userA: 1, status: 1 });
collaborationSchema.index({ userB: 1, status: 1 });

collaborationSchema.statics.canonicalPair = canonicalPair;

module.exports = mongoose.model('Collaboration', collaborationSchema);
