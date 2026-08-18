import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  requireAccountantClientCatalogAccess,
  requireAccountantFiscalConfigView,
  requireAccountantFiscalConfigEditDraft,
  requireAccountantFiscalConfigApprove,
  requireAccountantClientScope,
} from '../middlewares/requireAccountantClientScope.js';
import { FISCAL_CONFIG_PERMISSIONS } from '../fiscal-engine/fiscal-configuration/constants.js';
import * as accountantController from '../controllers/accountant.controller.js';
import * as fiscalController from '../controllers/fiscal-configuration.controller.js';

export const createAccountantRouter = (options = {}) => {
  const router = Router();
  const authMiddleware = options.requireAuth ?? requireAuth;
  router.use(authMiddleware);

  router.get('/clients', accountantController.listClients);

  const clientRouter = Router({ mergeParams: true });

  clientRouter.get(
    '/establishments',
    requireAccountantClientCatalogAccess,
    accountantController.listEstablishments,
  );

  clientRouter.get(
    '/products',
    requireAccountantClientCatalogAccess,
    accountantController.listProducts,
  );

  clientRouter.post(
    '/products',
    requireAccountantClientCatalogAccess,
    accountantController.createProduct,
  );

  clientRouter.patch(
    '/products/:productId',
    requireAccountantClientCatalogAccess,
    accountantController.updateProduct,
  );

  const fiscalRouter = Router({ mergeParams: true });

  fiscalRouter.get('/company-profile', requireAccountantFiscalConfigView, fiscalController.getCompanyProfile);
  fiscalRouter.put('/company-profile', requireAccountantFiscalConfigEditDraft, fiscalController.putCompanyProfile);
  fiscalRouter.get('/products/:productId/profile', requireAccountantFiscalConfigView, fiscalController.getProductProfile);
  fiscalRouter.put('/products/:productId/profile', requireAccountantFiscalConfigEditDraft, fiscalController.putProductProfile);
  fiscalRouter.get('/customers/:customerId/profile', requireAccountantFiscalConfigView, fiscalController.getCustomerProfile);
  fiscalRouter.put('/customers/:customerId/profile', requireAccountantFiscalConfigEditDraft, fiscalController.putCustomerProfile);
  fiscalRouter.get('/rules', requireAccountantFiscalConfigView, fiscalController.listAccountantRules);
  fiscalRouter.post('/rules', requireAccountantFiscalConfigEditDraft, fiscalController.postRuleDraft);
  fiscalRouter.patch('/rules/:ruleId', requireAccountantFiscalConfigEditDraft, fiscalController.patchRuleDraft);
  fiscalRouter.post('/rules/:ruleId/approve', requireAccountantFiscalConfigApprove, fiscalController.postApproveRule);
  fiscalRouter.post(
    '/rules/:ruleId/suspend',
    requireAccountantClientScope(FISCAL_CONFIG_PERMISSIONS.SUSPEND),
    fiscalController.postSuspendRule,
  );
  fiscalRouter.post(
    '/rules/:ruleId/revoke',
    requireAccountantClientScope(FISCAL_CONFIG_PERMISSIONS.REVOKE),
    fiscalController.postRevokeRule,
  );
  fiscalRouter.post('/rules/:ruleId/versions', requireAccountantFiscalConfigEditDraft, fiscalController.postNewVersion);
  fiscalRouter.post('/rules/preview', requireAccountantFiscalConfigEditDraft, fiscalController.postPreviewRule);
  fiscalRouter.post('/preview-match', requireAccountantFiscalConfigView, fiscalController.postPreviewMatch);
  fiscalRouter.get('/readiness', requireAccountantFiscalConfigView, fiscalController.getReadiness);
  fiscalRouter.get('/product-groups', requireAccountantFiscalConfigView, fiscalController.listProductGroups);
  fiscalRouter.post('/product-groups', requireAccountantFiscalConfigEditDraft, fiscalController.postProductGroup);
  fiscalRouter.patch('/product-groups/:id', requireAccountantFiscalConfigEditDraft, fiscalController.patchProductGroup);
  fiscalRouter.get('/product-groups/:id/products', requireAccountantFiscalConfigView, fiscalController.getProductGroupProducts);
  fiscalRouter.post('/product-groups/:id/products/bulk-assign', requireAccountantFiscalConfigEditDraft, fiscalController.postProductGroupBulkAssign);
  fiscalRouter.delete('/product-groups/:id/products/:productId', requireAccountantFiscalConfigEditDraft, fiscalController.deleteProductGroupProduct);
  fiscalRouter.get('/products/unassigned', requireAccountantFiscalConfigView, fiscalController.getUnassignedProducts);
  fiscalRouter.post('/scenarios', requireAccountantFiscalConfigEditDraft, fiscalController.postScenarioDraft);

  clientRouter.use('/fiscal-configuration', fiscalRouter);
  router.use('/clients/:empresaId', clientRouter);

  return router;
};

const router = createAccountantRouter();
export default router;
