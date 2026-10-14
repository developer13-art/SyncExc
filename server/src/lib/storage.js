/**
 * SyncExc Server — File storage abstraction
 *
 * Two drivers:
 *   - local: writes to a configured directory; served via an authenticated route.
 *   - s3:    writes to S3-compatible object storage; returns signed URLs on demand.
 *
 * Every stored file gets a random UUID-based key so original filenames never
 * leak into storage paths.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import config from '../config.js';
import { createLogger } from './logger.js';
import { AppError } from './errors.js';

const logger = createLogger({ component: 'storage' });

/**
 * Local filesystem driver.
 */
function createLocalDriver() {
  const basePath = path.resolve(config.storage.localPath);

  return {
    async ensureBase() {
      await fs.mkdir(basePath, { recursive: true });
    },

    async put({ buffer, mimeType, extension }) {
      const key = `${randomUUID()}${extension ? `.${extension}` : ''}`;
      const fullPath = path.join(basePath, key);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, buffer);
      logger.debug({ key, bytes: buffer.length, mimeType }, 'Stored file locally');
      return { key, size: buffer.length, driver: 'local' };
    },

    async get(key) {
      const fullPath = path.join(basePath, path.basename(key));
      try {
        const buffer = await fs.readFile(fullPath);
        return buffer;
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },

    async delete(key) {
      const fullPath = path.join(basePath, path.basename(key));
      try {
        await fs.unlink(fullPath);
        return true;
      } catch (err) {
        if (err.code === 'ENOENT') return false;
        throw err;
      }
    },

    async signedUrl() {
      // Local driver doesn't produce signed URLs; the server streams the file
      // through an authenticated route instead.
      return null;
    },

    async health() {
      try {
        await fs.access(basePath);
        return { status: 'ok', driver: 'local' };
      } catch {
        return { status: 'error', driver: 'local', reason: 'base path not accessible' };
      }
    },
  };
}

/**
 * S3 driver — used only when STORAGE_DRIVER=s3 and credentials are provided.
 * Loads the AWS SDK lazily so local-only deployments don't pay the import cost.
 */
function createS3Driver() {
  let s3Client;

  async function ensureClient() {
    if (s3Client) return s3Client;
    let S3Client;
    let PutObjectCommand;
    let GetObjectCommand;
    let DeleteObjectCommand;
    let GetObjectCommandForUrl;
    try {
      const awsSdk = await import('@aws-sdk/client-s3');
      S3Client = awsSdk.S3Client;
      PutObjectCommand = awsSdk.PutObjectCommand;
      GetObjectCommand = awsSdk.GetObjectCommand;
      DeleteObjectCommand = awsSdk.DeleteObjectCommand;
      GetObjectCommandForUrl = GetObjectCommand;
    } catch {
      throw new AppError('S3 storage driver requested but @aws-sdk/client-s3 is not installed', {
        code: 'STORAGE_MISCONFIGURED',
        status: 500,
      });
    }

    s3Client = new S3Client({
      region: config.storage.s3.region,
      endpoint: config.storage.s3.endpoint,
      forcePathStyle: config.storage.s3.forcePathStyle,
      credentials:
        config.storage.s3.accessKeyId && config.storage.s3.secretAccessKey
          ? {
              accessKeyId: config.storage.s3.accessKeyId,
              secretAccessKey: config.storage.s3.secretAccessKey,
            }
          : undefined,
    });

    s3Client._commands = {
      PutObjectCommand,
      GetObjectCommand,
      DeleteObjectCommand,
      GetObjectCommandForUrl,
    };

    return s3Client;
  }

  return {
    async ensureBase() {
      await ensureClient();
    },

    async put({ buffer, mimeType, extension }) {
      const client = await ensureClient();
      const key = `${randomUUID()}${extension ? `.${extension}` : ''}`;
      const { PutObjectCommand } = client._commands;
      await client.send(
        new PutObjectCommand({
          Bucket: config.storage.s3.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        })
      );
      return { key, size: buffer.length, driver: 's3' };
    },

    async get(key) {
      const client = await ensureClient();
      const { GetObjectCommand } = client._commands;
      try {
        const response = await client.send(
          new GetObjectCommand({ Bucket: config.storage.s3.bucket, Key: key })
        );
        const chunks = [];
        for await (const chunk of response.Body) chunks.push(chunk);
        return Buffer.concat(chunks);
      } catch (err) {
        if (err?.$metadata?.httpStatusCode === 404) return null;
        throw err;
      }
    },

    async delete(key) {
      const client = await ensureClient();
      const { DeleteObjectCommand } = client._commands;
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: config.storage.s3.bucket, Key: key })
        );
        return true;
      } catch (err) {
        if (err?.$metadata?.httpStatusCode === 404) return false;
        throw err;
      }
    },

    async signedUrl(key, expiresSeconds = 900) {
      const client = await ensureClient();
      const { GetObjectCommand } = client._commands;
      try {
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: config.storage.s3.bucket, Key: key }),
          { expiresIn: expiresSeconds }
        );
        return url;
      } catch {
        // Signer not installed; fall back to no URL
        return null;
      }
    },

    async health() {
      try {
        await ensureClient();
        return { status: 'ok', driver: 's3', bucket: config.storage.s3.bucket };
      } catch (err) {
        return { status: 'error', driver: 's3', reason: err.message };
      }
    },
  };
}

export async function initStorage() {
  const driver =
    config.storage.driver === 's3' ? createS3Driver() : createLocalDriver();
  await driver.ensureBase();
  logger.info({ driver: config.storage.driver }, 'Storage initialized');
  return driver;
}

export default initStorage;