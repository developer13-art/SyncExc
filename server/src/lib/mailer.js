/**
 * SyncExc Server — Mailer
 *
 * Transactional email sender. Provider priority:
 *   1. Resend (RESEND_API_KEY) — used when configured.
 *   2. SMTP via nodemailer — legacy fallback.
 *   3. Suppressed stub — logs instead of sending (dev / test behaviour).
 *
 * The API key is read exclusively from backend environment variables and is
 * never logged or returned to callers.
 */

import { createRequire } from 'node:module';
import config from '../config.js';
import { createLogger } from './logger.js';
import { ValidationError } from './errors.js';

const require = createRequire(import.meta.url);

const logger = createLogger({ component: 'mailer' });

function assertValidSend({ to, from, subject }) {
  const recipients = Array.isArray(to) ? to : [to];
  if (!recipients.length || recipients.some((r) => typeof r !== 'string' || !r.includes('@'))) {
    throw new ValidationError('A valid recipient email address is required');
  }
  if (from && (typeof from !== 'string' || !from.includes('@'))) {
    throw new ValidationError('A valid sender email address is required');
  }
  if (!subject || typeof subject !== 'string') {
    throw new ValidationError('An email subject is required');
  }
}

/* =============================================================================
 * RESEND
 * ========================================================================== */

function createResendTransport({ apiKey, defaultFrom }) {
  let resend;
  try {
    // Imported lazily so the process can boot without the optional SDK.
    const mod = require('resend');
    resend = new mod.Resend(apiKey);
  } catch (err) {
    throw new Error(`resend SDK unavailable: ${err.message}`);
  }

  return {
    provider: 'resend',
    async send({ to, subject, html, text, from }) {
      const { data, error } = await resend.emails.send({
        from: from || defaultFrom,
        to,
        subject,
        html,
        text,
      });
      if (error) {
        const err = new Error(error.message || 'Resend rejected the email request');
        err.provider = 'resend';
        err.providerStatus = error.statusCode;
        err.retryable = !error.statusCode || error.statusCode >= 500;
        throw err;
      }
      // `data.id` is the Resend message ID: the request was ACCEPTED by
      // Resend. Confirmed inbox delivery arrives asynchronously via webhook.
      return { messageId: data?.id || null, provider: 'resend' };
    },
    async verify() {
      try {
        await resend.domains.list();
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err.message };
      }
    },
  };
}

/* =============================================================================
 * SMTP (nodemailer fallback)
 * ========================================================================== */

async function createSmtpTransport() {
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

  try {
    await transport.verify();
    logger.info('SMTP transport verified');
  } catch (err) {
    logger.warn({ err }, 'SMTP transport verification failed at startup');
  }

  return {
    provider: 'smtp',
    async send({ to, subject, html, text, attachments, from }) {
      const info = await transport.sendMail({
        from: from || `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
        to,
        subject,
        html,
        text,
        attachments,
      });
      logger.debug({ messageId: info.messageId, to, subject }, 'Email sent');
      return { messageId: info.messageId, provider: 'smtp' };
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

/* =============================================================================
 * FACTORY
 * ========================================================================== */

export async function initMailer() {
  const defaultFrom = `"${config.email.fromName}" <${config.email.fromEmail}>`;

  if (config.email.resendApiKey) {
    const transport = createResendTransport({
      apiKey: config.email.resendApiKey,
      defaultFrom,
    });
    logger.info({ provider: 'resend', from: config.email.fromEmail }, 'Mailer initialized');
    return wrapWithValidation(transport);
  }

  if (config.smtp.enabled) {
    const transport = await createSmtpTransport();
    logger.info({ provider: 'smtp', from: config.smtp.fromEmail }, 'Mailer initialized');
    return wrapWithValidation(transport);
  }

  logger.warn('No email provider configured (RESEND_API_KEY / SMTP); emails will be logged, not sent');

  return {
    provider: 'none',
    async send({ to, subject }) {
      logger.info(
        { to, subject },
        'Email suppressed (no email provider configured)'
      );
      return { suppressed: true, provider: 'none' };
    },
    async verify() {
      return { ok: false, reason: 'email_not_configured' };
    },
  };
}

function wrapWithValidation(transport) {
  return {
    provider: transport.provider,
    async send(payload) {
      assertValidSend(payload);
      return transport.send(payload);
    },
    verify: () => transport.verify(),
    close: () => transport.close?.(),
  };
}

export default initMailer;
