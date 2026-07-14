'use strict';

const nodemailer = require('nodemailer');
const logger     = require('./logger');
const {
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  organizationInviteTemplate,
  paymentSuccessTemplate,
  paymentFailureTemplate,
  dataRoomSharedTemplate,
  collaborationInviteTemplate,
} = require('./emailTemplates');

// ── Transporter (lazy singleton) ──────────────────────────

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host   = process.env.SMTP_HOST;
  const user   = process.env.SMTP_USER;
  const pass   = process.env.SMTP_PASS;
  const port   = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) return null; // dev fallback

  _transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return _transporter;
}

// ── Core send function ────────────────────────────────────

async function sendEmail({ to, subject, text, html, attachments }) {
  const transporter = getTransporter();
  if (!transporter) {
    // Dev fallback — log to file only, never expose credentials
    logger.info(`[DEV EMAIL] To: ${to} | Subject: ${subject} | ${text}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
    attachments,
  });
}

// ── Organization invite email ─────────────────────────────

async function sendOrganizationInviteEmail({ to, orgName, inviterName, inviteCode, role, expiresAt, inviteUrl }) {
  const { html, text } = organizationInviteTemplate({
    orgName,
    inviterName,
    inviteCode,
    role,
    expiresAt,
    inviteUrl,
  });
  await sendEmail({
    to,
    subject: `You're invited to join ${orgName} on Orvyn`,
    text,
    html,
  });
  logger.info(`Invite email sent to ${to} for org "${orgName}"`);
}

// ── Payment success email ─────────────────────────────────

async function sendPaymentSuccessEmail({ to, userName, plan, amount, currency, paymentId, invoiceUrl, billingPeriod }) {
  const { html, text } = paymentSuccessTemplate({
    userName,
    plan,
    amount,
    currency,
    paymentId,
    invoiceUrl,
    billingPeriod,
  });
  await sendEmail({
    to,
    subject: `Payment received — Orvyn ${plan === 'pro' ? 'Pro' : 'Enterprise'}`,
    text,
    html,
  });
  logger.info(`Payment success email sent to ${to}, paymentId: ${paymentId}`);
}

// ── Payment failure email ─────────────────────────────────

async function sendPaymentFailureEmail({ to, userName, plan, amount, currency, reason, retryUrl }) {
  const { html, text } = paymentFailureTemplate({
    userName,
    plan,
    amount,
    currency,
    reason,
    retryUrl,
  });
  await sendEmail({
    to,
    subject: `Payment failed — Orvyn ${plan === 'pro' ? 'Pro' : 'Enterprise'}`,
    text,
    html,
  });
  logger.info(`Payment failure email sent to ${to}`);
}

// ── DataRoom shared notification ──────────────────────────

async function sendDataRoomSharedEmail({ to, sharerName, dataRoomName }) {
  const { html, text } = dataRoomSharedTemplate({ sharerName, dataRoomName });
  await sendEmail({
    to,
    subject: `${sharerName} shared a DataRoom with you on Orvyn`,
    text,
    html,
  });
}

// ── Collaboration invite email ────────────────────────────

async function sendCollaborationInviteEmail({ to, fromUserName }) {
  const { html, text } = collaborationInviteTemplate({ fromUserName });
  await sendEmail({
    to,
    subject: `${fromUserName} invited you to collaborate on Orvyn`,
    text,
    html,
  });
  logger.info(`Collaboration invite email sent to ${to}`);
}

module.exports = {
  sendEmail,
  sendOrganizationInviteEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailureEmail,
  sendDataRoomSharedEmail,
  sendCollaborationInviteEmail,
};
