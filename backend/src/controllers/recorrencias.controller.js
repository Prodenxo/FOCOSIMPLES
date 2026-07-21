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
    const result = await recorrenciasService.deleteRecorrencia(req.user.id, id);
    return sendSuccess(res, { success: true, mode: result?.mode || 'hard' }, 'Recorrência removida');
  } catch (error) {
    return next(error);
  }
};

export const listRecorrenciaSkips = async (req, res, next) => {
  try {
    const data = await recorrenciasService.listRecorrenciaSkips(req.user.id);
    return sendSuccess(res, data, 'Skips listados');
  } catch (error) {
    return next(error);
  }
};

export const addRecorrenciaSkip = async (req, res, next) => {
  try {
    const data = await recorrenciasService.addRecorrenciaSkip(req.user.id, req.body);
    return sendSuccess(res, data, 'Skip registrado');
  } catch (error) {
    return next(error);
  }
};
