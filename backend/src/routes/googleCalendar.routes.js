import { Router } from 'express';
import { proxyGoogleCalendar } from '../controllers/googleCalendar.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.all('/:path', requireAuth, proxyGoogleCalendar);

export default router;
