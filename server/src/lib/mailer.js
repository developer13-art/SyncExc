/**
 * SyncExc Server — Mailer
 *
 * Nodemailer-based SMTP sender. When SMTP is not configured the mailer logs
 * the email instead of sending it (dev / test behaviour).
 */

import config from '../config.js';
import { createLogger } from './logger.js';

const logger = createLogger({ component: 'mailer' });

export async function initMailer() {
  if (!config.smtp.enabled) {
    logger.warn('SMTP not configured; emails will be logged, not sent');

    return {
      async send({ to, subject, html, text, attachments }) {
        logger.info(
          { to, subject, hasHtml: Boolean(html), attachments: attachments?.length || 0 },
          'Email suppressed (SMTP disabled)'
        );
        return { suppressed: true };
      },
      async verify() {
        return { ok: false, reason: 'smtp_not_configured' };
      },
    };
  }

  let nodemailer;
  try {
    nodemailer = (await import('nodemailer')).default;
  } catch {
    throw new Error('nodemailer not installed but SMTP is enabled');
  }

  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.password }
      : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });

  const defaultFrom = `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`;

  try {
    await transport.verify();
    logger.info('SMTP transport verified');
  } catch (err) {
    logger.warn({ err }, 'SMTP transport verification failed at startup');
  }

  return {
    async send({ to, subject, html, text, attachments, from }) {
      const info = await transport.sendMail({
        from: from || defaultFrom,
        to,
        subject,
        html,
        text,
        attachments,
      });
      logger.debug({ messageId: info.messageId, to, subject }, 'Email sent');
      return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
    },
    async verify() {
      try {
        await transport.verify();
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err.message };
      }
    },
    close() {
      transport.close();
    },
  };
}

export default initMailer;