import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { inviteValidateRateLimit } from '../middlewares/invite-validate-rate-limit.js';
import * as controller from '../controllers/empresa-invites.controller.js';

const router = Router();

router.get('/validate', inviteValidateRateLimit, controller.validateInviteGet);
router.post('/validate', inviteValidateRateLimit, controller.validateInvitePost);

router.post('/accept', requireAuth, controller.acceptInvite);
router.post('/', requireAuth, controller.createInvite);
router.get('/', requireAuth, controller.listInvites);
router.post('/:inviteId/revoke', requireAuth, controller.revokeInvite);
router.patch('/:inviteId/revoke', requireAuth, controller.revokeInvite);

export default router;
