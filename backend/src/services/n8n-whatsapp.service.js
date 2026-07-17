import { env } from '../config/env.js';
import { badRequest, serviceUnavailable } from '../utils/errors.js';

const buildWebhookHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (env.N8N_WHATSAPP_WEBHOOK_SECRET) {
    headers['x-webhook-secret'] = env.N8N_WHATSAPP_WEBHOOK_SECRET;
  }
  return headers;
};

const parseWebhookResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
};

const normalizeWebhookErrorMessage = (body, response) => {
  const rawMessage = typeof body === 'string' ? body : body?.message;
  if (typeof rawMessage === 'string') {
    const normalized = rawMessage.toLowerCase();
    if (normalized.includes('webhook') && normalized.includes('not registered')) {
      return 'Webhook do WhatsApp não está ativo/registrado. Verifique o endpoint no n8n.';
    }
    if (normalized.includes('webhook') && normalized.includes('not found')) {
      return 'Webhook do WhatsApp não está ativo/registrado. Verifique o endpoint no n8n.';
    }
  }
  if (response?.status === 404) {
    return 'Webhook do WhatsApp não está ativo/registrado. Verifique o endpoint no n8n.';
  }
  return rawMessage;
};

/** Legado: POST para workflow n8n. Preferir `whatsapp-outbound.service.js` (Z-API directo). */
export const sendWhatsappViaN8nWebhook = async (payload) => {
  const webhookUrl = env.N8N_WHATSAPP_WEBHOOK_URL;
  if (!webhookUrl) {
    throw badRequest('Webhook do WhatsApp não configurado');
  }
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: buildWebhookHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseWebhookResponse(response);
  if (!response.ok) {
    const message = normalizeWebhookErrorMessage(body, response);
    throw serviceUnavailable(message || 'Falha ao acionar webhook do WhatsApp');
  }
  return {
    status: response.status,
    body,
  };
};

export {
  sendWhatsappMessage,
  isWhatsappOutboundConfigured,
  getWhatsappOutboundChannel,
} from './whatsapp-outbound.service.js';
