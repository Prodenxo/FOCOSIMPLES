import * as recorrenciasService from '../services/recorrencias.service.js';
import { sendSuccess } from '../utils/response.js';

export const listRecorrencias = async (req, res, next) => {
  try {
    const data = await recorrenciasService.listRecorrencias(req.user.id);
    return sendSuccess(res, data, 'Recorrências listadas');
  } catch (error) {
    return next(error);
  }
};

export const createRecorrencia = async (req, res, next) => {
  try {
    const data = await recorrenciasService.createRecorrencia(req.user.id, req.body);
    return sendSuccess(res, data, 'Recorrência criada');
  } catch (error) {
    return next(error);
  }
};

export const updateRecorrencia = async (req, res, next) => {
  try {
    const id = req.params.id ?? req.body?.id;
    const data = await recorrenciasService.updateRecorrencia(req.user.id, id, req.body);
    return sendSuccess(res, data, 'Recorrência atualizada');
  } catch (error) {
    return next(error);
  }
};

export const deleteRecorrencia = async (req, res, next) => {
  try {
    const id = req.params.id ?? req.query?.id ?? req.body?.id;
    await recorrenciasService.deleteRecorrencia(req.user.id, id);
    return sendSuccess(res, { success: true }, 'Recorrência removida');
  } catch (error) {
    return next(error);
  }
};
