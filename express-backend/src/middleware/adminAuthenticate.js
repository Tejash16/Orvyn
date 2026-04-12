const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../services/logger');

/**
 * Admin authentication middleware.
 * 1. Checks IP against ADMIN_ALLOWED_IPS whitelist
 * 2. Verifies Bearer JWT token
 * 3. Loads user and confirms role === 'admin'
 */
function adminAuthenticate(req, res, next) {
  // ── Step 1: IP whitelist check ──
  const allowedIps = process.env.ADMIN_ALLOWED_IPS;
  if (allowedIps) {
    const whitelist = allowedIps.split(',').map((ip) => ip.trim()).filter(Boolean);
    const clientIp = req.ip || req.connection.remoteAddress || '';
    // Normalize IPv6-mapped IPv4 (::ffff:127.0.0.1 → 127.0.0.1)
    const normalizedIp = clientIp.replace(/^::ffff:/, '');

    if (whitelist.length > 0 && !whitelist.includes(normalizedIp) && !whitelist.includes(clientIp)) {
      logger.warn(`Admin access denied for IP: ${clientIp} (normalized: ${normalizedIp})`);
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
  }

  // ── Step 2: Bearer token verification ──
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided.' });
  }

  const token = authHeader.slice(7);
  let decoded;
  try {
    // Use ADMIN_SESSION_SECRET if set, otherwise fall back to JWT_SECRET
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET;
    decoded = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }

  // ── Step 3: Load user and verify admin role ──
  User.findById(decoded.userId)
    .select('+role')
    .then((user) => {
      if (!user) {
        return res.status(401).json({ success: false, error: 'User not found.' });
      }
      if (user.role !== 'admin') {
        logger.warn(`Non-admin user ${user.email} attempted admin access`);
        return res.status(403).json({ success: false, error: 'Insufficient privileges.' });
      }
      if (user.isDeleted) {
        return res.status(403).json({ success: false, error: 'Account has been deleted.' });
      }

      req.admin = { userId: user._id, email: user.email, name: user.name };
      next();
    })
    .catch((err) => {
      logger.error('Admin auth middleware error:', err);
      return res.status(500).json({ success: false, error: 'Authentication failed.' });
    });
}

module.exports = { adminAuthenticate };
