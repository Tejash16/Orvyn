'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const UserUsage = require('../models/UserUsage');
const UserLimits = require('../models/UserLimits');
const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const AuditLog = require('../models/AuditLog');
const PromoCode = require('../models/PromoCode');
const SharedDataRoom = require('../models/SharedDataRoom');
const SharedDataRoomAccess = require('../models/SharedDataRoomAccess');
const Collaboration = require('../models/Collaboration');
const Notification = require('../models/Notification');
const { logAudit } = require('../services/auditService');
const { requestPasswordReset, hardDeleteUser } = require('../services/authService');
const { publish } = require('../services/notificationStream');
const logger = require('../services/logger');

// ── Auth ──────────────────────────────────────────────────

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false })
    .select('+password +role');
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const secret = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET;
  const token = jwt.sign({ userId: user._id, role: 'admin' }, secret, { expiresIn: '2h' });

  res.json({ success: true, token, user: { name: user.name, email: user.email } });
};

// ── Dashboard ─────────────────────────────────────────────

exports.dashboardStats = async (req, res) => {
  const [
    totalUsers,
    activeSubscriptions,
    totalOrganizations,
    subscriptionsByPlan,
    recentSignups,
    activePromoCodes,
    totalFilesAgg,
    totalMessagesAgg,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    Subscription.countDocuments({ status: 'active' }),
    Organization.countDocuments({ isDeleted: false }),
    Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]),
    User.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(10).select('name email createdAt').lean(),
    PromoCode.countDocuments({ isActive: true }),
    UserUsage.aggregate([{ $group: { _id: null, total: { $sum: '$filesUploadedThisPeriod' } } }]),
    UserUsage.aggregate([{ $group: { _id: null, total: { $sum: '$messagesToday' } } }]),
  ]);

  res.json({
    totalUsers,
    activeSubscriptions,
    totalOrganizations,
    subscriptionsByPlan,
    recentSignups,
    activePromoCodes,
    totalFilesThisPeriod: totalFilesAgg[0]?.total || 0,
    totalMessagesToday: totalMessagesAgg[0]?.total || 0,
  });
};

// ── Users ─────────────────────────────────────────────────

exports.listUsers = async (req, res) => {
  const { q, page = 1, limit = 20, status } = req.query;
  const filter = { isDeleted: false };
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ];
  }
  if (status) filter.restrictionStatus = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    users,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
  });
};

exports.getUserDetail = async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user || user.isDeleted) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const [usage, limits, organizations, recentAuditLogs] = await Promise.all([
    UserUsage.findOne({ userId: user._id }).lean(),
    UserLimits.findOne({ userId: user._id }).lean(),
    OrganizationMember.find({ userId: user._id, status: 'active' }).lean(),
    AuditLog.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  // Resolve org names
  if (organizations.length > 0) {
    const orgIds = organizations.map((o) => o.organizationId);
    const orgs = await Organization.find({ _id: { $in: orgIds } }).select('name').lean();
    const orgMap = Object.fromEntries(orgs.map((o) => [o._id.toString(), o.name]));
    organizations.forEach((o) => {
      o.organizationName = orgMap[o.organizationId.toString()] || 'Unknown';
    });
  }

  res.json({ ...user, usage, limits, organizations, recentAuditLogs });
};

exports.suspendUser = async (req, res) => {
  const { reason, until } = req.body;
  await User.updateOne({ _id: req.params.id }, {
    restrictionStatus: 'suspended',
    restrictionReason: reason || 'Admin action',
    restrictedUntil: until ? new Date(until) : null,
    restrictedBy: req.admin.userId,
  });
  logAudit({
    userId: req.admin.userId, userName: req.admin.name, userEmail: req.admin.email,
    action: 'admin.user_suspended', resourceType: 'user', resourceId: req.params.id,
    metadata: { reason, until },
  });
  res.json({ success: true });
};

exports.unsuspendUser = async (req, res) => {
  await User.updateOne({ _id: req.params.id }, {
    restrictionStatus: 'active',
    restrictionReason: null,
    restrictedUntil: null,
    restrictedBy: null,
  });
  logAudit({
    userId: req.admin.userId, userName: req.admin.name, userEmail: req.admin.email,
    action: 'admin.user_unsuspended', resourceType: 'user', resourceId: req.params.id,
  });
  res.json({ success: true });
};

exports.banUser = async (req, res) => {
  const { reason } = req.body;
  await User.updateOne({ _id: req.params.id }, {
    restrictionStatus: 'banned',
    restrictionReason: reason || 'Admin ban',
    restrictedUntil: null,
    restrictedBy: req.admin.userId,
  });
  logAudit({
    userId: req.admin.userId, userName: req.admin.name, userEmail: req.admin.email,
    action: 'admin.user_banned', resourceType: 'user', resourceId: req.params.id,
    metadata: { reason },
  });
  res.json({ success: true });
};

exports.deleteUser = async (req, res) => {
  try {
    await hardDeleteUser(req.params.id);
    logAudit({
      userId: req.admin.userId, userName: req.admin.name, userEmail: req.admin.email,
      action: 'admin.user_deleted', resourceType: 'user', resourceId: req.params.id,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.resetUserPassword = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  try {
    await requestPasswordReset(user.email);
    res.json({ success: true, message: 'Password reset email sent.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateUserLimits = async (req, res) => {
  const { monthlyFileLimit, dailyMessageLimit, dataroomLimit } = req.body;
  const update = { isCustomOverride: true };
  if (monthlyFileLimit !== undefined) update.monthlyFileLimit = monthlyFileLimit;
  if (dailyMessageLimit !== undefined) update.dailyMessageLimit = dailyMessageLimit;
  if (dataroomLimit !== undefined) update.dataroomLimit = dataroomLimit;

  await UserLimits.updateOne(
    { userId: req.params.id },
    { $set: update },
    { upsert: true }
  );

  logAudit({
    userId: req.admin.userId, userName: req.admin.name, userEmail: req.admin.email,
    action: 'admin.limits_overridden', resourceType: 'user', resourceId: req.params.id,
    metadata: { monthlyFileLimit, dailyMessageLimit, dataroomLimit },
  });
  res.json({ success: true });
};

// ── Promo Codes ───────────────────────────────────────────

exports.listPromoCodes = async (req, res) => {
  const promoCodes = await PromoCode.find().sort({ createdAt: -1 }).lean();
  res.json({ promoCodes });
};

exports.createPromoCode = async (req, res) => {
  const { code, description, discountType, discountValue, applicablePlans, maxRedemptions, validUntil } = req.body;
  if (!code || !discountType || discountValue === undefined) {
    return res.status(400).json({ error: 'Code, discountType, and discountValue are required.' });
  }

  const existing = await PromoCode.findOne({ code: code.toUpperCase() });
  if (existing) {
    return res.status(409).json({ error: 'A promo code with this name already exists.' });
  }

  const promo = await PromoCode.create({
    code: code.toUpperCase(),
    description,
    discountType,
    discountValue,
    applicablePlans: applicablePlans || ['pro'],
    maxRedemptions: maxRedemptions || null,
    validUntil: validUntil || null,
    createdBy: req.admin.userId,
  });

  logAudit({
    userId: req.admin.userId, userName: req.admin.name, userEmail: req.admin.email,
    action: 'admin.promo_code_created', resourceType: 'user', resourceId: promo._id.toString(),
    resourceName: promo.code,
  });
  res.status(201).json({ success: true, promoCode: promo });
};

exports.deactivatePromoCode = async (req, res) => {
  const promo = await PromoCode.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!promo) return res.status(404).json({ error: 'Promo code not found.' });

  logAudit({
    userId: req.admin.userId, userName: req.admin.name, userEmail: req.admin.email,
    action: 'admin.promo_code_deactivated', resourceType: 'user', resourceId: promo._id.toString(),
    resourceName: promo.code,
  });
  res.json({ success: true });
};

// ── Subscriptions ─────────────────────────────────────────

exports.listSubscriptions = async (req, res) => {
  const { page = 1, limit = 20, status, plan } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (plan) filter.plan = plan;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [subscriptions, total] = await Promise.all([
    Subscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    Subscription.countDocuments(filter),
  ]);

  // Resolve user info
  const userIds = subscriptions.map((s) => s.userId).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  subscriptions.forEach((s) => {
    if (s.userId) {
      const u = userMap[s.userId.toString()];
      s.userName = u?.name || 'Unknown';
      s.userEmail = u?.email || 'Unknown';
    }
  });

  res.json({
    subscriptions,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
  });
};

// ── Organizations ─────────────────────────────────────────

exports.listOrganizations = async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  const filter = { isDeleted: false };
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [organizations, total] = await Promise.all([
    Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    Organization.countDocuments(filter),
  ]);

  // Get member counts
  const orgIds = organizations.map((o) => o._id);
  const memberCounts = await OrganizationMember.aggregate([
    { $match: { organizationId: { $in: orgIds }, status: 'active' } },
    { $group: { _id: '$organizationId', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(memberCounts.map((m) => [m._id.toString(), m.count]));
  organizations.forEach((o) => { o.memberCount = countMap[o._id.toString()] || 0; });

  res.json({
    organizations,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
  });
};

exports.getOrganizationDetail = async (req, res) => {
  const org = await Organization.findById(req.params.id).lean();
  if (!org || org.isDeleted) return res.status(404).json({ error: 'Organization not found.' });

  const members = await OrganizationMember.find({ organizationId: org._id }).lean();

  // Resolve member names
  const memberUserIds = members.map((m) => m.userId);
  const users = await User.find({ _id: { $in: memberUserIds } }).select('name email').lean();
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));
  members.forEach((m) => {
    const u = userMap[m.userId.toString()];
    m.userName = u?.name || 'Unknown';
    m.userEmail = u?.email || 'Unknown';
  });

  res.json({ ...org, members });
};

exports.updateOrgSeats = async (req, res) => {
  const { maxSeats } = req.body;
  if (maxSeats === undefined) return res.status(400).json({ error: 'maxSeats is required.' });

  await Organization.updateOne({ _id: req.params.id }, { maxSeats });
  res.json({ success: true });
};

// ── Audit Logs ────────────────────────────────────────────

exports.listAuditLogs = async (req, res) => {
  const { page = 1, limit = 30, action, q } = req.query;
  const filter = {};
  if (action) filter.action = action;
  if (q) {
    filter.$or = [
      { userName: { $regex: q, $options: 'i' } },
      { userEmail: { $regex: q, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    logs,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
  });
};

// ── Database Browser ──────────────────────────────────────

const BROWSABLE_COLLECTIONS = [
  'users', 'organizations', 'organizationmembers', 'organizationinvites',
  'subscriptions', 'userusages', 'userlimits', 'auditlogs', 'promocodes',
  'shareddatarooms', 'shareddataroomaccesses', 'collaborations',
  'collaborationinvites', 'notifications', 'idempotencykeys',
  'pendingregistrations',
];

exports.listCollections = async (req, res) => {
  res.json({ collections: BROWSABLE_COLLECTIONS });
};

exports.browseCollection = async (req, res) => {
  const { collection } = req.params;
  if (!BROWSABLE_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: 'Collection not available for browsing.' });
  }

  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const db = mongoose.connection.db;
  const col = db.collection(collection);
  const [documents, total] = await Promise.all([
    col.find({}).sort({ _id: -1 }).skip(skip).limit(parseInt(limit)).toArray(),
    col.countDocuments(),
  ]);

  res.json({
    documents,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
  });
};

// ── Collaborations ────────────────────────────────────────

exports.listCollaborations = async (req, res) => {
  const collabs = await Collaboration.find().sort({ createdAt: -1 }).limit(200).lean();

  // Resolve user names
  const userIds = [...new Set(collabs.flatMap((c) => [c.userA?.toString(), c.userB?.toString()]).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  collabs.forEach((c) => {
    const a = userMap[c.userA?.toString()];
    const b = userMap[c.userB?.toString()];
    c.userAName = a?.name || 'Unknown';
    c.userAEmail = a?.email || 'Unknown';
    c.userBName = b?.name || 'Unknown';
    c.userBEmail = b?.email || 'Unknown';
  });

  res.json({ collaborations: collabs });
};

exports.breakCollaboration = async (req, res) => {
  const collab = await Collaboration.findByIdAndDelete(req.params.id);
  if (!collab) return res.status(404).json({ error: 'Collaboration not found.' });

  logAudit({
    userId: req.admin.userId, userName: req.admin.name, userEmail: req.admin.email,
    action: 'admin.collaboration_broken', resourceType: 'user', resourceId: collab._id.toString(),
    metadata: { userA: collab.userA, userB: collab.userB },
  });
  res.json({ success: true });
};

// ── Notifications ─────────────────────────────────────────

exports.broadcastNotification = async (req, res) => {
  const { type, message, targetUserIds } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  let recipients;
  if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
    recipients = targetUserIds;
  } else {
    // Broadcast to all active users
    const users = await User.find({ isDeleted: false, restrictionStatus: 'active' }).select('_id').lean();
    recipients = users.map((u) => u._id);
  }

  const notifications = recipients.map((userId) => ({
    userId,
    type: type || 'system',
    data: { message, broadcastedBy: req.admin.name },
    read: false,
  }));

  const inserted = await Notification.insertMany(notifications);

  for (const notif of inserted) {
    publish(notif.userId, notif);
  }

  logAudit({
    userId: req.admin.userId, userName: req.admin.name, userEmail: req.admin.email,
    action: 'admin.notification_broadcast', resourceType: 'user',
    resourceId: 'broadcast',
    metadata: { type, recipientCount: recipients.length, targeted: !!targetUserIds },
  });

  res.json({ success: true, recipientCount: recipients.length });
};

// ── System Health ─────────────────────────────────────────

exports.systemHealth = async (req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;
  let dbStats = null;
  if (mongoConnected) {
    try {
      dbStats = await mongoose.connection.db.stats();
    } catch {}
  }

  res.json({
    uptime: process.uptime(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    mongodb: {
      connected: mongoConnected,
      dbStats: dbStats ? {
        collections: dbStats.collections,
        objects: dbStats.objects,
        storageSize: dbStats.storageSize,
      } : null,
    },
  });
};

// ── Export ─────────────────────────────────────────────────

exports.exportData = async (req, res) => {
  const { type } = req.params;

  let data, headers;

  switch (type) {
    case 'users': {
      data = await User.find({ isDeleted: false }).select('name email provider userType restrictionStatus createdAt').lean();
      headers = ['_id', 'name', 'email', 'provider', 'userType', 'restrictionStatus', 'createdAt'];
      break;
    }
    case 'usage': {
      data = await UserUsage.find().lean();
      headers = ['userId', 'filesUploadedThisPeriod', 'filePeriodStart', 'messagesToday', 'messageDayStart'];
      break;
    }
    case 'subscriptions': {
      data = await Subscription.find().lean();
      headers = ['_id', 'userId', 'organizationId', 'plan', 'status', 'currentPeriodEnd', 'createdAt'];
      break;
    }
    case 'audit-logs': {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      data = await AuditLog.find({ createdAt: { $gte: ninetyDaysAgo } }).sort({ createdAt: -1 }).lean();
      headers = ['_id', 'userId', 'userName', 'userEmail', 'action', 'resourceType', 'resourceId', 'createdAt'];
      break;
    }
    case 'organizations': {
      data = await Organization.find({ isDeleted: false }).lean();
      headers = ['_id', 'name', 'slug', 'plan', 'maxSeats', 'subscriptionStatus', 'createdAt'];
      break;
    }
    default:
      return res.status(400).json({ error: 'Invalid export type.' });
  }

  // Convert to CSV
  const csvRows = [headers.join(',')];
  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape CSV values
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(values.join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=orvyn-${type}-${new Date().toISOString().split('T')[0]}.csv`);
  res.send(csvRows.join('\n'));
};

// ── Shared DataRooms ──────────────────────────────────────

exports.listSharedDataRooms = async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  const filter = { isDeleted: { $ne: true } };
  if (q) {
    filter.$or = [
      { sourceDataroomName: { $regex: q, $options: 'i' } },
      { ownerName: { $regex: q, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [rooms, total] = await Promise.all([
    SharedDataRoom.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('sourceDataroomName ownerName ownerId fileCount folderCount snapshotVersion createdAt')
      .lean(),
    SharedDataRoom.countDocuments(filter),
  ]);

  // Get access counts
  const roomIds = rooms.map((r) => r._id);
  const accessCounts = await SharedDataRoomAccess.aggregate([
    { $match: { sharedDataRoomId: { $in: roomIds }, status: 'active' } },
    { $group: { _id: '$sharedDataRoomId', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(accessCounts.map((a) => [a._id.toString(), a.count]));
  rooms.forEach((r) => { r.accessCount = countMap[r._id.toString()] || 0; });

  // Resolve owner emails
  const ownerIds = [...new Set(rooms.map((r) => r.ownerId?.toString()).filter(Boolean))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select('email').lean();
  const ownerMap = Object.fromEntries(owners.map((o) => [o._id.toString(), o.email]));
  rooms.forEach((r) => { r.ownerEmail = ownerMap[r.ownerId?.toString()] || 'Unknown'; });

  res.json({
    sharedDataRooms: rooms,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
  });
};
