import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireFiscalConfigApprove } from '../middlewares/requireFiscalConfiguration.js';
import * as controller from '../controllers/fiscal-manual-opening.controller.js';

const router = Router();

router.post(
  '/manual-opening',
  requireAuth,
  requireFiscalConfigApprove,
  controller.postManualOpeningLot,
);

export default router;
