import { Router } from 'express';
import { requireZapiInboundSecret } from '../middlewares/zapiWebhookAuth.js';
import * as controller from '../controllers/zapi-webhook.controller.js';

const router = Router();

router.get('/monitor', controller.getZapiMonitor);
router.post('/inbound', requireZapiInboundSecret, controller.postInbound);

export default router;
