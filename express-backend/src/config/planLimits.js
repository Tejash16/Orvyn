'use strict';

/**
 * Plan-to-limits mapping.
 * Centralizes all tier-specific limit values.
 * -1 = unlimited.
 */
const PLAN_LIMITS = {
  free: {
    monthlyFileLimit: 500,
    dailyMessageLimit: 25,
    dataroomLimit: 3,
  },
  pro: {
    monthlyFileLimit: 5000,
    dailyMessageLimit: -1, // unlimited
    dataroomLimit: -1,
  },
  enterprise: {
    monthlyFileLimit: 10000,
    dailyMessageLimit: -1,
    dataroomLimit: -1,
  },
};

module.exports = { PLAN_LIMITS };
