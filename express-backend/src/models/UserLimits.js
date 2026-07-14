const mongoose = require('mongoose');

const userLimitsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // ── Plan tier ──────────────────────────────────────────
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },

    // ── Configurable limits (override defaults per user) ───
    monthlyFileLimit: {
      type: Number,
      default: 500,
      min: 0,
    },
    dailyMessageLimit: {
      type: Number,
      default: 25,
      min: 0,
    },
    dataroomLimit: {
      type: Number,
      default: 3, // Free tier: 3 DataRooms. -1 = unlimited (Pro/Enterprise)
    },

    // ── Admin override flag ──────────────────────────────
    isCustomOverride: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserLimits', userLimitsSchema);
