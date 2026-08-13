/**
 * Middleware RBAC — configuração fiscal Phase 8C.
 */
import { badRequest, forbidden } from '../utils/errors.js';
import { getRequesterContext } from '../services/users.service.js';
import {
  checkActorPermission,
} from '../services/rbac-catalog.service.js';
import { resolveActorMembershipsForUser } from '../services/openclaw-bot.service.js';
import { FISCAL_CONFIG_PERMISSIONS } from '../fiscal-engine/fiscal-configuration/constants.js';

let getRequesterContextRef = getRequesterContext;
let resolveMembershipsRef = resolveActorMembershipsForUser;

/** @internal testes */
export const __setFiscalConfigMiddlewareDepsForTests = (deps = {}) => {
  getRequesterContextRef = deps.getRequesterContext ?? getRequesterContext;
  resolveMembershipsRef = deps.resolveActorMembershipsForUser ?? resolveActorMembershipsForUser;
};

/**
 * @param {string} permissionKey
 */
export const requireFiscalConfigurationPermission = (permissionKey) => async (req, _res, next) => {
  try {
    const context = await getRequesterContextRef(req.accessToken, req.user);
    if (!context?.userId) return next(forbidden('Autenticação obrigatória'));
    if (!context.empresaId) return next(badRequest('Empresa não vinculada ao usuário'));

    const memberships = await resolveMembershipsRef(context.userId);
    const actorContext = {
      userId: context.userId,
      empresaId: context.empresaId,
      profileRole: memberships.profileRole,
      memberships: memberships.memberships,
      hasSuperadminCapability: memberships.hasSuperadminCapability,
      hasActiveMembership: memberships.hasActiveMembership,
    };

    const check = checkActorPermission(actorContext, permissionKey);
    if (!check.allowed) {
      return next(forbidden(check.reason ?? 'Permissão negada', {
        code: 'FISCAL_CONFIG_FORBIDDEN',
        permission: permissionKey,
      }));
    }

    req.requesterContext = context;
    req.actorContext = actorContext;
    req.actor = { userId: context.userId, empresaId: context.empresaId };
    return next();
  } catch (err) {
    return next(err);
  }
};

export const requireFiscalConfigView = requireFiscalConfigurationPermission(
  FISCAL_CONFIG_PERMISSIONS.VIEW,
);
export const requireFiscalConfigEditDraft = requireFiscalConfigurationPermission(
  FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT,
);
export const requireFiscalConfigApprove = requireFiscalConfigurationPermission(
  FISCAL_CONFIG_PERMISSIONS.APPROVE,
);
