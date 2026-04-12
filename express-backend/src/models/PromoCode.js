const mongoose = require('mongoose');
const { Schema } = mongoose;

const promoCodeSchema = new Schema(
  {
    code: {
      type: String,
      required: [true, 'Promo code is required.'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed', 'trial_extension'],
      required: [true, 'Discount type is required.'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required.'],
    },
    applicablePlans: [
      {
        type: String,
        enum: ['pro', 'enterprise'],
      },
    ],
    maxRedemptions: {
      type: Number,
      default: null, // null = unlimited
    },
    currentRedemptions: {
      type: Number,
      default: 0,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      default: null, // null = no expiry
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1 });

module.exports = mongoose.model('PromoCode', promoCodeSchema);
