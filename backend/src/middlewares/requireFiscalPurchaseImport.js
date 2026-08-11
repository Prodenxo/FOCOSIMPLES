/**
 * Permissão FISCAL_PURCHASE_IMPORT — infraestrutura fiscal genérica (sem acoplamento MEI).
 */
import { badRequest, forbidden } from '../utils/errors.js';
import { getRequesterContext } from '../services/users.service.js';

export const FISCAL_PURCHASE_IMPORT_PERMISSION = 'fiscal.purchase_import';

const ROLES_ALLOWED = new Set(['superadmin', 'admin', 'usuario']);

let getRequesterContextRef = getRequesterContext;

/** @internal testes */
export const __setGetRequesterContextForTests = (resolver) => {
  getRequesterContextRef = resolver || getRequesterContext;
};

/**
 * Middleware — exige autenticação + vínculo empresa + permissão fiscal purchase.
 */
export const requireFiscalPurchaseImport = async (req, _res, next) => {
  try {
    const context = await getRequesterContextRef(req.accessToken, req.user);
    if (!context?.userId) {
      return next(forbidden('Autenticação obrigatória'));
    }
    if (!context.empresaId) {
      return next(badRequest('Empresa não vinculada ao usuário'));
    }

    const role = String(context.role || 'usuario').toLowerCase();
    if (role === 'superadmin' || ROLES_ALLOWED.has(role)) {
      req.requesterContext = context;
      return next();
    }

    return next(forbidden('Permissão FISCAL_PURCHASE_IMPORT negada', {
      code: 'FISCAL_PURCHASE_IMPORT_FORBIDDEN',
    }));
  } catch (err) {
    return next(err);
  }
};
