import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js';
import * as controller from '../controllers/admin.controller.js';
import * as adminBillingController from '../controllers/admin-billing.controller.js';

const router = Router();

router.get('/users/:userId/transactions', requireAuth, requireAdmin, controller.listUserTransactions);
router.get('/users/:userId/categories', requireAuth, requireAdmin, controller.listUserCategories);
router.get('/users/:userId/budgets/summary', requireAuth, requireAdmin, controller.listUserBudgetsSummary);
router.get('/users/:userId/budgets/yearly', requireAuth, requireAdmin, controller.listUserBudgetsYearly);
router.get('/users/:userId/balance', requireAuth, requireAdmin, controller.getUserBalance);
router.get('/users/:userId/mei-nfse', requireAuth, requireAdmin, controller.listAdminUserMeiNfse);
router.get(
  '/users/:userId/mei-catalogo/clientes',
  requireAuth,
  requireAdmin,
  controller.listAdminUserMeiCatalogoClientes
);
router.get(
  '/users/:userId/mei-catalogo/produtos',
  requireAuth,
  requireAdmin,
  controller.listAdminUserMeiCatalogoProdutos
);
router.post(
  '/users/:userId/mei-catalogo/clientes',
  requireAuth,
  requireAdmin,
  controller.createAdminUserMeiCatalogoCliente
);
router.patch(
  '/users/:userId/mei-catalogo/clientes/:id',
  requireAuth,
  requireAdmin,
  controller.updateAdminUserMeiCatalogoCliente
);
router.delete(
  '/users/:userId/mei-catalogo/clientes/:id',
  requireAuth,
  requireAdmin,
  controller.deleteAdminUserMeiCatalogoCliente
);
router.post('/users/:userId/mei-nfse/emitir', requireAuth, requireAdmin, controller.emitirNotaAsAdmin);
router.get('/das/status', requireAuth, requireAdmin, controller.listDasStatus);
router.get('/das/pending', requireAuth, requireAdmin, controller.listPendingDas);
router.post('/das/reprocess', requireAuth, requireAdmin, controller.reprocessDas);
router.get('/mei-guide/:userId/certificate/status', requireAuth, requireAdmin, controller.getAdminMeiCertificateStatus);
router.patch(
  '/users/:userId/mei-documentos-ativos',
  requireAuth,
  requireAdmin,
  controller.patchAdminMeiDocumentosAtivos,
);
router.get('/mei-guide/:userId/parcelamentos', requireAuth, requireAdmin, controller.listAdminUserParcelamentos);
router.get('/mei-guide/:userId/parcelamentos/:numero/pdf', requireAuth, requireAdmin, controller.downloadAdminUserParcelamentoPdf);
router.get('/mei-guide/:userId/periods', requireAuth, requireAdmin, controller.listAdminMeiPeriods);
router.get('/mei-guide/:userId/periods-by-cnpj', requireAuth, requireAdmin, controller.listAdminMeiPeriodsByCnpj);
router.get('/mei-guide/:userId/download/:periodoApuracao', requireAuth, requireAdmin, controller.downloadAdminMeiGuide);
router.post('/mei-guide/:userId/send-whatsapp', requireAuth, requireAdmin, controller.sendAdminMeiWhatsapp);

router.get(
  '/access-requests/report',
  requireAuth,
  requireSuperAdmin,
  controller.getAccessRequestsReport,
);

router.get(
  '/billing/stripe/subscription-lines',
  requireAuth,
  requireSuperAdmin,
  adminBillingController.listStripeMeiSubscriptionLines
);
router.post(
  '/billing/stripe/mei-checkout',
  requireAuth,
  requireSuperAdmin,
  adminBillingController.createStripeMeiCheckoutSession
);
router.post(
  '/billing/stripe/sync-max-mei',
  requireAuth,
  requireSuperAdmin,
  adminBillingController.syncStripeMaxMeiFromLines
);

export default router;
