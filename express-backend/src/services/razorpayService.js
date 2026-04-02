'use strict';

const Razorpay      = require('razorpay');
const crypto        = require('crypto');
const Subscription  = require('../models/Subscription');
const UserLimits    = require('../models/UserLimits');
const { PLAN_LIMITS } = require('../config/planLimits');
const logger        = require('./logger');
const { logAudit }  = require('./auditService');

// ── Razorpay SDK instance (lazy) ──────────────────────────

let _razorpay = null;

function getRazorpay() {
  if (_razorpay) return _razorpay;
  _razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return _razorpay;
}

// ── Create subscriptions ──────────────────────────────────

/**
 * Create a Razorpay subscription for an individual user (Pro plan).
 *
 * @param {string} userId
 * @param {string} userEmail
 * @param {string} userName
 * @returns {{ subscriptionId: string, shortUrl: string }}
 */
async function createIndividualSubscription(userId, userEmail, userName) {
  const razorpay = getRazorpay();

  // Create or retrieve Razorpay customer
  const customer = await razorpay.customers.create({
    name: userName,
    email: userEmail,
  });

  // Create subscription on Razorpay
  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID_PRO,
    customer_id: customer.id,
    total_count: 12, // 12 billing cycles
    customer_notify: 1,
  });

  // Store in MongoDB
  await Subscription.create({
    userId,
    plan: 'pro',
    status: 'trialing',
    razorpaySubscriptionId: subscription.id,
    razorpayCustomerId: customer.id,
  });

  logger.info(`Created Pro subscription for user ${userId}: ${subscription.id}`);

  return {
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url, // Razorpay-hosted checkout page
  };
}

/**
 * Create a Razorpay subscription for an organization (Enterprise plan).
 *
 * @param {string} organizationId
 * @param {number} seats
 * @param {string} adminEmail
 * @param {string} orgName
 * @returns {{ subscriptionId: string, shortUrl: string }}
 */
async function createEnterpriseSubscription(organizationId, seats, adminEmail, orgName) {
  const razorpay = getRazorpay();

  const customer = await razorpay.customers.create({
    name: orgName,
    email: adminEmail,
  });

  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID_ENTERPRISE,
    customer_id: customer.id,
    quantity: seats,
    total_count: 12,
    customer_notify: 1,
  });

  await Subscription.create({
    organizationId,
    plan: 'enterprise',
    status: 'trialing',
    razorpaySubscriptionId: subscription.id,
    razorpayCustomerId: customer.id,
    seats,
  });

  logger.info(`Created Enterprise subscription for org ${organizationId}: ${subscription.id}`);

  return {
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url,
  };
}

// ── Webhook verification ──────────────────────────────────

/**
 * Verify Razorpay webhook signature using HMAC-SHA256.
 *
 * @param {string} body   - Raw request body string
 * @param {string} signature - x-razorpay-signature header
 * @returns {boolean}
 */
function verifyWebhookSignature(body, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

// ── Webhook event handler ─────────────────────────────────

/**
 * Handle Razorpay webhook events.
 * Sends email notifications for payment success/failure via emailService.
 *
 * @param {string} event   - Razorpay event name
 * @param {Object} payload - Event payload
 */
async function handleWebhookEvent(event, payload) {
  const subscriptionEntity = payload.subscription?.entity;
  const paymentEntity      = payload.payment?.entity;
  const subscriptionId     = subscriptionEntity?.id || paymentEntity?.subscription_id;
  const emailService       = require('./emailService');

  switch (event) {
    case 'subscription.activated': {
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
      if (sub) {
        sub.status = 'active';
        sub.currentPeriodStart = new Date();
        sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await sub.save();
        await updateUserLimits(sub);
        logger.info(`Subscription activated: ${subscriptionId}`);
      }
      break;
    }

    case 'subscription.charged': {
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
      if (sub) {
        sub.status = 'active';
        sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await sub.save();

        // Send payment success email with receipt
        const { email, userName } = await getSubscriptionOwnerDetails(sub);
        if (email) {
          const invoiceId = paymentEntity?.invoice_id;
          let invoiceUrl = null;
          if (invoiceId) {
            try {
              const razorpay = getRazorpay();
              const invoice = await razorpay.invoices.fetch(invoiceId);
              invoiceUrl = invoice.short_url;
            } catch (e) {
              logger.warn(`Could not fetch invoice ${invoiceId}: ${e.message}`);
            }
          }

          await emailService.sendPaymentSuccessEmail({
            to: email,
            userName,
            plan: sub.plan,
            amount: paymentEntity?.amount || 0,
            currency: paymentEntity?.currency || 'INR',
            paymentId: paymentEntity?.id || 'N/A',
            invoiceUrl,
            billingPeriod: `${sub.currentPeriodStart?.toLocaleDateString('en-IN')} – ${sub.currentPeriodEnd?.toLocaleDateString('en-IN')}`,
          });
        }
        logger.info(`Subscription charged: ${subscriptionId}`);

        // Audit log: payment success
        if (email) {
          await logAudit({
            userId: sub.userId || null,
            userName: userName,
            userEmail: email,
            organizationId: sub.organizationId || null,
            action: 'billing.payment_success',
            resourceType: 'subscription',
            resourceId: sub._id.toString(),
            metadata: { paymentId: paymentEntity?.id, amount: paymentEntity?.amount },
          });
        }
      }
      break;
    }

    case 'subscription.cancelled': {
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
      if (sub) {
        sub.status = 'cancelled';
        sub.cancelledAt = new Date();
        await sub.save();
        await downgradeToFree(sub);

        // Audit log: subscription cancelled
        const { email: cancelEmail, userName: cancelName } = await getSubscriptionOwnerDetails(sub);
        if (cancelEmail) {
          await logAudit({
            userId: sub.userId || null,
            userName: cancelName,
            userEmail: cancelEmail,
            organizationId: sub.organizationId || null,
            action: 'billing.subscription_cancelled',
            resourceType: 'subscription',
            resourceId: sub._id.toString(),
            metadata: {},
          });
        }

        logger.info(`Subscription cancelled: ${subscriptionId}`);
      }
      break;
    }

    case 'subscription.halted': {
      // All payment retries exhausted — downgrade to free
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
      if (sub) {
        sub.status = 'past_due';
        await sub.save();
        await downgradeToFree(sub);

        const { email, userName } = await getSubscriptionOwnerDetails(sub);
        if (email) {
          await emailService.sendPaymentFailureEmail({
            to: email,
            userName,
            plan: sub.plan,
            amount: paymentEntity?.amount || 0,
            currency: paymentEntity?.currency || 'INR',
            reason: 'All automatic retry attempts have failed. Your plan has been downgraded to Free.',
          });
        }
        logger.info(`Subscription halted (downgraded): ${subscriptionId}`);
      }
      break;
    }

    case 'payment.failed': {
      // Individual payment attempt failed — Razorpay auto-retries (up to 3 times)
      // Notify user but do NOT downgrade yet
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });
      if (sub) {
        sub.status = 'past_due';
        await sub.save();

        const { email, userName } = await getSubscriptionOwnerDetails(sub);
        if (email) {
          // Get update payment method URL from Razorpay
          let retryUrl = null;
          try {
            const razorpay = getRazorpay();
            const rzpSub = await razorpay.subscriptions.fetch(subscriptionId);
            retryUrl = rzpSub.short_url;
          } catch (e) {
            logger.warn(`Could not fetch subscription URL: ${e.message}`);
          }

          await emailService.sendPaymentFailureEmail({
            to: email,
            userName,
            plan: sub.plan,
            amount: paymentEntity?.amount || 0,
            currency: paymentEntity?.currency || 'INR',
            reason: paymentEntity?.error_description || 'Payment was declined by your bank or card issuer.',
            retryUrl,
          });
        }
        logger.info(`Payment failed for subscription ${subscriptionId} — awaiting retry`);

        // Audit log: payment failed
        if (email) {
          await logAudit({
            userId: sub.userId || null,
            userName: userName,
            userEmail: email,
            organizationId: sub.organizationId || null,
            action: 'billing.payment_failed',
            resourceType: 'subscription',
            resourceId: sub._id.toString(),
            metadata: {
              paymentId: paymentEntity?.id,
              reason: paymentEntity?.error_description || 'Payment declined',
            },
          });
        }
      }
      break;
    }

    default:
      logger.info(`Unhandled Razorpay event: ${event}`);
  }
}

// ── Subscription status ───────────────────────────────────

/**
 * Get current subscription status for a user.
 * Checks individual subscription first, then org-level enterprise subscription.
 *
 * @param {string} userId
 * @returns {{ plan: string, status: string, currentPeriodEnd?: Date, organizationId?: string }}
 */
async function getSubscriptionStatus(userId) {
  // Check individual subscription
  let sub = await Subscription.findOne({
    userId,
    status: { $in: ['active', 'trialing', 'past_due'] },
  });

  if (sub) {
    return {
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  // Check if user is part of an enterprise org with active subscription
  const User = require('../models/User');
  const user = await User.findById(userId);
  if (user?.activeOrganizationId) {
    sub = await Subscription.findOne({
      organizationId: user.activeOrganizationId,
      status: { $in: ['active', 'trialing', 'past_due'] },
    });
    if (sub) {
      return {
        plan: 'enterprise',
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        organizationId: user.activeOrganizationId,
      };
    }
  }

  return { plan: 'free', status: 'active' };
}

// ── Refund ────────────────────────────────────────────────

/**
 * Issue a refund for a specific payment (for cancellation refunds).
 *
 * @param {string} paymentId     - Razorpay payment ID
 * @param {number} amountInPaise - Partial refund amount in paise; omit for full refund
 * @param {string} reason        - Refund reason
 * @returns {Object} Razorpay refund object
 */
async function issueRefund(paymentId, amountInPaise, reason) {
  const razorpay = getRazorpay();
  const refundParams = { notes: { reason } };
  if (amountInPaise) refundParams.amount = amountInPaise;

  const refund = await razorpay.payments.refund(paymentId, refundParams);
  logger.info(`Refund issued: ${refund.id} for payment ${paymentId}`);
  return refund;
}

// ── Internal helpers ──────────────────────────────────────

/**
 * Get email and name of the subscription owner (individual user or org admin).
 */
async function getSubscriptionOwnerDetails(subscription) {
  const User = require('../models/User');

  if (subscription.userId) {
    const user = await User.findById(subscription.userId);
    return { email: user?.email, userName: user?.name || 'User' };
  }

  if (subscription.organizationId) {
    const Organization = require('../models/Organization');
    const org = await Organization.findById(subscription.organizationId);
    if (org) {
      const admin = await User.findById(org.createdBy);
      return { email: admin?.email, userName: org.name };
    }
  }

  return { email: null, userName: 'User' };
}

/**
 * Update UserLimits based on subscription plan.
 * For enterprise: updates limits for ALL active org members.
 */
async function updateUserLimits(subscription) {
  const limits = PLAN_LIMITS[subscription.plan];
  if (!limits) return;

  if (subscription.userId) {
    await UserLimits.findOneAndUpdate(
      { userId: subscription.userId },
      { ...limits, plan: subscription.plan },
      { upsert: true }
    );
  } else if (subscription.organizationId) {
    const OrganizationMember = require('../models/OrganizationMember');
    const members = await OrganizationMember.find({
      organizationId: subscription.organizationId,
      status: 'active',
    });

    for (const member of members) {
      await UserLimits.findOneAndUpdate(
        { userId: member.userId },
        { ...limits, plan: subscription.plan },
        { upsert: true }
      );
    }
  }
}

/**
 * Downgrade to free plan limits.
 */
async function downgradeToFree(subscription) {
  const freeLimits = PLAN_LIMITS.free;
  if (subscription.userId) {
    await UserLimits.findOneAndUpdate(
      { userId: subscription.userId },
      { ...freeLimits, plan: 'free' }
    );
  }
  // For enterprise: org members keep enterprise limits until period end
}

module.exports = {
  createIndividualSubscription,
  createEnterpriseSubscription,
  verifyWebhookSignature,
  handleWebhookEvent,
  getSubscriptionStatus,
  issueRefund,
};
