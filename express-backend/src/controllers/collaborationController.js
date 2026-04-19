'use strict';

const Collaboration = require('../models/Collaboration');
const CollaborationInvite = require('../models/CollaborationInvite');
const OrganizationMember = require('../models/OrganizationMember');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { createNotification } = require('../services/notificationStream');
const logger = require('../services/logger');

const INVITE_TTL_DAYS = 14;

// ── Helpers ───────────────────────────────────────────────

async function getCaller(userId) {
  const user = await User.findById(userId).select('name email activeOrganizationId');
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

function otherSide(collab, currentUserId) {
  return String(collab.userA) === String(currentUserId) ? collab.userB : collab.userA;
}

// ── Endpoints ─────────────────────────────────────────────

/**
 * GET /api/v1/collaborations
 * Returns my collaborations. Optional ?status=pending|accepted
 * Response: { accepted: [...], incoming: [...], outgoing: [...] }
 */
async function listCollaborations(req, res, next) {
  try {
    const me = await getCaller(req.user.userId);
    const meId = me._id;

    const collabs = await Collaboration.find({
      $or: [{ userA: meId }, { userB: meId }],
    }).sort({ updatedAt: -1 });

    const otherIds = collabs.map((c) => otherSide(c, meId));
    const users = await User.find({ _id: { $in: otherIds } })
      .select('name email profilePicture')
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const shape = (c, source) => ({
      id: String(c._id),
      status: c.status,
      requestedBy: c.requestedBy,
      createdAt: c.createdAt,
      acceptedAt: c.acceptedAt,
      source,
      user: userMap.get(String(otherSide(c, meId))) || null,
    });

    const accepted = collabs
      .filter((c) => c.status === 'accepted')
      .map((c) => shape(c, 'collaborator'));
    const incoming = collabs
      .filter((c) => c.status === 'pending' && String(c.requestedBy) !== String(meId))
      .map((c) => shape(c, 'collaborator'));
    const outgoing = collabs
      .filter((c) => c.status === 'pending' && String(c.requestedBy) === String(meId))
      .map((c) => shape(c, 'collaborator'));

    // Merge active org members as implicit collaborators into "accepted".
    // Dedupe by user id — explicit collaborator entries win (keep their id).
    if (me.activeOrganizationId) {
      const seenUserIds = new Set(accepted.map((c) => c.user && String(c.user._id)));
      const members = await OrganizationMember.find({
        organizationId: me.activeOrganizationId,
        status: 'active',
        userId: { $ne: meId },
      }).populate('userId', 'name email profilePicture');

      for (const m of members) {
        if (!m.userId) continue;
        const uid = String(m.userId._id);
        if (seenUserIds.has(uid)) continue;
        seenUserIds.add(uid);
        accepted.push({
          id: `org:${uid}`,
          status: 'accepted',
          source: 'org',
          user: {
            _id: m.userId._id,
            name: m.userId.name,
            email: m.userId.email,
            profilePicture: m.userId.profilePicture,
          },
        });
      }
    }

    return res.status(200).json({ success: true, accepted, incoming, outgoing });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/collaborations/suggestions
 * People the caller is allowed to share with:
 *   - Active members of the caller's org (implicit collaborators)
 *   - Accepted Collaboration partners
 * Merged and deduped.
 */
async function listSuggestions(req, res, next) {
  try {
    const me = await getCaller(req.user.userId);
    const result = new Map(); // userId -> {user, source}

    // Org members (implicit)
    if (me.activeOrganizationId) {
      const members = await OrganizationMember.find({
        organizationId: me.activeOrganizationId,
        status: 'active',
        userId: { $ne: me._id },
      }).populate('userId', 'name email profilePicture');

      for (const m of members) {
        if (!m.userId) continue;
        result.set(String(m.userId._id), {
          _id: m.userId._id,
          name: m.userId.name,
          email: m.userId.email,
          profilePicture: m.userId.profilePicture,
          source: 'org',
        });
      }
    }

    // Accepted collaborations
    const collabs = await Collaboration.find({
      status: 'accepted',
      $or: [{ userA: me._id }, { userB: me._id }],
    });
    const partnerIds = collabs.map((c) => otherSide(c, me._id));
    const partners = await User.find({ _id: { $in: partnerIds } })
      .select('name email profilePicture')
      .lean();

    for (const p of partners) {
      const key = String(p._id);
      if (result.has(key)) continue; // org entry wins
      result.set(key, { ...p, source: 'collaborator' });
    }

    return res.status(200).json({ success: true, suggestions: Array.from(result.values()) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/collaborations
 * Body: { email }
 * Sends a collaboration request. Handles four cases:
 *  1. Email belongs to an existing user → create Collaboration(pending) + notify
 *  2. Email unregistered → create CollaborationInvite + send email
 *  3. Already collaborators (accepted) → 409
 *  4. Same-org implicit collaborator → 409
 */
async function requestCollaboration(req, res, next) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();

    const me = await getCaller(req.user.userId);

    if (cleanEmail === me.email.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'You cannot add yourself.' });
    }

    const target = await User.findOne({ email: cleanEmail, isDeleted: false });

    // Case: target exists
    if (target) {
      // Same-org implicit
      if (me.activeOrganizationId) {
        const sameOrg = await OrganizationMember.findOne({
          organizationId: me.activeOrganizationId,
          userId: target._id,
          status: 'active',
        });
        if (sameOrg) {
          return res.status(409).json({
            success: false,
            error: 'This user is already a member of your organization.',
          });
        }
      }

      const pair = Collaboration.canonicalPair(me._id, target._id);
      const existing = await Collaboration.findOne(pair);

      if (existing) {
        if (existing.status === 'accepted') {
          return res.status(409).json({ success: false, error: 'Already collaborating.' });
        }
        if (existing.status === 'pending') {
          return res.status(409).json({ success: false, error: 'A request is already pending.' });
        }
        // Rejected → allow re-request by updating in place
        existing.status = 'pending';
        existing.requestedBy = me._id;
        existing.acceptedAt = null;
        await existing.save();

        await createNotification({
          userId: target._id,
          type: 'collab_request',
          data: { fromUserId: me._id, fromUserName: me.name, fromUserEmail: me.email, collaborationId: existing._id },
        });

        return res.status(200).json({ success: true, collaboration: existing });
      }

      const created = await Collaboration.create({ ...pair, requestedBy: me._id, status: 'pending' });

      await createNotification({
        userId: target._id,
        type: 'collab_request',
        data: { fromUserId: me._id, fromUserName: me.name, fromUserEmail: me.email, collaborationId: created._id },
      });

      return res.status(201).json({ success: true, collaboration: created });
    }

    // Case: unregistered
    const existingInvite = await CollaborationInvite.findOne({
      fromUserId: me._id,
      email: cleanEmail,
      status: 'pending',
    });
    if (existingInvite) {
      return res.status(409).json({ success: false, error: 'An invite to this email is already pending.' });
    }

    const invite = await CollaborationInvite.create({
      fromUserId: me._id,
      email: cleanEmail,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    });

    try {
      await emailService.sendCollaborationInviteEmail({
        to: cleanEmail,
        fromUserName: me.name,
      });
    } catch (mailErr) {
      logger.warn(`Failed to send collaboration invite email: ${mailErr.message}`);
    }

    return res.status(201).json({ success: true, invite: { _id: invite._id, email: cleanEmail, pendingSignup: true } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/collaborations/:id/accept
 */
async function acceptCollaboration(req, res, next) {
  try {
    const me = await getCaller(req.user.userId);

    const collab = await Collaboration.findById(req.params.id);
    if (!collab) {
      return res.status(404).json({ success: false, error: 'Request not found.' });
    }
    if (collab.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Request is not pending.' });
    }
    const recipientId = String(collab.requestedBy) === String(collab.userA) ? collab.userB : collab.userA;
    if (String(recipientId) !== String(me._id)) {
      return res.status(403).json({ success: false, error: 'This request is not addressed to you.' });
    }

    collab.status = 'accepted';
    collab.acceptedAt = new Date();
    await collab.save();

    await createNotification({
      userId: collab.requestedBy,
      type: 'collab_accepted',
      data: { byUserId: me._id, byUserName: me.name, collaborationId: collab._id },
    });

    return res.status(200).json({ success: true, collaboration: collab });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/collaborations/:id/reject
 */
async function rejectCollaboration(req, res, next) {
  try {
    const me = req.user.userId;

    const collab = await Collaboration.findById(req.params.id);
    if (!collab) {
      return res.status(404).json({ success: false, error: 'Request not found.' });
    }
    if (collab.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Request is not pending.' });
    }
    const recipientId = String(collab.requestedBy) === String(collab.userA) ? collab.userB : collab.userA;
    if (String(recipientId) !== String(me)) {
      return res.status(403).json({ success: false, error: 'This request is not addressed to you.' });
    }

    collab.status = 'rejected';
    await collab.save();

    await createNotification({
      userId: collab.requestedBy,
      type: 'collab_rejected',
      data: { byUserId: me, collaborationId: collab._id },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/collaborations/:id
 * Remove a collaborator (either side can do this).
 */
async function removeCollaboration(req, res, next) {
  try {
    const me = req.user.userId;

    const collab = await Collaboration.findById(req.params.id);
    if (!collab) {
      return res.status(404).json({ success: false, error: 'Not found.' });
    }
    if (String(collab.userA) !== String(me) && String(collab.userB) !== String(me)) {
      return res.status(403).json({ success: false, error: 'Not your collaboration.' });
    }

    await collab.deleteOne();
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ── Helper: consume pending invites when a user registers ─

/**
 * Called from authController.verifyEmail after a new user verifies.
 * Converts any pending CollaborationInvite for their email into a real
 * Collaboration(pending) + notification, so they see the request on first login.
 */
async function consumePendingInvitesForEmail(userId, email) {
  try {
    const cleanEmail = String(email).toLowerCase();
    const invites = await CollaborationInvite.find({
      email: cleanEmail,
      status: 'pending',
    });

    for (const invite of invites) {
      const pair = Collaboration.canonicalPair(invite.fromUserId, userId);
      const existing = await Collaboration.findOne(pair);
      if (!existing) {
        const created = await Collaboration.create({
          ...pair,
          requestedBy: invite.fromUserId,
          status: 'pending',
        });

        const fromUser = await User.findById(invite.fromUserId).select('name email');
        await createNotification({
          userId,
          type: 'collab_request',
          data: {
            fromUserId: invite.fromUserId,
            fromUserName: fromUser ? fromUser.name : 'Someone',
            fromUserEmail: fromUser ? fromUser.email : '',
            collaborationId: created._id,
          },
        });
      }
      invite.status = 'consumed';
      await invite.save();
    }
  } catch (err) {
    logger.warn(`consumePendingInvitesForEmail failed: ${err.message}`);
  }
}

module.exports = {
  listCollaborations,
  listSuggestions,
  requestCollaboration,
  acceptCollaboration,
  rejectCollaboration,
  removeCollaboration,
  consumePendingInvitesForEmail,
};
