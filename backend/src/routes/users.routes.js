import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import * as controller from '../controllers/users.controller.js';
import * as activationController from '../controllers/activation.controller.js';

const router = Router();

router.get('/me/activation', requireAuth, activationController.getActivation);
router.get('/', requireAuth, controller.listUsers);
router.get('/empresas', requireAuth, controller.listEmpresas);
router.get('/empresas/cnpj-lookup/:cnpj', requireAuth, controller.lookupEmpresaCnpj);
router.get('/empresas/current', requireAuth, controller.getEmpresa);
router.get('/empresas/current/cnpj-onboarding', requireAuth, controller.getEmpresaCnpjOnboarding);
router.post('/empresas/current/cnpj-onboarding', requireAuth, controller.completeEmpresaCnpjOnboarding);
router.get('/empresas/:empresaId', requireAuth, controller.getEmpresaById);
router.post('/empresas', requireAuth, controller.createEmpresa);
router.put('/empresas/:empresaId', requireAuth, controller.updateEmpresa);
router.delete('/empresas/:empresaId', requireAuth, controller.deleteEmpresa);
router.post('/sync-phone', requireAuth, controller.syncPhone);
router.post('/:userId/ban', requireAuth, controller.banUser);
router.post('/:userId/unban', requireAuth, controller.unbanUser);
router.post('/:userId/reset-password', requireAuth, controller.resetUserPassword);
router.post('/:userId/send-password-reset-email', requireAuth, controller.sendUserPasswordResetEmail);
router.put('/:userId', requireAuth, controller.updateUser);
router.delete('/:userId', requireAuth, controller.deleteUser);
router.post('/', requireAuth, controller.createUser);

export default router;
