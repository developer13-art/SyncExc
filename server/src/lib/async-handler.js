/**
 * SyncExc Server — Async route handler wrapper
 *
 * Express 4 does not catch promise rejections in async handlers.
 * Wrap every async handler with this helper.
 */

export function asyncHandler(fn) {
  return function asyncHandlerWrapper(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;