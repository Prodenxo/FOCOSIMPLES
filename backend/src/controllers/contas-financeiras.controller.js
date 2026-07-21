import * as contasService from '../services/contas-financeiras.service.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export const listContas = async (req, res, next) => {
  try {
    const includeInactive =
      req.query?.all === '1'
      || req.query?.all === 'true'
      || req.query?.includeInactive === '1';
    const data = await contasService.listContasFinanceiras(req.user.id, {
      activeOnly: !includeInactive,
    });
    return sendSuccess(res, data, 'Contas listadas');
  } catch (error) {
    return next(error);
  }
};

export const createConta = async (req, res, next) => {
  try {
    const data = await contasService.createContaFinanceira(req.user.id, req.body || {});
    return sendCreated(res, data, 'Conta criada');
  } catch (error) {
    return next(error);
  }
};

export const updateConta = async (req, res, next) => {
  try {
    const data = await contasService.updateContaFinanceira(req.user.id, {
      ...(req.body || {}),
      conta_id: req.params.id,
      id: req.params.id,
    });
    return sendSuccess(res, data, 'Conta atualizada');
  } catch (error) {
    return next(error);
  }
};

export const deleteConta = async (req, res, next) => {
  try {
    const data = await contasService.deleteContaFinanceira(req.user.id, {
      conta_id: req.params.id,
      id: req.params.id,
    });
    return sendSuccess(res, data, 'Conta removida');
  } catch (error) {
    return next(error);
  }
};
