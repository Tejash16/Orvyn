const SharedDataRoom = require('../models/SharedDataRoom');
const SharedDataRoomAccess = require('../models/SharedDataRoomAccess');
const User = require('../models/User');
const logger = require('../services/logger');

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

    // Check external sharing restriction for enterprise users
    if (user.activeOrganizationId) {
      const Organization = require('../models/Organization');
      const OrganizationMember = require('../models/OrganizationMember');
      const org = await Organization.findById(user.activeOrganizationId);

      if (recipientEmail && org && !org.allowExternalSharing) {
        const recipient = await User.findOne({ email: recipientEmail.toLowerCase(), isDeleted: false });
        if (recipient) {
          const recipientMembership = await OrganizationMember.findOne({
            organizationId: user.activeOrganizationId,
            userId: recipient._id,
            status: 'active',
          });
          if (!recipientMembership) {
            return res.status(403).json({
              error: 'Your organization does not allow sharing with external users',
            });
          }
        }
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

    // Grant access to recipient if email provided
    if (recipientEmail) {
      const recipient = await User.findOne({ email: recipientEmail.toLowerCase(), isDeleted: false });
      if (recipient) {
        await SharedDataRoomAccess.create({
          sharedDataRoomId: shared._id,
          userId: recipient._id,
          permission: 'viewer',
          grantedBy: req.user.userId,
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
      } else {
        logger.info(`Recipient ${recipientEmail} not found for sharing`);
      }
    }

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

    // Send notification email
    try {
      const user = await User.findById(req.user.userId);
      const emailService = require('../services/emailService');
      await emailService.sendDataRoomSharedEmail({
        to: recipient.email,
        sharerName: user.name,
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

    res.json({ sharedDataRoom: shared });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/sharing/users/search?q=...
 * Search users for sharing.
 * - Individual users: exact email match only
 * - Enterprise users: can search within org by name or email
 */
async function searchUsers(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || q.length < 3) return res.json({ users: [] });

    const currentUser = await User.findById(req.user.userId);
    let users = [];

    if (currentUser.activeOrganizationId) {
      // Enterprise: search within organization
      const OrganizationMember = require('../models/OrganizationMember');
      const members = await OrganizationMember.find({
        organizationId: currentUser.activeOrganizationId,
        status: 'active',
        userId: { $ne: req.user.userId },
      }).populate('userId', 'name email profilePicture');

      users = members
        .filter(m => {
          const u = m.userId;
          if (!u) return false;
          return u.name.toLowerCase().includes(q.toLowerCase()) ||
                 u.email.toLowerCase().includes(q.toLowerCase());
        })
        .map(m => ({
          _id: m.userId._id,
          name: m.userId.name,
          email: m.userId.email,
          profilePicture: m.userId.profilePicture,
          isOrgMember: true,
        }));
    }

    // Also search by exact email for cross-org or individual sharing
    if (q.includes('@')) {
      const exactMatch = await User.findOne({
        email: q.toLowerCase(),
        isDeleted: false,
        _id: { $ne: req.user.userId },
      }).select('name email profilePicture');

      if (exactMatch && !users.find(u => u._id.toString() === exactMatch._id.toString())) {
        users.push({
          _id: exactMatch._id,
          name: exactMatch.name,
          email: exactMatch.email,
          profilePicture: exactMatch.profilePicture,
          isOrgMember: false,
        });
      }
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
