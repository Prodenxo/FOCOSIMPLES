import { sendSuccess } from '../utils/response.js';
import { badRequest } from '../utils/errors.js';
import { query } from '../config/pg.js';
import {
  buildWhatsappAgentPrefView,
  getWhatsappEngineForUser,
  setWhatsappEngineForUser,
} from '../services/whatsapp-agent-pref.service.js';
import { handleWhatsappBackendAgent } from '../services/whatsapp-backend-agent.service.js';

const hasLinkedPhone = async (userId) => {
  try {
    const { rows } = await query(
      `
      SELECT
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = $1 AND phone IS NOT NULL AND length(regexp_replace(phone, '\\D', '', 'g')) >= 10
        ) AS in_users,
        EXISTS (
          SELECT 1 FROM public.n8n_link
          WHERE user_id = $1 AND user_number IS NOT NULL AND length(regexp_replace(user_number, '\\D', '', 'g')) >= 10
        ) AS in_n8n
      `,
      [userId],
    );
    return Boolean(rows?.[0]?.in_users || rows?.[0]?.in_n8n);
  } catch {
    return false;
  }
};

export const getWhatsappAgentPref = async (req, res, next) => {
  try {
    const userId = req.requesterContext?.userId || req.user?.id;
    const engine = await getWhatsappEngineForUser(userId);
    const phoneLinked = await hasLinkedPhone(userId);
    return sendSuccess(
      res,
      buildWhatsappAgentPrefView({ engine, phoneLinked }),
      'ok',
    );
  } catch (error) {
    return next(error);
  }
};

export const patchWhatsappAgentPref = async (req, res, next) => {
  try {
    const userId = req.requesterContext?.userId || req.user?.id;
    const body = req.body || {};
    let engine = body.engine;
    if (typeof body.openclawEnabled === 'boolean') {
      engine = body.openclawEnabled ? 'openclaw' : 'backend';
    }
    if (!engine) {
      throw badRequest('Informe openclawEnabled ou engine.');
    }
    const saved = await setWhatsappEngineForUser(userId, engine);
    const phoneLinked = await hasLinkedPhone(userId);
    return sendSuccess(
      res,
      buildWhatsappAgentPrefView({ engine: saved, phoneLinked }),
      saved === 'backend'
        ? 'Seu WhatsApp agora usa o robô do backend (teste).'
        : 'Seu WhatsApp voltou para o OpenClaw.',
    );
  } catch (error) {
    return next(error);
  }
};

const loadUserWhatsappPhone = async (userId) => {
  const { rows } = await query(
    `
    SELECT
      (
        SELECT regexp_replace(user_number, '\\D', '', 'g')
        FROM public.n8n_link
        WHERE user_id = $1 AND user_number IS NOT NULL
        LIMIT 1
      ) AS from_link,
      (
        SELECT regexp_replace(phone, '\\D', '', 'g')
        FROM public.users
        WHERE id = $1
      ) AS from_user
    `,
    [userId],
  );
  const digits = String(rows?.[0]?.from_link || rows?.[0]?.from_user || '').trim();
  return digits.length >= 10 ? digits : '';
};

export const previewWhatsappBackendAgent = async (req, res, next) => {
  try {
    const userId = req.requesterContext?.userId || req.user?.id;
    const text = String(req.body?.text || '').trim();
    if (!text) {
      throw badRequest('Escreva uma mensagem para testar.');
    }
    const phone = await loadUserWhatsappPhone(userId);
    if (!phone) {
      throw badRequest('Salve seu WhatsApp no perfil antes de testar.');
    }
    const result = await handleWhatsappBackendAgent({
      phone,
      text,
      deliverWhatsapp: false,
    });
    return sendSuccess(
      res,
      {
        reply: result.reply || '',
        ok: result.ok !== false,
      },
      'ok',
    );
  } catch (error) {
    return next(error);
  }
};
