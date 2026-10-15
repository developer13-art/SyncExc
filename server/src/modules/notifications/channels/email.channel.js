/**
 * SyncExc Server — Email channel
 */

export function createEmailChannel({ mailer, logger }) {
  return {
    async send({ notification }) {
      if (!mailer) {
        logger.warn({ notificationId: notification.id }, 'Mailer not configured');
        return { ok: false, error: 'mailer_not_configured' };
      }

      // Look up the destination email. The notification service attaches it
      // to notification.recipientEmail when present; otherwise we use the
      // user's primary email.
      const email = notification.recipientEmail || null;
      if (!email) {
        // Try the user record
        const result = await db.query(`SELECT email FROM users WHERE id = $1`, [notification.user_id]);
        if (result.rows.length === 0) {
          return { ok: false, error: 'recipient_email_missing' };
        }
        notification.recipientEmail = result.rows[0].email;
      }

      try {
        const info = await mailer.send({
          to: notification.recipientEmail,
          subject: notification.title,
          text: notification.message,
          html: renderHtml(notification),
        });
        return {
          ok: true,
          providerRef: info.messageId || null,
        };
      } catch (err) {
        logger.warn({ err, notificationId: notification.id }, 'Email send failed');
        return { ok: false, error: err.message };
      }
    },
  };
}

function renderHtml(notification) {
  const escapedTitle = escapeHtml(notification.title);
  const escapedMessage = escapeHtml(notification.message);
  const actionHtml = notification.action
    ? `<p><a href="${escapeHtml(notification.action.url)}">${escapeHtml(notification.action.label || 'Open')}</a></p>`
    : '';
  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a;">${escapedTitle}</h2>
  <p style="line-height: 1.6;">${escapedMessage}</p>
  ${actionHtml}
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="font-size: 12px; color: #888;">You received this message because you have a SyncExc account.</p>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default createEmailChannel;