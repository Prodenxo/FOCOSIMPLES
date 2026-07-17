import * as usersService from '../services/users.service.js';
import * as empresaCnpjOnboardingService from '../services/empresa-cnpj-onboarding.service.js';
import { lookupCnpjCascade } from '../services/cnpj-lookup.service.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export const listUsers = async (req, res, next) => {
  try {
    const result = await usersService.listUsers(req.accessToken, req.query);
    return sendSuccess(res, result, 'Usuários listados');
  } catch (error) {
    return next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const result = await usersService.createUser(req.accessToken, req.body);
    return sendSuccess(res, result, 'Usuário criado');
  } catch (error) {
    return next(error);
  }
};

export const syncPhone = async (req, res, next) => {
  try {
    const result = await usersService.syncPhone(req.user.id, req.body.phone);
    return sendSuccess(res, result, 'Telefone sincronizado');
  } catch (error) {
    return next(error);
  }
};

export const listEmpresas = async (req, res, next) => {
  try {
    const result = await usersService.listEmpresas(req.accessToken);
    return sendSuccess(res, result, 'Empresas listadas');
  } catch (error) {
    return next(error);
  }
};

export const createEmpresa = async (req, res, next) => {
  try {
    const result = await usersService.createEmpresa(req.accessToken, req.body);
    return sendSuccess(res, result, 'Empresa criada');
  } catch (error) {
    return next(error);
  }
};

export const updateEmpresa = async (req, res, next) => {
  try {
    const result = await usersService.updateEmpresa(
      req.accessToken,
      req.params.empresaId,
      req.body
    );
    return sendSuccess(res, result, 'Empresa atualizada');
  } catch (error) {
    return next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const result = await usersService.updateUser(req.accessToken, req.params.userId, req.body);
    return sendSuccess(res, result, 'Usuário atualizado');
  } catch (error) {
    return next(error);
  }
};

export const banUser = async (req, res, next) => {
  try {
    const status = req.body?.status === true;
    const result = await usersService.banUser(req.accessToken, req.params.userId, status === true ? true : false);
    return sendSuccess(res, result, 'Usuário bloqueado');
  } catch (error) {
    return next(error);
  }
};

export const unbanUser = async (req, res, next) => {
  try {
    const result = await usersService.banUser(req.accessToken, req.params.userId, true);
    return sendSuccess(res, result, 'Usuário desbloqueado');
  } catch (error) {
    return next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const result = await usersService.deleteUser(req.accessToken, req.params.userId);
    return sendSuccess(res, result, 'Usuário excluído');
  } catch (error) {
    return next(error);
  }
};

export const resetUserPassword = async (req, res, next) => {
  try {
    const result = await usersService.resetUserPassword(req.accessToken, req.params.userId, req.body);
    return sendSuccess(res, result, 'Senha redefinida');
  } catch (error) {
    return next(error);
  }
};

export const sendUserPasswordResetEmail = async (req, res, next) => {
  try {
    const result = await usersService.sendUserPasswordResetEmail(req.accessToken, req.params.userId);
    return sendSuccess(res, result, 'E-mail de redefinição enviado');
  } catch (error) {
    return next(error);
  }
};

export const getEmpresa = async (req, res, next) => {
  try {
    const result = await usersService.getEmpresa(req.accessToken);
    return sendSuccess(res, result, 'Empresa carregada');
  } catch (error) {
    return next(error);
  }
};

export const getEmpresaCnpjOnboarding = async (req, res, next) => {
  try {
    const result = await empresaCnpjOnboardingService.getEmpresaCnpjOnboardingStatus(
      req.accessToken
    );
    return sendSuccess(res, result, 'Status do cadastro de CNPJ');
  } catch (error) {
    return next(error);
  }
};

export const completeEmpresaCnpjOnboarding = async (req, res, next) => {
  try {
    const result = await empresaCnpjOnboardingService.completeEmpresaCnpjOnboarding(
      req.accessToken,
      req.body
    );
    return sendCreated(res, result, 'CNPJ e dados da empresa salvos');
  } catch (error) {
    return next(error);
  }
};

export const getEmpresaById = async (req, res, next) => {
  try {
    const result = await usersService.getEmpresaById(req.accessToken, req.params.empresaId);
    return sendSuccess(res, result, 'Empresa carregada');
  } catch (error) {
    return next(error);
  }
};

export const deleteEmpresa = async (req, res, next) => {
  try {
    const result = await usersService.deleteEmpresa(req.accessToken, req.params.empresaId);
    return sendSuccess(res, result, 'Empresa excluída');
  } catch (error) {
    return next(error);
  }
};

/** Consulta CNPJ para autofill no cadastro/edição de empresa (PlugNotas + fallback BrasilAPI). */
export const lookupEmpresaCnpj = async (req, res, next) => {
  try {
    const cnpj = String(req.params?.cnpj || req.query?.cnpj || '').trim();
    const data = await lookupCnpjCascade(cnpj);
    return sendSuccess(res, data, 'Dados do CNPJ consultados');
  } catch (error) {
    return next(error);
  }
};