'use strict';

const Notification = require('../models/Notification');

/**
 * GET /api/v1/notifications?unread=true&since=<iso>&limit=50
 * Incremental fetch. If `since` is provided, returns items created after
 * that timestamp. Always returns unread count for badge display.
 */
async function listNotifications(req, res, next) {
  try {
    const me = req.user.userId;
    const { unread, since, limit = 50 } = req.query;

    const query = { userId: me };
    if (unread === 'true') query.read = false;
    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        query.createdAt = { $gt: sinceDate };
      }
    }

    const items = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200))
      .lean();

    const unreadCount = await Notification.countDocuments({ userId: me, read: false });

    return res.status(200).json({ success: true, notifications: items, unreadCount });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/notifications/:id/read
 */
async function markRead(req, res, next) {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: { read: true } },
      { new: true },
    );
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Not found.' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/notifications/read-all
 */
async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { $set: { read: true } },
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listNotifications, markRead, markAllRead };
