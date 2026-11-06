/**
 * SyncExc Server — Email module routes
 *
 * Inbound provider webhook. Mounted outside the authenticated API surface
 * at /api/v1/webhooks. Signature verification happens before parsing.
 */

import { Router } from 'express';
import { success } from '../../lib/response.js';

export function createEmailRoutes({ service, middleware }) {
  const router = Router();

  router.post(
    '/resend',
    middleware.verifyResendSignature(),
    middleware.asyncHandler(async (req, res) => {
      const result = await service.handleWebhookEvent(req.body);
      return success(res, { received: true, ...result });
    })
  );

  return router;
}

export default createEmailRoutes;
