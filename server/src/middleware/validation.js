/**
 * SyncExc Server — Validation middleware
 *
 * Wraps Joi schemas to validate req.body, req.query, and req.params.
 * On success, replaces the target object with the validated (and coerced)
 * value. On failure, throws ValidationError with field-level details.
 *
 * The error shape:
 *   {
 *     "code": "VALIDATION_ERROR",
 *     "message": "Validation failed",
 *     "details": {
 *       "fields": [
 *         { "path": "email", "message": "must be a valid email" }
 *       ]
 *     }
 *   }
 */

import { ValidationError } from '../lib/errors.js';

function formatJoiError(error) {
  const fields = error.details.map((d) => ({
    path: d.path.join('.'),
    message: d.message,
  }));
  return fields;
}

/**
 * Build a validation middleware from one or more Joi schemas.
 *
 * @param {Object} schemas
 * @param {Joi.Schema} [schemas.body]
 * @param {Joi.Schema} [schemas.query]
 * @param {Joi.Schema} [schemas.params]
 */
export function validate(schemas) {
  return function validateMiddleware(req, _res, next) {
    const failures = [];

    for (const target of ['params', 'query', 'body']) {
      const schema = schemas[target];
      if (!schema) continue;

      const { error, value } = schema.validate(req[target] ?? {}, {
        abortEarly: false,
        stripUnknown: false,
        convert: true,
      });

      if (error) {
        failures.push(...formatJoiError(error));
        continue;
      }

      // Replace with validated value on success
      if (target === 'query') {
        // Do not directly reassign req.query — some frameworks treat it as
        // read-only. Merge validated values in.
        Object.assign(req.query, value);
      } else {
        req[target] = value;
      }
    }

    if (failures.length > 0) {
      return next(new ValidationError('Validation failed', { fields: failures }));
    }

    next();
  };
}

/**
 * Convenience wrappers.
 */
export const validateBody = (schema) => validate({ body: schema });
export const validateQuery = (schema) => validate({ query: schema });
export const validateParams = (schema) => validate({ params: schema });

export default validate;