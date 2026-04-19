'use strict';

const Notification = require('../models/Notification');
const logger = require('./logger');

// userId (string) → Set<res>
const subscribers = new Map();

const HEARTBEAT_MS = 25 * 1000;

function subscribe(userId, res) {
  const key = String(userId);
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(res);

  const cleanup = () => {
    const s = subscribers.get(key);
    if (!s) return;
    s.delete(res);
    if (s.size === 0) subscribers.delete(key);
  };
  res.on('close', cleanup);
  res.on('error', cleanup);
}

function publish(userId, payload) {
  const set = subscribers.get(String(userId));
  if (!set || set.size === 0) return;
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(frame);
    } catch (err) {
      logger.warn(`notificationStream: write failed — ${err.message}`);
    }
  }
}

async function createNotification(docData) {
  const doc = await Notification.create(docData);
  publish(doc.userId, doc.toJSON());
  return doc;
}

// Keep-alive comment frame so intermediaries don't close idle connections.
setInterval(() => {
  for (const set of subscribers.values()) {
    for (const res of set) {
      try { res.write(': ping\n\n'); } catch { /* cleanup fires separately */ }
    }
  }
}, HEARTBEAT_MS).unref();

module.exports = { subscribe, publish, createNotification };
