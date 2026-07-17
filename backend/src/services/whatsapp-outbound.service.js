import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';
import { isZapiOutboundConfigured, sendZapiPdf, sendZapiText } from './zapi-outbound.service.js';
import { sendWhatsappViaN8nWebhook } from './n8n-whatsapp.service.js';

const preferZapi = () => {
  const mode = String(env.WHATSAPP_OUTBOUND_MODE || 'auto').trim().toLowerCase();
  if (mode === 'zapi') return true;
  if (mode === 'n8n') return false;
  return isZapiOutboundConfigured();
};

export const getWhatsappOutboundChannel = () => {
  if (preferZapi() && isZapiOutboundConfigured()) return 'zapi';
  if ((env.N8N_WHATSAPP_WEBHOOK_URL || '').trim()) return 'n8n';
  return null;
};

export const isWhatsappOutboundConfigured = () => Boolean(getWhatsappOutboundChannel());

/**
 * Envio unificado: Z-API directo (preferido) ou webhook n8n (legado).
 * @param {{ phone?: string, message?: string, pdfBase64?: string, fileName?: string, [key: string]: unknown }} payload
 */
export const sendWhatsappMessage = async (payload = {}) => {
  const phone = payload.phone;
  const message = payload.message;
  const pdfBase64 = payload.pdfBase64;
  const fileName = payload.fileName;

  if (preferZapi() && isZapiOutboundConfigured()) {
    if (pdfBase64) {
      const result = await sendZapiPdf({
        phone,
        pdfBase64,
        fileName,
        message,
      });
      return { channel: 'zapi', ...result };
    }
    if (message) {
      const result = await sendZapiText({ phone, message });
      return { channel: 'zapi', ...result };
    }
    throw badRequest('Payload WhatsApp vazio (informe message ou pdfBase64)');
  }

  if ((env.N8N_WHATSAPP_WEBHOOK_URL || '').trim()) {
    const result = await sendWhatsappViaN8nWebhook(payload);
    return { channel: 'n8n', ...result };
  }

  throw badRequest(
    'WhatsApp não configurado: defina ZAPI_INSTANCE_ID + ZAPI_TOKEN + ZAPI_CLIENT_TOKEN, ou N8N_WHATSAPP_WEBHOOK_URL.',
  );
};
