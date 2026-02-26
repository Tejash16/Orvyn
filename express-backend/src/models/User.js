const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
      required: function () {
        return this.provider === 'local';
      },
    },
    provider: {
      type: String,
      default: 'local',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    // Hashed refresh token — plaintext never stored.
    // select: false ensures it is never included in query results by default.
    refreshToken: {
      type: String,
      select: false,
    },
    refreshTokenExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// Exclude sensitive fields from all JSON responses
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.emailVerificationToken;
    delete ret.emailVerificationExpires;
    delete ret.refreshToken;
    delete ret.refreshTokenExpires;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    delete ret.isDeleted;
    delete ret.deletedAt;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
