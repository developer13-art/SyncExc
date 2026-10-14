/**
 * @syncexc/shared — Public API
 *
 * Everything server, client, and admin need from a single import.
 *
 *   import { CONSTANTS, SCHEMAS, VALIDATORS, UTILS } from '@syncexc/shared';
 *   import { USER_STATUS, ORDER_TYPE } from '@syncexc/shared/constants';
 *   import { RegisterRequestSchema } from '@syncexc/shared/schemas';
 *   import { validateEmail } from '@syncexc/shared/validators';
 *   import { maskEmail, roundDecimal } from '@syncexc/shared/utils';
 */

export * from './constants.js';
export * from './schemas.js';
export * from './validators.js';
export * from './utils.js';
export * from './types.js';