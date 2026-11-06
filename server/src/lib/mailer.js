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

export function assertValidSend({ to, from, subject }) {
  const recipients = Array.isArray(to) ? to : [to];
  const validEmail = (value) =>
    typeof value === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  if (!recipients.length || recipients.some((r) => !validEmail(r))) {
    const error = new ValidationError('A valid recipient email address is required');
    error.code = 'EMAIL_INVALID_RECIPIENT';
    throw error;
  }
  const senderAddress = typeof from === 'string' ? from.match(/<([^<>]+)>/)?.[1] || from : from;
  if (!validEmail(senderAddress)) {
    const error = new ValidationError('A valid sender email address is required');
    error.code = from ? 'EMAIL_INVALID_SENDER' : 'EMAIL_SENDER_NOT_CONFIGURED';
    throw error;
  }
  if (!subject || typeof subject !== 'string') {
    const error = new ValidationError('An email subject is required');
    error.code = 'EMAIL_INVALID_SUBJECT';
    throw error;
  }
}

/* =============================================================================
 * RESEND
 * ========================================================================== */

export function createResendTransport({ apiKey, defaultFrom, ResendClient }) {
  let resend;
  try {
    // Imported lazily so the process can boot without the optional SDK.
    const Client = ResendClient || require('resend').Resend;
    resend = new Client(apiKey);
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
        const status = Number(error.statusCode ?? error.status);
        err.providerStatus = Number.isFinite(status) ? status : undefined;
        err.providerErrorCode = typeof error.name === 'string'
          ? error.name
          : typeof error.code === 'string'
            ? error.code
            : undefined;
        err.retryable = !Number.isFinite(status) || status >= 500 || status === 429;
        throw err;
      }
      if (!data?.id) {
        const err = new Error('Resend did not return an email message ID');
        err.provider = 'resend';
        err.code = 'EMAIL_PROVIDER_INVALID_RESPONSE';
        throw err;
      }
      // `data.id` is the Resend message ID: the request was ACCEPTED by
      // Resend. Confirmed inbox delivery arrives asynchronously via webhook.
      return { messageId: data.id, provider: 'resend' };
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
  const defaultFrom = config.email.fromEmail
    ? `"${config.email.fromName}" <${config.email.fromEmail}>`
    : undefined;

  if (config.email.resendApiKey) {
    if (!defaultFrom) {
      logger.error(
        'EMAIL_FROM is required when RESEND_API_KEY is configured; email requests will fail until it is set'
      );
    }
    const transport = createResendTransport({
      apiKey: config.email.resendApiKey,
      defaultFrom,
    });
    logger.info({ provider: 'resend', from: config.email.fromEmail }, 'Mailer initialized');
    return wrapWithValidation(transport, defaultFrom);
  }

  if (config.smtp.enabled) {
    const transport = await createSmtpTransport();
    logger.info({ provider: 'smtp', from: config.smtp.fromEmail }, 'Mailer initialized');
    return wrapWithValidation(
      transport,
      `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`
    );
  }

  logger.warn('No email provider configured (RESEND_API_KEY / SMTP); emails will be logged, not sent');

  return {
    provider: 'none',
    async send() {
      const err = new Error('No transactional email provider is configured');
      err.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
      err.retryable = true;
      throw err;
    },
    async verify() {
      return { ok: false, reason: 'email_not_configured' };
    },
  };
}

function wrapWithValidation(transport, defaultFrom) {
  return {
    provider: transport.provider,
    async send(payload) {
      const effectiveFrom = payload.from || defaultFrom;
      if (!effectiveFrom) {
        const error = new ValidationError('EMAIL_FROM is required to send transactional email');
        error.code = 'EMAIL_SENDER_NOT_CONFIGURED';
        throw error;
      }
      assertValidSend({ ...payload, from: effectiveFrom });
      return transport.send({ ...payload, from: effectiveFrom });
    },
    verify: () => transport.verify(),
    close: () => transport.close?.(),
  };
}

export default initMailer;
