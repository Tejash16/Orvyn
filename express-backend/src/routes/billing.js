'use strict';

const router           = require('express').Router();
const jwt              = require('jsonwebtoken');
const { authenticate } = require('../middleware/authenticate');
const razorpayService  = require('../services/razorpayService');
const logger           = require('../services/logger');

// ── API Routes (require Bearer token) ─────────────────────

/**
 * POST /api/v1/billing/create-checkout-session
 * Create a Razorpay subscription and return the checkout URL.
 * Body: { plan: 'pro' | 'enterprise', organizationId?, seats? }
 */
router.post('/create-checkout-session', authenticate, async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { plan, organizationId, seats } = req.body;

    let result;
    if (plan === 'pro') {
      result = await razorpayService.createIndividualSubscription(
        user._id, user.email, user.name
      );
    } else if (plan === 'enterprise' && organizationId) {
      result = await razorpayService.createEnterpriseSubscription(
        organizationId, seats || 5, user.email, user.name
      );
    } else {
      return res.status(400).json({ error: 'Invalid plan. Use "pro" or "enterprise" with organizationId.' });
    }

    // Generate a short-lived JWT for the checkout page (5 min)
    const checkoutToken = jwt.sign(
      {
        userId: String(user._id),
        plan,
        subscriptionId: result.subscriptionId,
        planName: plan === 'pro' ? 'Pro' : 'Enterprise',
        formattedPrice: plan === 'pro' ? '₹499' : `₹299 × ${seats || 5} seats`,
        planDescription: plan === 'pro'
          ? 'Unlimited DataRooms, 5000 files/month, unlimited Copilot'
          : `Enterprise plan with ${seats || 5} seats`,
        userEmail: user.email,
        userName: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const expressUrl = process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 3000}`;

    res.json({
      checkoutUrl: result.shortUrl, // Razorpay-hosted checkout as primary
      selfHostedCheckoutUrl: `${expressUrl}/billing/checkout/${checkoutToken}`,
      subscriptionId: result.subscriptionId,
    });
  } catch (error) {
    logger.error('Create checkout session error:', error);
    next(error);
  }
});

/**
 * GET /api/v1/billing/status
 * Get current subscription status for the authenticated user.
 */
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const status = await razorpayService.getSubscriptionStatus(req.user.userId);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/billing/cancel
 * Cancel the user's active subscription.
 */
router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    const Subscription = require('../models/Subscription');
    const sub = await Subscription.findOne({
      userId: req.user.userId,
      status: { $in: ['active', 'trialing'] },
    });

    if (!sub) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel on Razorpay
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId);

    sub.status = 'cancelled';
    sub.cancelledAt = new Date();
    await sub.save();

    logger.info(`Subscription cancelled by user ${req.user.userId}: ${sub.razorpaySubscriptionId}`);

    res.json({ message: 'Subscription cancelled. Access continues until period end.' });
  } catch (error) {
    logger.error('Cancel subscription error:', error);
    next(error);
  }
});

/**
 * POST /api/v1/billing/webhook
 * Razorpay webhook handler — NO Bearer auth, verified by signature.
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];

    // Use raw body preserved by express.json({ verify }) in server.js
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!razorpayService.verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid Razorpay webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const { event, payload } = req.body;
    logger.info(`Razorpay webhook received: ${event}`);

    await razorpayService.handleWebhookEvent(event, payload);

    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ── Checkout Web Pages (served in browser, not API) ───────

/**
 * GET /billing/checkout/:token
 * Serve the Razorpay checkout page. Token is a short-lived JWT.
 */
router.get('/checkout/:token', (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);

    res.render('checkout', {
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      subscriptionId: decoded.subscriptionId,
      planName: decoded.planName,
      formattedPrice: decoded.formattedPrice,
      planDescription: decoded.planDescription,
      userEmail: decoded.userEmail,
      userName: decoded.userName,
    });
  } catch (error) {
    logger.warn('Invalid checkout token:', error.message);
    res.status(400).send('Invalid or expired checkout link. Please try again from the Orvyn app.');
  }
});

/**
 * GET /billing/checkout/success
 * Payment success page shown after Razorpay checkout completes.
 */
router.get('/checkout/success', (_req, res) => {
  res.render('payment-success', {
    message: 'Payment successful! You can close this tab and return to Orvyn.',
  });
});

/**
 * GET /billing/checkout/failure
 * Payment failure page.
 */
router.get('/checkout/failure', (_req, res) => {
  res.render('payment-failure', {
    message: 'Payment could not be processed. Please try again from the Orvyn app.',
  });
});

module.exports = router;
