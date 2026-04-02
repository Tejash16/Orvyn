'use strict';

// ── Shared layout pieces ─────────────────────────────────────

function wrapLayout(bodyContent) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Orvyn</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td><![endif]-->
        <!-- Inner container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Green header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px 24px;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Orvyn</p>
            </td>
          </tr>
          <!-- Body content -->
          <tr>
            <td style="padding:36px 32px 24px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e4e4e7;padding-top:20px;">
                    <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;line-height:18px;">
                      &copy; ${new Date().getFullYear()} Orvyn &mdash; Intelligent Document Management
                    </p>
                    <p style="margin:6px 0 0;font-size:12px;color:#a1a1aa;text-align:center;line-height:18px;">
                      This is an automated message. Please do not reply directly to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function otpBlock(code) {
  const digitCells = String(code)
    .split('')
    .map(d => `<td style="width:44px;height:52px;background-color:#F0FDF4;border:2px solid #BBF7D0;border-radius:8px;text-align:center;vertical-align:middle;font-size:28px;font-weight:700;font-family:'Courier New',Courier,monospace;color:#059669;">${d}</td>`)
    .join('\n            <td style="width:10px;">&nbsp;</td>\n            ');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:24px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
            ${digitCells}
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function expiryNotice(minutes) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:0 0 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background-color:#FEF3C7;border-radius:8px;padding:10px 20px;">
            <p style="margin:0;font-size:13px;color:#92400E;text-align:center;">
              &#9200; &nbsp;This code expires in <strong>${minutes} minutes</strong>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// ── Template: Verification Email ─────────────────────────────

function verificationEmailTemplate(code, expiryMinutes) {
  const html = wrapLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;text-align:center;">
      Verify Your Email
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;text-align:center;line-height:22px;">
      Welcome to Orvyn! Use the verification code below to confirm your email address and activate your account.
    </p>

    ${otpBlock(code)}
    ${expiryNotice(expiryMinutes)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:20px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F4F5;border-radius:8px;">
            <tr>
              <td style="padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#71717a;line-height:19px;">
                  <strong style="color:#52525b;">&#128274; Security tip:</strong> If you didn&rsquo;t create an Orvyn account, you can safely ignore this email. No account will be created.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `);

  const text = [
    'Verify Your Email — Orvyn',
    '',
    'Welcome to Orvyn! Use the verification code below to confirm your email address:',
    '',
    `  ${code}`,
    '',
    `This code expires in ${expiryMinutes} minutes.`,
    '',
    'If you didn\'t create an Orvyn account, you can safely ignore this email.',
  ].join('\n');

  return { html, text };
}

// ── Template: Password Reset Email ───────────────────────────

function passwordResetEmailTemplate(code, expiryMinutes) {
  const html = wrapLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;text-align:center;">
      Reset Your Password
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;text-align:center;line-height:22px;">
      We received a request to reset your Orvyn password. Enter the code below in the app to set a new password.
    </p>

    ${otpBlock(code)}
    ${expiryNotice(expiryMinutes)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:20px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F4F5;border-radius:8px;">
            <tr>
              <td style="padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#71717a;line-height:19px;">
                  <strong style="color:#52525b;">&#128274; Security tip:</strong> If you didn&rsquo;t request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `);

  const text = [
    'Reset Your Password — Orvyn',
    '',
    'We received a request to reset your Orvyn password. Use the code below:',
    '',
    `  ${code}`,
    '',
    `This code expires in ${expiryMinutes} minutes.`,
    '',
    'If you didn\'t request this, you can safely ignore this email. Your password will remain unchanged.',
  ].join('\n');

  return { html, text };
}

// ── Template: Organization Invite ────────────────────────────

function organizationInviteTemplate({ orgName, inviterName, inviteCode, role, expiresAt }) {
  const appDeepLink = `orvyn://invite?code=${inviteCode}`;
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const html = wrapLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;text-align:center;">
      You're Invited
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;text-align:center;line-height:22px;">
      <strong>${inviterName}</strong> has invited you to join
      <strong>${orgName}</strong> on Orvyn as a <strong>${role}</strong>.
    </p>

    <!-- Invite code block -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:8px 0 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0FDF4;border:2px solid #BBF7D0;border-radius:12px;">
            <tr>
              <td style="padding:16px 32px;text-align:center;">
                <p style="margin:0 0 6px;font-size:12px;color:#52525b;text-transform:uppercase;letter-spacing:1px;">Your invite code</p>
                <p style="margin:0;font-size:22px;font-weight:700;font-family:'Courier New',Courier,monospace;color:#059669;letter-spacing:2px;">${inviteCode}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 20px;font-size:14px;color:#52525b;text-align:center;line-height:21px;">
      Open Orvyn &rarr; <strong>Join Organization</strong> &rarr; paste the code above.
    </p>

    <!-- CTA button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:0 0 24px;">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" style="height:44px;width:200px;v-text-anchor:middle;" arcsize="14%" fillcolor="#059669"><center style="color:#ffffff;font-size:15px;font-weight:600;font-family:sans-serif;">Open in Orvyn</center></v:roundrect><![endif]-->
          <a href="${appDeepLink}" style="display:inline-block;background-color:#059669;color:#ffffff;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;font-family:-apple-system,sans-serif;">
            Open in Orvyn
          </a>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F4F5;border-radius:8px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;font-size:13px;color:#71717a;line-height:19px;">
            This invite expires on <strong>${expiryDate}</strong>. If you don&rsquo;t have Orvyn installed, contact your team admin.
          </p>
        </td>
      </tr>
    </table>
  `);

  const text = [
    `You're invited to join ${orgName} on Orvyn`,
    '',
    `${inviterName} has invited you to join "${orgName}" as a ${role}.`,
    '',
    'To accept this invite:',
    '1. Open Orvyn and go to "Join Organization"',
    `2. Enter this invite code: ${inviteCode}`,
    '',
    `Or click this link to open directly in the app: ${appDeepLink}`,
    '',
    `This invite expires on ${expiryDate}.`,
  ].join('\n');

  return { html, text };
}

// ── Template: Payment Success ────────────────────────────────

function paymentSuccessTemplate({ userName, plan, amount, currency, paymentId, invoiceUrl, billingPeriod }) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: currency || 'INR',
  }).format(amount / 100);
  const planLabel = plan === 'pro' ? 'Individual Pro' : 'Enterprise';

  const html = wrapLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;text-align:center;">
      Payment Confirmed
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;text-align:center;line-height:22px;">
      Hi ${userName}, your payment has been successfully processed.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:6px 0;color:#52525b;font-size:14px;">Amount</td><td style="padding:6px 0;font-weight:700;text-align:right;font-size:14px;color:#18181b;">${formattedAmount}</td></tr>
          <tr><td style="padding:6px 0;color:#52525b;font-size:14px;">Plan</td><td style="padding:6px 0;text-align:right;font-size:14px;color:#18181b;">${planLabel}</td></tr>
          <tr><td style="padding:6px 0;color:#52525b;font-size:14px;">Payment ID</td><td style="padding:6px 0;text-align:right;font-family:monospace;font-size:13px;color:#18181b;">${paymentId}</td></tr>
          <tr><td style="padding:6px 0;color:#52525b;font-size:14px;">Period</td><td style="padding:6px 0;text-align:right;font-size:14px;color:#18181b;">${billingPeriod}</td></tr>
        </table>
      </td></tr>
    </table>

    ${invoiceUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:20px 0 0;text-align:center;">
        <a href="${invoiceUrl}" style="color:#059669;font-size:14px;text-decoration:underline;">Download Invoice / Receipt</a>
      </td></tr>
    </table>` : ''}
  `);

  const text = [
    `Payment Confirmed — Orvyn ${planLabel}`,
    '',
    `Hi ${userName},`,
    `Your payment of ${formattedAmount} for Orvyn ${planLabel} has been received.`,
    '',
    `Payment ID: ${paymentId}`,
    `Plan: ${planLabel}`,
    `Billing period: ${billingPeriod}`,
    invoiceUrl ? `Invoice: ${invoiceUrl}` : '',
    '',
    'Thank you for using Orvyn!',
  ].filter(Boolean).join('\n');

  return { html, text };
}

// ── Template: Payment Failure ────────────────────────────────

function paymentFailureTemplate({ userName, plan, amount, currency, reason, retryUrl }) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: currency || 'INR',
  }).format(amount / 100);
  const planLabel = plan === 'pro' ? 'Individual Pro' : 'Enterprise';

  const html = wrapLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#dc2626;text-align:center;">
      Payment Failed
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;text-align:center;line-height:22px;">
      Hi ${userName}, your payment of <strong>${formattedAmount}</strong> for
      <strong>Orvyn ${planLabel}</strong> could not be processed.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0;font-size:14px;color:#991B1B;">
          <strong>Reason:</strong> ${reason || 'Payment was declined by your bank or card issuer.'}
        </p>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:20px 0 0;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#18181b;">What happens next?</p>
        <ul style="margin:0;padding-left:20px;font-size:14px;color:#52525b;line-height:24px;">
          <li>Razorpay will <strong>automatically retry</strong> the payment within 3 days</li>
          <li>Your subscription remains active during the retry window</li>
          <li>If all retries fail, your plan will be downgraded to Free</li>
        </ul>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;margin-top:16px;">
      <tr><td style="padding:12px 18px;">
        <p style="margin:0;font-size:13px;color:#1E40AF;">
          <strong>No refund needed</strong> &mdash; failed payments are NOT charged. If any amount was temporarily held,
          your bank will auto-release it within 5&ndash;7 business days.
        </p>
      </td></tr>
    </table>

    ${retryUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:24px 0 0;">
        <a href="${retryUrl}" style="display:inline-block;background-color:#059669;color:#ffffff;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
          Update Payment Method
        </a>
      </td></tr>
    </table>` : ''}
  `);

  const text = [
    `Payment Failed — Orvyn ${planLabel}`,
    '',
    `Hi ${userName},`,
    `Your payment of ${formattedAmount} for Orvyn ${planLabel} could not be processed.`,
    '',
    `Reason: ${reason || 'Payment was declined by your bank or card issuer.'}`,
    '',
    'What happens next:',
    '- Razorpay will automatically retry the payment within 3 days',
    '- Your subscription remains active during the retry window',
    '- If all retries fail, your plan will be downgraded to Free',
    '',
    'No refund needed — failed payments are NOT charged.',
    retryUrl ? `Update payment method: ${retryUrl}` : '',
  ].filter(Boolean).join('\n');

  return { html, text };
}

// ── Template: DataRoom Shared ────────────────────────────────

function dataRoomSharedTemplate({ sharerName, dataRoomName }) {
  const html = wrapLayout(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#18181b;text-align:center;">
      DataRoom Shared With You
    </h1>
    <p style="margin:0 0 24px;font-size:15px;color:#52525b;text-align:center;line-height:22px;">
      <strong>${sharerName}</strong> shared the DataRoom
      <strong>&ldquo;${dataRoomName}&rdquo;</strong> with you.
    </p>
    <p style="margin:0;font-size:14px;color:#52525b;text-align:center;">
      Open Orvyn to view the shared DataRoom in your &ldquo;Shared with me&rdquo; section.
    </p>
  `);

  const text = [
    `${sharerName} shared a DataRoom with you on Orvyn`,
    '',
    `${sharerName} shared the DataRoom "${dataRoomName}" with you.`,
    'Open Orvyn to view the shared DataRoom.',
  ].join('\n');

  return { html, text };
}

module.exports = {
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  organizationInviteTemplate,
  paymentSuccessTemplate,
  paymentFailureTemplate,
  dataRoomSharedTemplate,
};
