const SharedDataRoom = require('../models/SharedDataRoom');
const SharedDataRoomAccess = require('../models/SharedDataRoomAccess');
const Collaboration = require('../models/Collaboration');
const OrganizationMember = require('../models/OrganizationMember');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../services/logger');
const { logAudit } = require('../services/auditService');

/**
 * Returns true if `caller` is allowed to share with `recipient`.
 * Allowed when they are active members of the same org, or have an
 * accepted Collaboration. Used as the gate for createShare and grantAccess.
 */
async function isAllowedToShareWith(caller, recipientId) {
  if (String(caller._id) === String(recipientId)) return false;

  if (caller.activeOrganizationId) {
    const sameOrg = await OrganizationMember.findOne({
      organizationId: caller.activeOrganizationId,
      userId: recipientId,
      status: 'active',
    });
    if (sameOrg) return true;
  }

  const pair = Collaboration.canonicalPair(caller._id, recipientId);
  const collab = await Collaboration.findOne({ ...pair, status: 'accepted' });
  return !!collab;
}

/**
 * POST /api/v1/sharing/datarooms
 * Create a shared DataRoom snapshot.
 * Body: { sourceDataroomId, name, description, folderTree, files, recipientEmail }
 */
async function createSharedDataRoom(req, res, next) {
  try {
    const { sourceDataroomId, name, description, folderTree, files, recipientEmail } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Collaboration gate: recipient (if provided) must be an org peer or an
    // accepted Collaboration partner. This replaces the previous
    // allowExternalSharing-only check because Collaboration is now the
    // primary authorization layer for sharing.
    if (recipientEmail) {
      const recipient = await User.findOne({ email: recipientEmail.toLowerCase(), isDeleted: false });
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found. Add them to your Collaboration list first.' });
      }
      const allowed = await isAllowedToShareWith(user, recipient._id);
      if (!allowed) {
        return res.status(403).json({
          error: 'You can only share with users in your Collaboration list.',
        });
      }
    }

    const shared = await SharedDataRoom.create({
      sourceDataroomId,
      sourceDataroomName: name,
      sourceDataroomDescription: description || '',
      ownerId: req.user.userId,
      ownerName: user.name,
      folderTree,
      files,
      fileCount: files ? files.length : 0,
      folderCount: countFolders(folderTree),
      snapshotVersion: 1,
    });

    // Grant access to recipient if email provided.
    // Recipient existence + permission was already verified above by the
    // isAllowedToShareWith gate, so we re-fetch just to get the ObjectId.
    if (recipientEmail) {
      const recipient = await User.findOne({ email: recipientEmail.toLowerCase(), isDeleted: false });
      if (recipient) {
        await SharedDataRoomAccess.create({
          sharedDataRoomId: shared._id,
          userId: recipient._id,
          permission: 'viewer',
          grantedBy: req.user.userId,
        });

        // In-app notification (surfaces on recipient's next poll, even if offline)
        await Notification.create({
          userId: recipient._id,
          type: 'dataroom_shared',
          data: {
            fromUserId: user._id,
            fromUserName: user.name,
            shareId: shared._id,
            dataRoomName: name,
          },
        });

        // Send sharing notification email
        try {
          const emailService = require('../services/emailService');
          await emailService.sendDataRoomSharedEmail({
            to: recipient.email,
            sharerName: user.name,
            dataRoomName: name,
          });
        } catch (emailErr) {
          logger.warn(`Failed to send sharing notification email: ${emailErr.message}`);
        }
      }
    }

    // Audit log: DataRoom shared
    await logAudit({
      userId: req.user.userId,
      userName: user.name,
      userEmail: user.email,
      organizationId: user.activeOrganizationId || null,
      action: 'dataroom.shared',
      resourceType: 'dataroom',
      resourceId: shared._id.toString(),
      resourceName: name,
      metadata: { recipientEmail, permission: 'viewer' },
      ipAddress: req.ip,
    });

    res.status(201).json({ sharedDataRoom: shared });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/sharing/datarooms/:shareId
 * Update snapshot with latest data (manual re-share).
 */
async function updateSharedDataRoom(req, res, next) {
  try {
    const shared = await SharedDataRoom.findOne({
      _id: req.params.shareId,
      ownerId: req.user.userId,
      isDeleted: false,
    });

    if (!shared) return res.status(404).json({ error: 'Shared DataRoom not found' });

    const { folderTree, files } = req.body;
    shared.folderTree = folderTree;
    shared.files = files;
    shared.fileCount = files ? files.length : 0;
    shared.folderCount = countFolders(folderTree);
    shared.snapshotVersion += 1;
    shared.snapshotCreatedAt = new Date();
    await shared.save();

    // Audit log: shared DataRoom updated
    const owner = await User.findById(req.user.userId).select('name email activeOrganizationId');
    if (owner) {
      await logAudit({
        userId: req.user.userId,
        userName: owner.name,
        userEmail: owner.email,
        organizationId: owner.activeOrganizationId || null,
        action: 'dataroom.share_updated',
        resourceType: 'dataroom',
        resourceId: shared._id.toString(),
        resourceName: shared.sourceDataroomName,
        metadata: { snapshotVersion: shared.snapshotVersion },
        ipAddress: req.ip,
      });
    }

    res.json({ sharedDataRoom: shared });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/sharing/datarooms/:shareId
 * Soft delete a shared DataRoom.
 */
async function deleteSharedDataRoom(req, res, next) {
  try {
    const shared = await SharedDataRoom.findOne({
      _id: req.params.shareId,
      ownerId: req.user.userId,
      isDeleted: false,
    });

    if (!shared) return res.status(404).json({ error: 'Shared DataRoom not found' });

    shared.isDeleted = true;
    await shared.save();

    // Revoke all active access records
    await SharedDataRoomAccess.updateMany(
      { sharedDataRoomId: shared._id, status: 'active' },
      { status: 'revoked' }
    );

    res.json({ message: 'Shared DataRoom deleted' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/sharing/datarooms/:shareId/access
 * Grant access to another user.
 */
async function grantAccess(req, res, next) {
  try {
    const shared = await SharedDataRoom.findOne({
      _id: req.params.shareId,
      ownerId: req.user.userId,
      isDeleted: false,
    });
    if (!shared) return res.status(404).json({ error: 'Not found' });

    const { email, permission } = req.body;
    const recipient = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (!recipient) return res.status(404).json({ error: 'User not found' });

    // Prevent self-sharing
    if (recipient._id.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }

    // Collaboration gate: same as createSharedDataRoom
    const caller = await User.findById(req.user.userId).select('_id activeOrganizationId');
    const allowed = await isAllowedToShareWith(caller, recipient._id);
    if (!allowed) {
      return res.status(403).json({
        error: 'You can only share with users in your Collaboration list.',
      });
    }

    const access = await SharedDataRoomAccess.findOneAndUpdate(
      { sharedDataRoomId: shared._id, userId: recipient._id },
      {
        sharedDataRoomId: shared._id,
        userId: recipient._id,
        permission: permission || 'viewer',
        grantedBy: req.user.userId,
        status: 'active',
      },
      { upsert: true, new: true }
    );

    // In-app notification
    const sharer = await User.findById(req.user.userId).select('name');
    await Notification.create({
      userId: recipient._id,
      type: 'dataroom_shared',
      data: {
        fromUserId: req.user.userId,
        fromUserName: sharer ? sharer.name : 'Someone',
        shareId: shared._id,
        dataRoomName: shared.sourceDataroomName,
      },
    });

    // Send notification email
    try {
      const emailService = require('../services/emailService');
      await emailService.sendDataRoomSharedEmail({
        to: recipient.email,
        sharerName: sharer ? sharer.name : 'A collaborator',
        dataRoomName: shared.sourceDataroomName,
      });
    } catch (emailErr) {
      logger.warn(`Failed to send sharing notification email: ${emailErr.message}`);
    }

    res.json({ access });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/sharing/datarooms/:shareId/access/:userId
 * Revoke user access.
 */
async function revokeAccess(req, res, next) {
  try {
    const shared = await SharedDataRoom.findOne({
      _id: req.params.shareId,
      ownerId: req.user.userId,
      isDeleted: false,
    });
    if (!shared) return res.status(404).json({ error: 'Not found' });

    const access = await SharedDataRoomAccess.findOneAndUpdate(
      {
        sharedDataRoomId: shared._id,
        userId: req.params.userId,
        status: 'active',
      },
      { status: 'revoked' },
      { new: true }
    );

    if (!access) return res.status(404).json({ error: 'Access record not found' });

    // Audit log: access revoked
    const revoker = await User.findById(req.user.userId).select('name email activeOrganizationId');
    if (revoker) {
      await logAudit({
        userId: req.user.userId,
        userName: revoker.name,
        userEmail: revoker.email,
        organizationId: revoker.activeOrganizationId || null,
        action: 'dataroom.share_revoked',
        resourceType: 'dataroom',
        resourceId: shared._id.toString(),
        resourceName: shared.sourceDataroomName,
        metadata: { revokedUserId: req.params.userId },
        ipAddress: req.ip,
      });
    }

    res.json({ message: 'Access revoked', access });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/sharing/datarooms/:shareId/access
 * List who has access to a shared DataRoom.
 */
async function listAccess(req, res, next) {
  try {
    const shared = await SharedDataRoom.findOne({
      _id: req.params.shareId,
      ownerId: req.user.userId,
      isDeleted: false,
    });
    if (!shared) return res.status(404).json({ error: 'Not found' });

    const accesses = await SharedDataRoomAccess.find({
      sharedDataRoomId: shared._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with user info
    const userIds = accesses.map(a => a.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('name email profilePicture').lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const result = accesses.map(a => ({
      ...a,
      user: userMap[a.userId.toString()] || null,
    }));

    res.json({ accesses: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/sharing/my-shares
 * List DataRooms the current user has shared.
 */
async function listMyShares(req, res, next) {
  try {
    const shares = await SharedDataRoom.find({
      ownerId: req.user.userId,
      isDeleted: false,
    })
      .select('-files -folderTree') // Light response
      .sort({ updatedAt: -1 })
      .lean();

    // For each share, get recipient count
    const result = await Promise.all(shares.map(async (share) => {
      const recipientCount = await SharedDataRoomAccess.countDocuments({
        sharedDataRoomId: share._id,
        status: 'active',
      });
      return { ...share, recipientCount };
    }));

    res.json({ shares: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/sharing/received
 * List DataRooms shared with the current user.
 */
async function listReceived(req, res, next) {
  try {
    const accesses = await SharedDataRoomAccess.find({
      userId: req.user.userId,
      status: 'active',
    }).sort({ createdAt: -1 });

    const shareIds = accesses.map(a => a.sharedDataRoomId);
    const sharedDataRooms = await SharedDataRoom.find({
      _id: { $in: shareIds },
      isDeleted: false,
    }).select('-files -folderTree'); // Light response for listing

    // Merge with access info
    const result = sharedDataRooms.map(sdr => {
      const access = accesses.find(a => a.sharedDataRoomId.toString() === sdr._id.toString());
      return {
        ...sdr.toObject(),
        permission: access.permission,
        hasUpdate: sdr.snapshotVersion > (access.lastViewedVersion || 0),
      };
    });

    res.json({ received: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/sharing/received/:shareId
 * Get full shared DataRoom data (including files and folder tree).
 */
async function getSharedDataRoom(req, res, next) {
  try {
    // Verify access
    const access = await SharedDataRoomAccess.findOne({
      sharedDataRoomId: req.params.shareId,
      userId: req.user.userId,
      status: 'active',
    });
    if (!access) return res.status(403).json({ error: 'Access denied' });

    const shared = await SharedDataRoom.findOne({
      _id: req.params.shareId,
      isDeleted: false,
    });
    if (!shared) return res.status(404).json({ error: 'Not found' });

    // Update last viewed version
    access.lastViewedVersion = shared.snapshotVersion;
    await access.save();

    // Audit log: shared DataRoom accessed
    const accessor = await User.findById(req.user.userId).select('name email activeOrganizationId');
    if (accessor) {
      await logAudit({
        userId: req.user.userId,
        userName: accessor.name,
        userEmail: accessor.email,
        organizationId: accessor.activeOrganizationId || null,
        action: 'dataroom.accessed',
        resourceType: 'dataroom',
        resourceId: shared._id.toString(),
        resourceName: shared.sourceDataroomName,
        metadata: {},
        ipAddress: req.ip,
      });
    }

    res.json({ sharedDataRoom: shared });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/sharing/users/search?q=...
 * Share-time directory: returns the caller's collaboration set (same-org
 * members + accepted collaborators), optionally filtered by a substring
 * of name or email. Empty query returns the full set so ShareDialog can
 * show options without requiring typing.
 */
async function searchUsers(req, res, next) {
  try {
    const currentUser = await User.findById(req.user.userId).select('_id activeOrganizationId');
    if (!currentUser) return res.json({ users: [] });

    const map = new Map(); // userId -> user

    // Org members (implicit collaborators)
    if (currentUser.activeOrganizationId) {
      const members = await OrganizationMember.find({
        organizationId: currentUser.activeOrganizationId,
        status: 'active',
        userId: { $ne: req.user.userId },
      }).populate('userId', 'name email profilePicture');

      for (const m of members) {
        if (!m.userId) continue;
        map.set(String(m.userId._id), {
          _id: m.userId._id,
          name: m.userId.name,
          email: m.userId.email,
          profilePicture: m.userId.profilePicture,
          isOrgMember: true,
        });
      }
    }

    // Accepted collaborations
    const collabs = await Collaboration.find({
      status: 'accepted',
      $or: [{ userA: currentUser._id }, { userB: currentUser._id }],
    });
    const partnerIds = collabs.map((c) =>
      String(c.userA) === String(currentUser._id) ? c.userB : c.userA,
    );
    const partners = await User.find({ _id: { $in: partnerIds } })
      .select('name email profilePicture')
      .lean();

    for (const p of partners) {
      const key = String(p._id);
      if (map.has(key)) continue;
      map.set(key, {
        _id: p._id,
        name: p.name,
        email: p.email,
        profilePicture: p.profilePicture,
        isOrgMember: false,
      });
    }

    let users = Array.from(map.values());

    const { q } = req.query;
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const needle = q.trim().toLowerCase();
      users = users.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(needle)) ||
          (u.email && u.email.toLowerCase().includes(needle)),
      );
    }

    res.json({ users });
  } catch (error) {
    next(error);
  }
}

/**
 * Count folders recursively in a nested folder tree.
 */
function countFolders(folderTree) {
  if (!folderTree || !Array.isArray(folderTree)) return 0;
  return folderTree.reduce((count, folder) => {
    return count + 1 + countFolders(folder.children);
  }, 0);
}

module.exports = {
  createSharedDataRoom,
  updateSharedDataRoom,
  deleteSharedDataRoom,
  grantAccess,
  revokeAccess,
  listAccess,
  listMyShares,
  listReceived,
  getSharedDataRoom,
  searchUsers,
};
