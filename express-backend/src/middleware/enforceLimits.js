'use strict';

const UserLimits = require('../models/UserLimits');
const UserUsage  = require('../models/UserUsage');
const logger     = require('../services/logger');

// Period durations (must match usageService constants)
const FILE_PERIOD_MS    = 30 * 24 * 60 * 60 * 1000; // 30 days
const MESSAGE_PERIOD_MS = 24 * 60 * 60 * 1000;      // 1 day

/**
 * Middleware factory for server-side usage enforcement.
 *
 * This is a DEFENSIVE layer — the primary enforcement for files and messages
 * already happens in usageService (atomic check + increment). This middleware
 * catches direct API access that bypasses Electron.
 *
 * Usage:
 *   router.post('/endpoint', authenticate, enforceLimits('message'), handler)
 *   router.post('/endpoint', authenticate, enforceLimits('file', req => req.body.fingerprints?.length || 0), handler)
 *
 * @param {'message' | 'dataroom' | 'file'} resourceType - What resource to check
 * @param {Function} [countFn] - Optional function(req) => number, for batch operations
 */
function enforceLimits(resourceType, countFn) {
  return async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const limits = await UserLimits.findOne({ userId });
      const usage  = await UserUsage.findOne({ userId });

      // No limits record = free tier defaults
      const plan = limits?.plan || 'free';

      switch (resourceType) {
        case 'message': {
          const dailyLimit = limits?.dailyMessageLimit ?? 25;
          if (dailyLimit === -1) break; // -1 = unlimited (Pro/Enterprise)

          // Reset if day has elapsed
          let todayCount = usage?.messagesToday ?? 0;
          if (usage?.messageDayStart) {
            const now = Date.now();
            if (now >= usage.messageDayStart.getTime() + MESSAGE_PERIOD_MS) {
              todayCount = 0; // Period expired — actual reset happens in usageService
            }
          }

          if (todayCount >= dailyLimit) {
            return res.status(403).json({
              error: `Daily message limit reached (${dailyLimit}). Upgrade for unlimited messages.`,
              code: 'LIMIT_EXCEEDED',
              resourceType: 'message',
              limit: dailyLimit,
              current: todayCount,
              plan,
              upgradeRequired: true,
            });
          }
          break;
        }

        case 'dataroom': {
          const dataroomLimit = limits?.dataroomLimit ?? 3;
          if (dataroomLimit === -1) break; // Unlimited

          // DataRoom count lives in Python (SQLite) — Electron enforces with actual count.
          // This is a best-effort guard for direct Express API access.
          // The generate-dataroom endpoint creates a new DataRoom, so we pass through
          // and rely on Electron's pre-check for actual count enforcement.
          break;
        }

        case 'file': {
          const monthlyLimit = limits?.monthlyFileLimit ?? 500;
          if (monthlyLimit === -1) break; // Unlimited

          // Reset if period has elapsed
          let currentUsage = usage?.filesUploadedThisPeriod ?? 0;
          if (usage?.filePeriodStart) {
            const now = Date.now();
            if (now >= usage.filePeriodStart.getTime() + FILE_PERIOD_MS) {
              currentUsage = 0; // Period expired — actual reset happens in usageService
            }
          }

          const batchSize = countFn ? countFn(req) : 1;

          if (currentUsage + batchSize > monthlyLimit) {
            return res.status(403).json({
              error: `Monthly file limit would be exceeded (${currentUsage}/${monthlyLimit}). Upgrade for more files.`,
              code: 'LIMIT_EXCEEDED',
              resourceType: 'file',
              limit: monthlyLimit,
              current: currentUsage,
              requested: batchSize,
              plan,
              upgradeRequired: true,
            });
          }
          break;
        }
      }

      next();
    } catch (error) {
      // Limit check failure should NOT block the request — log and proceed
      logger.error('enforceLimits middleware error:', error.message);
      next();
    }
  };
}

module.exports = enforceLimits;
