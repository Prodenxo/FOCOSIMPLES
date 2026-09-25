import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { requireMeiEnabled } from '../middlewares/requireMei.js'
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js'
import * as controller from '../controllers/simples-das.controller.js'

const router = Router()

router.use(requireAuth, requireMeiEnabled)

router.get('/status', controller.getIntegrationStatus)
router.get('/periods', controller.listPeriods)
router.post('/gerar', controller.gerar)
router.get('/faturamento', controller.getFaturamento)
router.get('/draft', controller.getDraft)
router.put('/draft', controller.saveDraft)
router.post('/simular', controller.simular)
router.post('/trial/declarar', requireSuperAdmin, controller.declararTrial)
router.post('/trial/gerar', requireSuperAdmin, controller.gerarTrial)
router.post('/declarar', controller.declarar)
router.get('/:id/download', controller.download)

export default router
