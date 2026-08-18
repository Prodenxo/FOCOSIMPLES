/**
 * Middleware — escopo de cliente (empresaId) para rotas BPO do contador.
 */
import { badRequest, forbidden } from '../utils/errors.js';
import { getRequesterContext } from '../services/users.service.js';
import { assertUserCanAccessEmpresa } from '../services/accountant/accountant-access.service.js';
import { checkActorPermission } from '../services/rbac-catalog.service.js';
import { FISCAL_CONFIG_PERMISSIONS } from '../fiscal-engine/fiscal-configuration/constants.js';

let getRequesterContextRef = getRequesterContext;
let assertAccessRef = assertUserCanAccessEmpresa;

/** @internal testes */
export const __setAccountantClientScopeDepsForTests = (deps = {}) => {
  getRequesterContextRef = deps.getRequesterContext ?? getRequesterContext;
  assertAccessRef = deps.assertUserCanAccessEmpresa ?? assertUserCanAccessEmpresa;
};

/** @internal testes */
export const __resetAccountantClientScopeDepsForTests = () => {
  getRequesterContextRef = getRequesterContext;
  assertAccessRef = assertUserCanAccessEmpresa;
};

/**
 * Valida acesso ao :empresaId da rota e injeta contexto scoped.
 * @param {string | null} [permissionKey]
 */
export const requireAccountantClientScope = (permissionKey = null) => async (req, _res, next) => {
  try {
    const empresaId = String(req.params?.empresaId || '').trim();
    if (!empresaId) return next(badRequest('empresaId obrigatório na rota'));

    const context = await getRequesterContextRef(req.accessToken, req.user);
    if (!context?.userId) return next(forbidden('Autenticação obrigatória'));

    const memberships = await assertAccessRef(context.userId, empresaId);
    const actorContext = {
      userId: context.userId,
      empresaId,
      profileRole: memberships.profileRole,
      memberships: memberships.memberships,
      hasSuperadminCapability: memberships.hasSuperadminCapability,
      hasActiveMembership: memberships.hasActiveMembership,
    };

    if (permissionKey) {
      const check = checkActorPermission(actorContext, permissionKey);
      if (!check.allowed) {
        return next(forbidden(check.reason ?? 'Permissão negada', {
          code: 'FISCAL_CONFIG_FORBIDDEN',
          permission: permissionKey,
        }));
      }
    }

    req.requesterContext = { ...context, empresaId };
    req.actorContext = actorContext;
    req.actor = { userId: context.userId, empresaId };
    return next();
  } catch (err) {
    return next(err);
  }
};

export const requireAccountantClientCatalogAccess = requireAccountantClientScope(null);
export const requireAccountantFiscalConfigView = requireAccountantClientScope(
  FISCAL_CONFIG_PERMISSIONS.VIEW,
);
export const requireAccountantFiscalConfigEditDraft = requireAccountantClientScope(
  FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT,
);
export const requireAccountantFiscalConfigApprove = requireAccountantClientScope(
  FISCAL_CONFIG_PERMISSIONS.APPROVE,
);
