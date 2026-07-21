import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import * as controller from '../controllers/recorrencias.controller.js';

const router = Router();

router.get('/', requireAuth, controller.listRecorrencias);
router.post('/', requireAuth, controller.createRecorrencia);
router.get('/skips', requireAuth, controller.listRecorrenciaSkips);
router.post('/skips', requireAuth, controller.addRecorrenciaSkip);
router.put('/:id', requireAuth, controller.updateRecorrencia);
router.delete('/:id', requireAuth, controller.deleteRecorrencia);

export default router;
