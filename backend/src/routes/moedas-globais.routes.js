import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import * as controller from '../controllers/moedas-globais.controller.js';

const router = Router();

router.get('/currencies', requireAuth, controller.listCurrencies);
router.get('/cotacoes', requireAuth, controller.getCotacoes);

export default router;
