import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireFiscalConfigView,
  requireFiscalConfigEditDraft,
  requireFiscalConfigApprove,
  requireFiscalConfigurationPermission,
} from '../middlewares/requireFiscalConfiguration.js';
import { FISCAL_CONFIG_PERMISSIONS } from '../fiscal-engine/fiscal-configuration/constants.js';
import * as controller from '../controllers/fiscal-configuration.controller.js';

export const createFiscalConfigurationRouter = (options = {}) => {
  const router = Router();
  const authMiddleware = options.requireAuth ?? requireAuth;
  router.use(authMiddleware);

  router.get('/company-profile', requireFiscalConfigView, controller.getCompanyProfile);
  router.put('/company-profile', requireFiscalConfigEditDraft, controller.putCompanyProfile);
  router.get('/products/:productId/profile', requireFiscalConfigView, controller.getProductProfile);
  router.put('/products/:productId/profile', requireFiscalConfigEditDraft, controller.putProductProfile);
  router.get('/customers/:customerId/profile', requireFiscalConfigView, controller.getCustomerProfile);
  router.put('/customers/:customerId/profile', requireFiscalConfigEditDraft, controller.putCustomerProfile);
  router.get('/rules', requireFiscalConfigView, controller.listAccountantRules);
  router.post('/rules', requireFiscalConfigEditDraft, controller.postRuleDraft);
  router.patch('/rules/:ruleId', requireFiscalConfigEditDraft, controller.patchRuleDraft);
  router.post('/rules/:ruleId/approve', requireFiscalConfigApprove, controller.postApproveRule);
  router.post('/rules/:ruleId/suspend', requireFiscalConfigurationPermission(FISCAL_CONFIG_PERMISSIONS.SUSPEND), controller.postSuspendRule);
  router.post('/rules/:ruleId/revoke', requireFiscalConfigurationPermission(FISCAL_CONFIG_PERMISSIONS.REVOKE), controller.postRevokeRule);
  router.post('/rules/:ruleId/versions', requireFiscalConfigEditDraft, controller.postNewVersion);
  router.post('/rules/preview', requireFiscalConfigEditDraft, controller.postPreviewRule);
  router.post('/preview-match', requireFiscalConfigView, controller.postPreviewMatch);
  router.get('/readiness', requireFiscalConfigView, controller.getReadiness);
  router.get('/product-groups', requireFiscalConfigView, controller.listProductGroups);
  router.post('/product-groups', requireFiscalConfigEditDraft, controller.postProductGroup);
  router.patch('/product-groups/:id', requireFiscalConfigEditDraft, controller.patchProductGroup);
  router.get('/product-groups/:id/products', requireFiscalConfigView, controller.getProductGroupProducts);
  router.post('/product-groups/:id/products/bulk-assign', requireFiscalConfigEditDraft, controller.postProductGroupBulkAssign);
  router.delete('/product-groups/:id/products/:productId', requireFiscalConfigEditDraft, controller.deleteProductGroupProduct);
  router.get('/products/unassigned', requireFiscalConfigView, controller.getUnassignedProducts);
  router.post('/scenarios', requireFiscalConfigEditDraft, controller.postScenarioDraft);
  return router;
};

const router = createFiscalConfigurationRouter();
export default router;
