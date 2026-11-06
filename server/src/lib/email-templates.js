/**
 * SyncExc Server — Transactional email templates
 *
 * Responsive, table-based layouts with inline CSS for broad email-client
 * compatibility. Every template returns both `html` and `text` versions.
 *
 * All interpolated user content is HTML-escaped.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BRAND = {
  bg: '#0b0f19',
  card: '#111827',
  border: '#1f2937',
  text: '#e5e7eb',
  muted: '#9ca3af',
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  success: '#10b981',
  danger: '#ef4444',
};

const FOOTER_NOTE =
  'You received this email because an account was created with this address on SyncExc. ' +
  'If you did not create this account, you can safely ignore this email.';

function layout({ title, preheader, bodyHtml, footerNote = FOOTER_NOTE }) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(title)}</title>
<!--[if mso]><style>table{border-collapse:collapse}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="padding:0 0 24px 0;text-align:center;">
  <span style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:${BRAND.text};letter-spacing:0.5px;">Sync<span style="color:${BRAND.primary};">Exc</span></span>
</td></tr>
<tr><td style="background-color:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;padding:32px;">
${bodyHtml}
</td></tr>
<tr><td style="padding:24px 8px 0 8px;text-align:center;">
  <p style="margin:0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">${escapeHtml(footerNote)}</p>
  <p style="margin:12px 0 0 0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.muted};">&copy; ${new Date().getFullYear()} SyncExc</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return html;
}

function button(url, label) {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:8px;background-color:${BRAND.primary};">
<a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${safeLabel}</a>
</td></tr></table>`;
}

function paragraph(text, { muted = true } = {}) {
  return `<p style="margin:0 0 16px 0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${muted ? BRAND.muted : BRAND.text};">${text}</p>`;
}

function heading(text) {
  return `<h1 style="margin:0 0 20px 0;font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:22px;font-weight:600;color:${BRAND.text};">${escapeHtml(text)}</h1>`;
}

/* =============================================================================
 * VERIFICATION EMAIL
 * ========================================================================== */

export function buildVerificationEmail({ recipientName, verifyUrl, expiresHours }) {
  const name = recipientName?.trim() || 'there';
  const subject = 'Verify your email address — SyncExc';
  const preheader = 'Confirm your email address to complete your SyncExc account setup.';

  const bodyHtml = [
    heading('Verify your email address'),
    paragraph(`Hello ${escapeHtml(name)},`),
    paragraph('Welcome to SyncExc. To complete the email verification process and confirm ownership of your email address, please click the button below.', { muted: false }),
    button(verifyUrl, 'Verify Email Address'),
    paragraph(`This verification link is valid for a limited time (expires in ${Math.round(expiresHours)} hour${Math.round(expiresHours) === 1 ? '' : 's'}) and can only be used once.`, { muted: true }),
    paragraph('If the button does not work, copy and paste this link into your browser:', { muted: true }),
    `<p style="margin:0 0 16px 0;word-break:break-all;font-family:Consolas,Menlo,monospace;font-size:13px;line-height:20px;color:${BRAND.primary};"><a href="${escapeHtml(verifyUrl)}" style="color:${BRAND.primary};text-decoration:none;">${escapeHtml(verifyUrl)}</a></p>`,
    paragraph('If you did not create this account, you can safely ignore this email.', { muted: true }),
    paragraph('Thank you,<br>The SyncExc Team', { muted: true }),
  ].join('\n');

  const text = [
    `Hello ${name},`,
    '',
    'Welcome to SyncExc.',
    '',
    'To complete the email verification process and confirm ownership of your email address, please visit the link below:',
    '',
    verifyUrl,
    '',
    `This verification link is valid for a limited time (expires in ${Math.round(expiresHours)} hour${Math.round(expiresHours) === 1 ? '' : 's'}) and can only be used once.`,
    '',
    'If you did not create this account, you can safely ignore this email.',
    '',
    'Thank you,',
    'The SyncExc Team',
  ].join('\n');

  return { subject, preheader, html: layout({ title: subject, preheader, bodyHtml }), text };
}

/* =============================================================================
 * EMAIL CHANGE CONFIRMATION
 * ========================================================================== */

export function buildEmailChangeEmail({ recipientName, confirmUrl, expiresHours }) {
  const name = recipientName?.trim() || 'there';
  const subject = 'Confirm your new SyncExc email address';
  const preheader = 'Confirm this email address to start using it on your SyncExc account.';

  const bodyHtml = [
    heading('Confirm your new email address'),
    paragraph(`Hello ${escapeHtml(name)},`),
    paragraph('A request was made to change the email address on your SyncExc account to this address. Click the button below to confirm.', { muted: false }),
    button(confirmUrl, 'Confirm Email Address'),
    paragraph(`This link expires in ${Math.round(expiresHours)} hour${Math.round(expiresHours) === 1 ? '' : 's'} and can only be used once. Your current email address remains active until you confirm.`, { muted: true }),
    paragraph('If you did not request this change, you can safely ignore this email and your email address will remain unchanged.', { muted: true }),
    paragraph('Thank you,<br>The SyncExc Team', { muted: true }),
  ].join('\n');

  const text = [
    `Hello ${name},`,
    '',
    'A request was made to change the email address on your SyncExc account to this address. Confirm it by visiting:',
    '',
    confirmUrl,
    '',
    `This link expires in ${Math.round(expiresHours)} hour${Math.round(expiresHours) === 1 ? '' : 's'} and can only be used once. Your current email address remains active until you confirm.`,
    '',
    'If you did not request this change, you can safely ignore this email.',
    '',
    'Thank you,',
    'The SyncExc Team',
  ].join('\n');

  return { subject, preheader, html: layout({ title: subject, preheader, bodyHtml }), text };
}

/* =============================================================================
 * PASSWORD RESET
 * ========================================================================== */

export function buildPasswordResetEmail({ recipientName, resetUrl, expiresMinutes }) {
  const name = recipientName?.trim() || 'there';
  const subject = 'Reset your SyncExc password';
  const preheader = 'Use this link to reset your SyncExc account password.';

  const bodyHtml = [
    heading('Reset your password'),
    paragraph(`Hello ${escapeHtml(name)},`),
    paragraph('We received a request to reset the password for your SyncExc account. Click the button below to choose a new password.', { muted: false }),
    button(resetUrl, 'Reset Password'),
    paragraph(`This link expires in ${Math.round(expiresMinutes)} minute${Math.round(expiresMinutes) === 1 ? '' : 's'} and can only be used once.`, { muted: true }),
    paragraph('If you did not request a password reset, you can safely ignore this email — your password will not change.', { muted: true }),
    paragraph('Thank you,<br>The SyncExc Team', { muted: true }),
  ].join('\n');

  const text = [
    `Hello ${name},`,
    '',
    'We received a request to reset the password for your SyncExc account. Reset it by visiting:',
    '',
    resetUrl,
    '',
    `This link expires in ${Math.round(expiresMinutes)} minute${Math.round(expiresMinutes) === 1 ? '' : 's'} and can only be used once.`,
    '',
    'If you did not request a password reset, you can safely ignore this email.',
    '',
    'Thank you,',
    'The SyncExc Team',
  ].join('\n');

  return { subject, preheader, html: layout({ title: subject, preheader, bodyHtml }), text };
}

/* =============================================================================
 * SECURITY ALERT
 * ========================================================================== */

export function buildSecurityAlertEmail({ recipientName, headline, message, actionUrl = null, actionLabel = null }) {
  const name = recipientName?.trim() || 'there';
  const subject = `SyncExc security notice: ${headline}`;
  const preheader = 'An important security event occurred on your SyncExc account.';

  const parts = [
    heading(headline),
    paragraph(`Hello ${escapeHtml(name)},`),
    paragraph(escapeHtml(message), { muted: false }),
  ];
  if (actionUrl && actionLabel) parts.push(button(actionUrl, actionLabel));
  parts.push(paragraph('If this was you, no further action is needed. If it was not you, secure your account immediately by changing your password and reviewing your active sessions.', { muted: true }));
  parts.push(paragraph('Thank you,<br>The SyncExc Team', { muted: true }));

  const textLines = [
    `Hello ${name},`,
    '',
    message,
    '',
    actionUrl ? `Open: ${actionUrl}` : null,
    '',
    'If this was you, no further action is needed. If it was not you, secure your account immediately by changing your password and reviewing your active sessions.',
    '',
    'Thank you,',
    'The SyncExc Team',
  ].filter((l) => l !== null);

  return {
    subject,
    preheader,
    html: layout({ title: subject, preheader, bodyHtml: parts.join('\n') }),
    text: textLines.join('\n'),
  };
}

export default {
  buildVerificationEmail,
  buildEmailChangeEmail,
  buildPasswordResetEmail,
  buildSecurityAlertEmail,
};
