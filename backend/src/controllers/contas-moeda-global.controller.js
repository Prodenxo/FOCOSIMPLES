import * as service from '../services/contas-moeda-global.service.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

export const listContas = async (req, res, next) => {
  try {
    const data = await service.listContasMoedaGlobal(req.user.id);
    return sendSuccess(res, data, 'Moedas listadas');
  } catch (error) {
    return next(error);
  }
};

export const createConta = async (req, res, next) => {
  try {
    const data = await service.createContaMoedaGlobal(req.user.id, req.body || {});
    return sendCreated(res, data, 'Moeda cadastrada');
  } catch (error) {
    return next(error);
  }
};

export const updateConta = async (req, res, next) => {
  try {
    const data = await service.updateContaMoedaGlobal(req.user.id, req.params.id, req.body || {});
    return sendSuccess(res, data, 'Moeda atualizada');
  } catch (error) {
    return next(error);
  }
};

export const deleteConta = async (req, res, next) => {
  try {
    const data = await service.deleteContaMoedaGlobal(req.user.id, req.params.id);
    return sendSuccess(res, data, 'Moeda removida');
  } catch (error) {
    return next(error);
  }
};
