/**
 * SyncExc Server — Mailer
 *
 * Uses Resend when configured, with SMTP as a fallback.
 */

import config from '../config.js';
import { createLogger } from './logger.js';
import { ExternalProviderError } from './errors.js';

const logger = createLogger({ component: 'mailer' });

export function createResendMailer({
  apiKey,
  fromEmail,
  fromName = 'SyncExc',
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required for Resend email delivery');
  }

  const defaultFrom = `${fromName} <${fromEmail}>`;

  return {
    async send({ to, subject, html, text, attachments, from }) {
      const payload = {
        from: from || defaultFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
        ...(attachments?.length
          ? {
              attachments: attachments.map((attachment) => ({
                ...(attachment.filename ? { filename: attachment.filename } : {}),
                ...(attachment.content
                  ? {
                      content: Buffer.isBuffer(attachment.content)
                        ? attachment.content.toString('base64')
                        : attachment.content,
                    }
                  : {}),
                ...(attachment.path ? { path: attachment.path } : {}),
                ...(attachment.contentType ? { content_type: attachment.contentType } : {}),
                ...(attachment.contentId ? { content_id: attachment.contentId } : {}),
              })),
            }
          : {}),
      };
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let responseBody;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }

      if (!response.ok || !responseBody?.id) {
        logger.error(
          { providerStatus: response.status, hasResponseId: Boolean(responseBody?.id) },
          'Resend email delivery failed',
        );
        throw new ExternalProviderError('Email delivery failed. Please try again later.', {
          provider: 'resend',
          status: 502,
          retryable: response.status >= 500,
          details: { providerStatus: response.status },
        });
      }

      logger.debug({ messageId: responseBody.id }, 'Email sent through Resend');
      return { messageId: responseBody.id, accepted: payload.to, rejected: [] };
    },

    async verify() {
      return { ok: Boolean(apiKey), provider: 'resend' };
    },

    close() {},
  };
}

export async function initMailer() {
  if (config.resend.enabled) {
    logger.info('Resend email provider configured');
    return createResendMailer({
      apiKey: config.resend.apiKey,
      fromEmail: config.resend.fromEmail,
      fromName: config.resend.fromName,
    });
  }

  if (!config.smtp.enabled) {
    logger.warn('No email provider configured; emails will be logged, not sent');

    return {
      async send({ to, subject, html, text, attachments }) {
        logger.info(
          { to, subject, hasHtml: Boolean(html), attachments: attachments?.length || 0 },
          'Email suppressed (SMTP disabled)'
        );
        return { suppressed: true };
      },
      async verify() {
        return { ok: false, reason: 'email_provider_not_configured' };
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