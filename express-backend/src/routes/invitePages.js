'use strict';

const { Router } = require('express');
const Organization       = require('../models/Organization');
const OrganizationInvite = require('../models/OrganizationInvite');

const router = Router();

/**
 * GET /invite/:code
 *
 * Public web landing page for an organization invite. Lives outside /api/v1 so
 * it can be shared as a plain HTTPS link in emails/Slack/etc. The page offers a
 * primary CTA that fires the `orvyn://invite?code=...` deep link (handled by
 * Electron via app.setAsDefaultProtocolClient) and a manual-code fallback.
 */
router.get('/:code', async (req, res, next) => {
  try {
    const code = (req.params.code || '').trim();
    const deepLink = `orvyn://invite?code=${encodeURIComponent(code)}`;

    const invite = await OrganizationInvite.findOne({
      inviteCode: code,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).populate('invitedBy', 'name');

    if (!invite) {
      return res.status(404).render('invite', {
        error: 'This invite is invalid, expired, or has already been used.',
        orgName: '',
        inviterName: '',
        role: '',
        expiryDate: '',
        inviteCode: code,
        deepLink,
      });
    }

    const org = await Organization.findOne({ _id: invite.organizationId, isDeleted: false });
    if (!org) {
      return res.status(404).render('invite', {
        error: 'The organization attached to this invite no longer exists.',
        orgName: '',
        inviterName: '',
        role: '',
        expiryDate: '',
        inviteCode: code,
        deepLink,
      });
    }

    const expiryDate = new Date(invite.expiresAt).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    return res.status(200).render('invite', {
      error: null,
      orgName: org.name,
      inviterName: invite.invitedBy?.name || 'A team member',
      role: invite.role,
      expiryDate,
      inviteCode: code,
      deepLink,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
