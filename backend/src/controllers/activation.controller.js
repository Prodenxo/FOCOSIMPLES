import * as activationService from '../services/activation.service.js';
import { sendSuccess } from '../utils/response.js';

export const getActivation = async (req, res, next) => {
  try {
    const data = await activationService.getActivationProgress(req.user.id);
    return sendSuccess(res, data, 'Progresso de ativação');
  } catch (error) {
    return next(error);
  }
};
