import * as service from '../services/contas-moeda-global.service.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export const listContas = async (req, res, next) => {
  try {
    const includeInactive =
      req.query?.all === '1'
      || req.query?.all === 'true'
      || req.query?.includeInactive === '1';
    const data = await service.listContasMoedaGlobal(req.user.id, {
      activeOnly: !includeInactive,
    });
    return sendSuccess(res, data, 'Contas em moeda global listadas');
  } catch (error) {
    return next(error);
  }
};

export const createConta = async (req, res, next) => {
  try {
    const data = await service.createContaMoedaGlobal(req.user.id, req.body || {});
    return sendCreated(res, data, 'Conta em moeda global criada');
  } catch (error) {
    return next(error);
  }
};

export const updateConta = async (req, res, next) => {
  try {
    const data = await service.updateContaMoedaGlobal(
      req.user.id,
      req.params.id,
      req.body || {},
    );
    return sendSuccess(res, data, 'Conta em moeda global atualizada');
  } catch (error) {
    return next(error);
  }
};

export const deleteConta = async (req, res, next) => {
  try {
    const data = await service.deleteContaMoedaGlobal(req.user.id, req.params.id);
    return sendSuccess(res, data, 'Conta em moeda global removida');
  } catch (error) {
    return next(error);
  }
};
