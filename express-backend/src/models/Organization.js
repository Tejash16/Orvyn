'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required.'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only.'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: String,
      enum: ['trial', 'enterprise'],
      default: 'trial',
    },
    maxSeats: {
      type: Number,
      default: 5,
    },

    // ── Razorpay billing ──────────────────────────────────
    razorpayCustomerId: { type: String, default: null },
    razorpaySubscriptionId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'cancelled', 'expired', null],
      default: null,
    },
    trialEndsAt: { type: Date },

    // ── Collaboration settings ────────────────────────────
    allowExternalSharing: { type: Boolean, default: true },

    // ── Soft delete ───────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, select: false },
  },
  { timestamps: true },
);

organizationSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.isDeleted;
    delete ret.deletedAt;
    delete ret.razorpayCustomerId;
    delete ret.razorpaySubscriptionId;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Organization', organizationSchema);
