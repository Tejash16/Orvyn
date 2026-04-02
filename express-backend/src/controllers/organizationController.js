'use strict';

const crypto = require('crypto');

const Organization       = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const OrganizationInvite = require('../models/OrganizationInvite');
const User               = require('../models/User');
const { sendOrganizationInviteEmail } = require('../services/emailService');
const logger = require('../services/logger');

// ── Helpers ───────────────────────────────────────────────

/**
 * Generate a URL-safe slug from a name. If the slug collides, appends -2, -3, etc.
 */
async function generateUniqueSlug(baseName) {
  const base = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  let slug = base;
  let suffix = 1;

  while (await Organization.findOne({ slug, isDeleted: false })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }

  return slug;
}

// ── Organization CRUD ─────────────────────────────────────

/**
 * POST /api/v1/organizations
 * Creates an organization and adds the creator as owner.
 */
async function createOrganization(req, res, next) {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Organization name is required.' });
    }

    const slug = await generateUniqueSlug(name.trim());

    const org = await Organization.create({
      name: name.trim(),
      slug,
      createdBy: userId,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
    });

    // Add creator as owner
    await OrganizationMember.create({
      organizationId: org._id,
      userId,
      role: 'owner',
      joinedAt: new Date(),
      status: 'active',
    });

    // Update user
    await User.findByIdAndUpdate(userId, {
      userType: 'enterprise',
      activeOrganizationId: org._id,
    });

    return res.status(201).json({ success: true, organization: org.toJSON() });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
}

/**
 * GET /api/v1/organizations/:orgId
 */
async function getOrganization(req, res, next) {
  try {
    const org = await Organization.findOne({ _id: req.params.orgId, isDeleted: false });
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found.' });
    }
    return res.status(200).json({ success: true, organization: org.toJSON() });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/organizations/:orgId
 */
async function updateOrganization(req, res, next) {
  try {
    const { name, slug, allowExternalSharing } = req.body;
    const org = await Organization.findOne({ _id: req.params.orgId, isDeleted: false });
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found.' });
    }

    if (name !== undefined) org.name = name.trim();

    if (slug !== undefined) {
      const normalized = slug.toLowerCase().trim();
      // Check uniqueness if slug changed
      if (normalized !== org.slug) {
        const existing = await Organization.findOne({ slug: normalized, isDeleted: false, _id: { $ne: org._id } });
        if (existing) {
          return res.status(409).json({ success: false, error: 'This slug is already taken.' });
        }
        org.slug = normalized;
      }
    }

    if (allowExternalSharing !== undefined) org.allowExternalSharing = allowExternalSharing;

    await org.save();
    return res.status(200).json({ success: true, organization: org.toJSON() });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/organizations/:orgId
 * Soft-deletes the organization and clears activeOrganizationId for all members.
 */
async function deleteOrganization(req, res, next) {
  try {
    const org = await Organization.findOne({ _id: req.params.orgId, isDeleted: false });
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found.' });
    }

    org.isDeleted = true;
    org.deletedAt = new Date();
    await org.save();

    // Clear activeOrganizationId for all members
    const members = await OrganizationMember.find({ organizationId: org._id, status: 'active' });
    const memberUserIds = members.map((m) => m.userId);
    await User.updateMany(
      { _id: { $in: memberUserIds }, activeOrganizationId: org._id },
      { $set: { activeOrganizationId: null } },
    );

    // Mark all memberships as removed
    await OrganizationMember.updateMany(
      { organizationId: org._id, status: 'active' },
      { $set: { status: 'removed' } },
    );

    // Revoke all pending invites
    await OrganizationInvite.updateMany(
      { organizationId: org._id, status: 'pending' },
      { $set: { status: 'revoked' } },
    );

    return res.status(200).json({ success: true, message: 'Organization deleted.' });
  } catch (err) {
    next(err);
  }
}

// ── Members ───────────────────────────────────────────────

/**
 * GET /api/v1/organizations/:orgId/members
 */
async function listMembers(req, res, next) {
  try {
    const members = await OrganizationMember.find({
      organizationId: req.params.orgId,
      status: 'active',
    }).populate('userId', 'name email profilePicture');

    return res.status(200).json({ success: true, members: members.map((m) => m.toJSON()) });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/organizations/:orgId/members/:userId
 * Update a member's role. Cannot change the owner's role.
 */
async function updateMemberRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!role || !['admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Role must be "admin" or "member".' });
    }

    const targetMember = await OrganizationMember.findOne({
      organizationId: req.params.orgId,
      userId: req.params.userId,
      status: 'active',
    });

    if (!targetMember) {
      return res.status(404).json({ success: false, error: 'Member not found.' });
    }

    if (targetMember.role === 'owner') {
      return res.status(403).json({ success: false, error: 'Cannot change the owner\'s role.' });
    }

    // Prevent self-demotion
    if (req.params.userId === req.user.userId && role === 'member' && req.orgMembership.role === 'admin') {
      return res.status(403).json({ success: false, error: 'Cannot demote yourself.' });
    }

    targetMember.role = role;
    await targetMember.save();

    return res.status(200).json({ success: true, member: targetMember.toJSON() });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/organizations/:orgId/members/:userId
 * Remove a member from the organization. Cannot remove the owner.
 */
async function removeMember(req, res, next) {
  try {
    const targetMember = await OrganizationMember.findOne({
      organizationId: req.params.orgId,
      userId: req.params.userId,
      status: 'active',
    });

    if (!targetMember) {
      return res.status(404).json({ success: false, error: 'Member not found.' });
    }

    if (targetMember.role === 'owner') {
      return res.status(403).json({ success: false, error: 'Cannot remove the organization owner.' });
    }

    targetMember.status = 'removed';
    await targetMember.save();

    // Clear their activeOrganizationId if it matches
    await User.findOneAndUpdate(
      { _id: req.params.userId, activeOrganizationId: req.params.orgId },
      { $set: { activeOrganizationId: null } },
    );

    return res.status(200).json({ success: true, message: 'Member removed.' });
  } catch (err) {
    next(err);
  }
}

// ── Invitations ───────────────────────────────────────────

/**
 * POST /api/v1/organizations/:orgId/invites
 */
async function createInvite(req, res, next) {
  try {
    const { email, role } = req.body;
    const orgId = req.params.orgId;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email is required.' });
    }

    if (role && !['admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Role must be "admin" or "member".' });
    }

    const org = await Organization.findOne({ _id: orgId, isDeleted: false });
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found.' });
    }

    // Check seat limit (active members + pending invites)
    const activeCount = await OrganizationMember.countDocuments({
      organizationId: orgId,
      status: 'active',
    });
    const pendingInviteCount = await OrganizationInvite.countDocuments({
      organizationId: orgId,
      status: 'pending',
    });

    if (activeCount + pendingInviteCount >= org.maxSeats) {
      return res.status(400).json({
        success: false,
        error: `Seat limit reached (${org.maxSeats}). Upgrade to add more members.`,
      });
    }

    // Check for duplicate pending invite
    const existingInvite = await OrganizationInvite.findOne({
      organizationId: orgId,
      email: email.toLowerCase().trim(),
      status: 'pending',
    });
    if (existingInvite) {
      return res.status(409).json({
        success: false,
        error: 'A pending invite already exists for this email.',
      });
    }

    // Check if user is already a member
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      const existingMembership = await OrganizationMember.findOne({
        organizationId: orgId,
        userId: existingUser._id,
        status: 'active',
      });
      if (existingMembership) {
        return res.status(409).json({ success: false, error: 'This user is already a member.' });
      }
    }

    const inviteCode = crypto.randomBytes(16).toString('hex');

    const invite = await OrganizationInvite.create({
      organizationId: orgId,
      email: email.toLowerCase().trim(),
      inviteCode,
      invitedBy: req.user.userId,
      role: role || 'member',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Send invite email
    const inviter = await User.findById(req.user.userId);
    await sendOrganizationInviteEmail({
      to: invite.email,
      orgName: org.name,
      inviterName: inviter?.name || 'A team member',
      inviteCode: invite.inviteCode,
      role: invite.role,
      expiresAt: invite.expiresAt,
    });

    return res.status(201).json({
      success: true,
      invite: {
        _id: invite._id,
        inviteCode: invite.inviteCode,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/organizations/:orgId/invites
 */
async function listInvites(req, res, next) {
  try {
    const invites = await OrganizationInvite.find({
      organizationId: req.params.orgId,
      status: 'pending',
    }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, invites: invites.map((i) => i.toJSON()) });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/organizations/:orgId/invites/:inviteId
 */
async function revokeInvite(req, res, next) {
  try {
    const invite = await OrganizationInvite.findOne({
      _id: req.params.inviteId,
      organizationId: req.params.orgId,
      status: 'pending',
    });

    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invite not found or already used.' });
    }

    invite.status = 'revoked';
    await invite.save();

    return res.status(200).json({ success: true, message: 'Invite revoked.' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/organizations/invites/:inviteCode/accept
 * Authenticated user accepts an invite.
 */
async function acceptInvite(req, res, next) {
  try {
    const invite = await OrganizationInvite.findOne({
      inviteCode: req.params.inviteCode,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invalid or expired invite.' });
    }

    const org = await Organization.findOne({ _id: invite.organizationId, isDeleted: false });
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization no longer exists.' });
    }

    // Check if already a member (e.g., re-joining after removal)
    const existingMembership = await OrganizationMember.findOne({
      organizationId: invite.organizationId,
      userId: req.user.userId,
    });

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        // Already active — just mark invite as accepted
        invite.status = 'accepted';
        await invite.save();
        return res.status(200).json({ success: true, organization: org.toJSON() });
      }
      // Reactivate removed member
      existingMembership.status = 'active';
      existingMembership.role = invite.role;
      existingMembership.invitedBy = invite.invitedBy;
      existingMembership.invitedAt = invite.createdAt;
      existingMembership.joinedAt = new Date();
      await existingMembership.save();
    } else {
      // Create new membership
      await OrganizationMember.create({
        organizationId: invite.organizationId,
        userId: req.user.userId,
        role: invite.role,
        invitedBy: invite.invitedBy,
        invitedAt: invite.createdAt,
        joinedAt: new Date(),
        status: 'active',
      });
    }

    // Mark invite as accepted
    invite.status = 'accepted';
    await invite.save();

    // Update user
    await User.findByIdAndUpdate(req.user.userId, {
      userType: 'enterprise',
      activeOrganizationId: invite.organizationId,
    });

    return res.status(200).json({ success: true, organization: org.toJSON() });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/organizations/invites/:inviteCode
 * Public preview of an invite — no auth required.
 */
async function getInviteDetails(req, res, next) {
  try {
    const invite = await OrganizationInvite.findOne({
      inviteCode: req.params.inviteCode,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).populate('invitedBy', 'name');

    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invalid or expired invite.' });
    }

    const org = await Organization.findOne({ _id: invite.organizationId, isDeleted: false });
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization no longer exists.' });
    }

    return res.status(200).json({
      success: true,
      invite: {
        orgName: org.name,
        inviterName: invite.invitedBy?.name || 'A team member',
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  listMembers,
  updateMemberRole,
  removeMember,
  createInvite,
  listInvites,
  revokeInvite,
  acceptInvite,
  getInviteDetails,
};
