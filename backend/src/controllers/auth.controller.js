import * as authService from '../services/auth.service.js';
import * as rbacCatalogService from '../services/rbac-catalog.service.js';
import { getRequesterContext } from '../services/users.service.js';
import { resolveActorMembershipsForUser } from '../services/openclaw-bot.service.js';
import {
  buildOriginMetaFromBody,
  submitSelfServeEmpresaSignup,
} from '../services/self-serve-signup.service.js';
import { sendCreated, sendSuccess } from '../utils/response.js';
import { badRequest } from '../utils/errors.js';

export const signUp = async (req, res, next) => {
  try {
    const result = await authService.signUp(req.body);
    return sendSuccess(res, result, 'Usuário registrado com sucesso');
  } catch (error) {
    return next(error);
  }
};

/**
 * Cadastro empresa.
 * signupMode=self_serve → depois /planos (Stripe).
 * signupMode=manual_approval → solicitação em análise (sem checkout).
 */
export const registerEmpresa = async (req, res, next) => {
  try {
    const originMeta = buildOriginMetaFromBody(req.body ?? {}, req.headers);
    const result = await submitSelfServeEmpresaSignup(req.body ?? {}, originMeta);
    const message = result?.pendingApproval
      ? 'Cadastro enviado. Aguarde a análise da equipe.'
      : 'Cadastro criado. Faça login e escolha um plano.';
    return sendCreated(res, result, message);
  } catch (error) {
    if (error?.status === 409) {
      return res.status(409).json({
        success: false,
        data: null,
        message: error.message || 'Este e-mail já está cadastrado.',
        errors: null,
      });
    }
    return next(error);
  }
};

export const signIn = async (req, res, next) => {
  try {
    const result = await authService.signIn(req.body);
    return sendSuccess(res, result, 'Login realizado com sucesso');
  } catch (error) {
    return next(error);
  }
};

export const signOut = async (req, res, next) => {
  try {
    await authService.signOut(req.accessToken);
    return sendSuccess(res, { success: true }, 'Logout realizado');
  } catch (error) {
    return next(error);
  }
};

export const getSession = async (req, res, next) => {
  try {
    const session = await authService.getSession(req.accessToken);
    return sendSuccess(res, { session }, 'Sessão obtida');
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPasswordForEmail(req.body.email);
    return sendSuccess(res, { success: true }, 'Email de recuperação enviado');
  } catch (error) {
    return next(error);
  }
};

export const processRecoveryHash = async (req, res, next) => {
  try {
    const result = await authService.processRecoveryHash(req.body);
    return sendSuccess(res, result, 'Recovery processado');
  } catch (error) {
    return next(error);
  }
};

export const exchangeCodeForSession = async (req, res, next) => {
  try {
    const result = await authService.exchangeCodeForSession(req.body.code);
    return sendSuccess(res, result, 'Sessão criada');
  } catch (error) {
    return next(error);
  }
};

export const updatePassword = async (req, res, next) => {
  try {
    await authService.updatePassword({
      accessToken: req.accessToken,
      userId: req.user?.id,
      newPassword: req.body.newPassword
    });
    return sendSuccess(res, { success: true }, 'Senha atualizada');
  } catch (error) {
    return next(error);
  }
};

export const updatePhone = async (req, res, next) => {
  try {
    const phone = await authService.updatePhone(req.accessToken, req.body.phone);
    return sendSuccess(res, { phone }, 'Telefone atualizado');
  } catch (error) {
    return next(error);
  }
};

export const updateDisplayName = async (req, res, next) => {
  try {
    await authService.updateDisplayName(req.accessToken, req.body.displayName);
    return sendSuccess(res, { success: true }, 'Nome atualizado');
  } catch (error) {
    return next(error);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const result = await authService.updateRole(req.accessToken, req.body.userId, req.body.role);
    return sendSuccess(res, result, 'Role atualizada');
  } catch (error) {
    return next(error);
  }
};

export const getLastSeenUpdate = async (req, res, next) => {
  try {
    const result = await authService.getLastSeenUpdate(req.accessToken);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

export const updateLastSeenUpdate = async (req, res, next) => {
  try {
    const result = await authService.updateLastSeenUpdate(req.accessToken, req.body.updateId);
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

export const impersonate = async (req, res, next) => {
  try {
    const result = await authService.impersonate(req.accessToken, req.body.userId);
    return sendSuccess(res, result, 'Link de impersonação gerado');
  } catch (error) {
    return next(error);
  }
};

/** Catálogo estático de cargos e permissões (app + bot + painel). */
export const listRolesCatalog = async (_req, res, next) => {
  try {
    const catalog = rbacCatalogService.listRolesCatalog();
    let databaseRoles = [];
    try {
      databaseRoles = await rbacCatalogService.listRolesFromDatabase();
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      databaseRoles = { error: msg };
    }
    return sendSuccess(
      res,
      { catalog, databaseRoles },
      'Catálogo de cargos',
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Permissões por role (query `role`) ou do utilizador autenticado (JWT).
 */
export const getPermissions = async (req, res, next) => {
  try {
    const roleQuery = req.query?.role;
    if (roleQuery) {
      const data = rbacCatalogService.getPermissionsForRole(String(roleQuery));
      return sendSuccess(res, data, 'Permissões do cargo');
    }

    const requester = await getRequesterContext(req.accessToken, req.user);
    const actorContext = await resolveActorMembershipsForUser(requester.userId);
    const effective = rbacCatalogService.resolveEffectivePermissionsForActor({
      ...actorContext,
      profileRole: actorContext.profileRole || requester.role,
    });
    return sendSuccess(
      res,
      {
        userId: requester.userId,
        empresaId: requester.empresaId,
        requesterRole: requester.role,
        ...effective,
      },
      'Permissões efectivas do utilizador',
    );
  } catch (error) {
    return next(error);
  }
};

/** Verifica uma permissão (query `permission`) para o utilizador autenticado. */
export const checkPermission = async (req, res, next) => {
  try {
    const permission = req.query?.permission;
    if (!permission) throw badRequest('Query permission é obrigatória');
    const requester = await getRequesterContext(req.accessToken, req.user);
    const actorContext = await resolveActorMembershipsForUser(requester.userId);
    const result = rbacCatalogService.checkActorPermission(
      {
        ...actorContext,
        profileRole: actorContext.profileRole || requester.role,
      },
      String(permission),
    );
    return sendSuccess(res, result, result.allowed ? 'Permitido' : 'Não permitido');
  } catch (error) {
    return next(error);
  }
};
