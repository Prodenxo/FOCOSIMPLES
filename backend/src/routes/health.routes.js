import { Router } from 'express';
import { supabaseHealth } from '../controllers/health.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { env } from '../config/env.js';

const router = Router();

if (env.NODE_ENV === 'production') {
  router.get('/supabase', requireAuth, requireAdmin, supabaseHealth);
} else {
  router.get('/supabase', supabaseHealth);
}

export default router;
