import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import * as controller from '../controllers/transactions.controller.js';

const router = Router();

router.get('/', requireAuth, controller.listTransactions);
router.post('/', requireAuth, controller.createTransaction);
router.put('/', requireAuth, controller.updateTransaction);
router.delete('/', requireAuth, controller.deleteTransaction);

export default router;
