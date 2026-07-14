const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Express middleware that verifies a Bearer JWT.
 * On success, attaches the decoded payload to req.user and calls next().
 * Returns 401 for missing, malformed, invalid, or expired tokens.
 * Returns 403 for suspended or banned accounts.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided.' });
  }

  const token = authHeader.slice(7);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }

  // Check account restriction status
  User.findById(decoded.userId)
    .select('restrictionStatus restrictedUntil')
    .lean()
    .then((user) => {
      if (!user) {
        return res.status(401).json({ success: false, error: 'User not found.' });
      }

      if (user.restrictionStatus === 'banned') {
        return res.status(403).json({
          success: false,
          error: 'Account has been banned. Contact support for assistance.',
          code: 'ACCOUNT_BANNED',
        });
      }

      if (user.restrictionStatus === 'suspended') {
        // Check if suspension has expired
        if (!user.restrictedUntil || user.restrictedUntil > new Date()) {
          return res.status(403).json({
            success: false,
            error: 'Account is temporarily suspended.',
            code: 'ACCOUNT_SUSPENDED',
            ...(user.restrictedUntil && { suspendedUntil: user.restrictedUntil }),
          });
        }
        // Suspension expired — auto-reactivate (non-blocking)
        User.updateOne(
          { _id: decoded.userId },
          { restrictionStatus: 'active', restrictionReason: null, restrictedUntil: null, restrictedBy: null }
        ).catch(() => {});
      }

      req.user = decoded;
      next();
    })
    .catch(() => {
      // DB error — fall through with decoded token to avoid blocking legitimate requests
      req.user = decoded;
      next();
    });
}

module.exports = { authenticate };
