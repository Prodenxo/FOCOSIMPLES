import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import * as controller from '../controllers/contas-financeiras.controller.js';

const router = Router();

router.get('/', requireAuth, controller.listContas);
router.post('/', requireAuth, controller.createConta);
router.put('/:id', requireAuth, controller.updateConta);
router.patch('/:id', requireAuth, controller.updateConta);
router.delete('/:id', requireAuth, controller.deleteConta);

export default router;
