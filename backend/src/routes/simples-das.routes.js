import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { requireMeiEnabled } from '../middlewares/requireMei.js'
import * as controller from '../controllers/simples-das.controller.js'

const router = Router()

router.get('/status', requireAuth, requireMeiEnabled, controller.getIntegrationStatus)
router.get('/periods', requireAuth, requireMeiEnabled, controller.listPeriods)
router.post('/gerar', requireAuth, requireMeiEnabled, controller.gerar)
router.get('/faturamento', requireAuth, requireMeiEnabled, controller.getFaturamento)
router.post('/declarar', requireAuth, requireMeiEnabled, controller.declarar)
router.get('/:id/download', requireAuth, requireMeiEnabled, controller.download)

export default router
