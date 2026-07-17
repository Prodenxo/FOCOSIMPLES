import { Router } from 'express';
import { requireOpenclawSecret } from '../middlewares/openclawWebhook.js';
import * as controller from '../controllers/openclaw-bot.controller.js';

const router = Router();

router.post('/openclaw/action', requireOpenclawSecret, controller.postOpenclawAction);

export default router;
