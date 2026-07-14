'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const organizationMemberSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    invitedAt: { type: Date },
    joinedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'invited', 'removed'],
      default: 'active',
    },
  },
  { timestamps: true },
);

// One membership per user per org
organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

organizationMemberSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('OrganizationMember', organizationMemberSchema);
