'use strict';

const OrganizationMember = require('../models/OrganizationMember');

/**
 * Role hierarchy — higher number = more permissions.
 * owner implicitly has all permissions.
 */
const ROLE_LEVELS = { member: 0, admin: 1, owner: 2 };

/**
 * Middleware factory to check organization membership and role.
 *
 * Usage:
 *   router.get('/:orgId', authenticate, orgAuthorize('member'), handler)
 *   router.put('/:orgId', authenticate, orgAuthorize('admin'), handler)
 *   router.delete('/:orgId', authenticate, orgAuthorize('owner'), handler)
 *
 * The lowest role in `requiredRoles` determines the minimum level needed.
 * For example, orgAuthorize('admin') allows admin + owner.
 *
 * Attaches `req.orgMembership` for downstream handlers.
 */
function orgAuthorize(...requiredRoles) {
  return async (req, res, next) => {
    try {
      const orgId  = req.params.orgId;
      const userId = req.user.userId;

      const membership = await OrganizationMember.findOne({
        organizationId: orgId,
        userId,
        status: 'active',
      });

      if (!membership) {
        return res.status(403).json({ success: false, error: 'Not a member of this organization.' });
      }

      // Determine minimum required level
      const minLevel = Math.min(
        ...requiredRoles.map((r) => ROLE_LEVELS[r] ?? 0),
      );

      if (ROLE_LEVELS[membership.role] < minLevel) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions.' });
      }

      req.orgMembership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = orgAuthorize;
