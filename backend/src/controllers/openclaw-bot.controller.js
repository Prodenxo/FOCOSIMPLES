import * as openclawBotService from '../services/openclaw-bot.service.js';
import { sendSuccess } from '../utils/response.js';
import { badRequest } from '../utils/errors.js';

export const postOpenclawAction = async (req, res, next) => {
  try {
    const body = req.body || {};
    const phone = body.phone;
    const actionName = String(body.action || '').trim();
    const phoneOptional =
      actionName === 'ping' || actionName === 'list_roles';
    if (!phone && !phoneOptional) {
      throw badRequest(
        'phone é obrigatório (exceto em ping e list_roles)',
      );
    }
    const senderPhone =
      req.headers['x-whatsapp-sender']
      || req.headers['x-openclaw-sender-phone']
      || '';

    const result = await openclawBotService.runOpenclawAction({
      phone,
      senderPhone: typeof senderPhone === 'string' ? senderPhone : String(senderPhone || ''),
      action: body.action,
      payload: body.payload,
    });

    if (result.ok === false) {
      return res.status(422).json({
        success: false,
        data: result.data ?? null,
        message: result.message || 'Operação não concluída',
        errors: null,
      });
    }

    return sendSuccess(res, result.data, result.message);
  } catch (error) {
    return next(error);
  }
};
