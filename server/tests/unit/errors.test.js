import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  Errors,
  isSyncExcError,
} from '../../src/lib/errors.js';

test('AppError preserves code, status, and message', () => {
  const err = new AppError('test message', { code: 'TEST', status: 400, expose: true });
  assert.equal(err.code, 'TEST');
  assert.equal(err.status, 400);
  assert.equal(err.expose, true);
  assert.equal(err.message, 'test message');
});

test('AppError does not expose by default', () => {
  const err = new AppError('internal', { code: 'X' });
  const json = err.toJSON();
  assert.equal(json.message, 'Internal server error');
});

test('ValidationError has 422 status', () => {
  const err = new ValidationError('invalid', { field: 'email' });
  assert.equal(err.status, 422);
  assert.equal(err.code, 'VALIDATION_ERROR');
  assert.equal(err.expose, true);
  assert.deepEqual(err.details, { field: 'email' });
});

test('AuthenticationError has 401 status', () => {
  const err = new AuthenticationError('no auth');
  assert.equal(err.status, 401);
  assert.equal(err.expose, true);
});

test('AuthorizationError has 403 status', () => {
  const err = new AuthorizationError('denied');
  assert.equal(err.status, 403);
});

test('NotFoundError has 404 status', () => {
  const err = new NotFoundError('User');
  assert.equal(err.status, 404);
  assert.match(err.message, /User not found/);
});

test('ConflictError has 409 status', () => {
  const err = new ConflictError('conflict', 'CUSTOM_CODE');
  assert.equal(err.status, 409);
  assert.equal(err.code, 'CUSTOM_CODE');
});

test('RateLimitError includes retryAfterSeconds', () => {
  const err = new RateLimitError('slow down', 60);
  assert.equal(err.status, 429);
  assert.deepEqual(err.details, { retryAfterSeconds: 60 });
});

test('Errors factory functions produce correct instances', () => {
  assert.ok(Errors.permissionDenied() instanceof AuthorizationError);
  assert.ok(Errors.notFound('User') instanceof NotFoundError);
  assert.ok(Errors.validationFailed() instanceof ValidationError);
});

test('isSyncExcError identifies our errors', () => {
  assert.equal(isSyncExcError(new AppError('x', { code: 'X' })), true);
  assert.equal(isSyncExcError(new Error('x')), false);
  assert.equal(isSyncExcError(null), false);
});