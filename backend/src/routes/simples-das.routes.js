import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { requireMeiEnabled } from '../middlewares/requireMei.js'
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js'
import * as controller from '../controllers/simples-das.controller.js'

const router = Router()

// Enquanto o fluxo PGDAS-D está em validação, nenhuma operação (nem leitura)
// fica disponível para clientes. O bloqueio é no backend, não apenas na tela.
router.use(requireAuth, requireSuperAdmin, requireMeiEnabled)

router.get('/status', controller.getIntegrationStatus)
router.get('/periods', controller.listPeriods)
router.post('/gerar', controller.gerar)
router.get('/faturamento', controller.getFaturamento)
router.post('/simular', controller.simular)
router.post('/trial/declarar', controller.declararTrial)
router.post('/trial/gerar', controller.gerarTrial)
router.post('/declarar', controller.declarar)
router.get('/:id/download', controller.download)

export default router
