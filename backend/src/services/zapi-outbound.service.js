import { env } from '../config/env.js';
import { badRequest, serviceUnavailable } from '../utils/errors.js';

const DEFAULT_BASE = 'https://api.z-api.io';

export const normalizeZapiPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
};

const zapiConfig = () => {
  const instanceId = (env.ZAPI_INSTANCE_ID || '').trim();
  const instanceToken = (env.ZAPI_TOKEN || '').trim();
  const clientToken = (env.ZAPI_CLIENT_TOKEN || '').trim();
  const baseUrl = (env.ZAPI_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  return { instanceId, instanceToken, clientToken, baseUrl };
};

export const isZapiOutboundConfigured = () => {
  const { instanceId, instanceToken, clientToken } = zapiConfig();
  return Boolean(instanceId && instanceToken && clientToken);
};

const buildZapiUrl = (pathSuffix) => {
  const { instanceId, instanceToken, baseUrl } = zapiConfig();
  return `${baseUrl}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(instanceToken)}/${pathSuffix}`;
};

const zapiHeaders = () => {
  const { clientToken } = zapiConfig();
  return {
    'Content-Type': 'application/json',
    'Client-Token': clientToken,
  };
};

const parseZapiBody = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
};

const assertZapiOk = async (response, actionLabel) => {
  const body = await parseZapiBody(response);
  if (response.ok) {
    return { status: response.status, body };
  }
  const msg =
    (typeof body === 'object' && body && (body.message || body.error)) ||
    (typeof body === 'string' ? body : null) ||
    `Z-API ${actionLabel} falhou (HTTP ${response.status})`;
  throw serviceUnavailable(String(msg));
};

/** Segundos de "Digitando..." antes de entregar o texto (1–15, limite da Z-API). */
export const resolveZapiDelayTyping = (message) => {
  const len = String(message || '').trim().length;
  if (!len) return 1;
  return Math.min(4, Math.max(1, Math.ceil(len / 80)));
};

const postZapiSilent = async (pathSuffix, payload) => {
  if (!isZapiOutboundConfigured()) return false;
  try {
    const response = await fetch(buildZapiUrl(pathSuffix), {
      method: 'POST',
      headers: zapiHeaders(),
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
};

/** Marca o chat como lido (dois ticks). Não lança. */
export const sendZapiReadChat = async (phone) => {
  const target = normalizeZapiPhone(phone);
  if (!target) return false;
  return postZapiSilent('read-chat', { phone: target, action: 'read' });
};

/**
 * Liga o balão "Digitando..." no WhatsApp. A Z-API oficial só documenta
 * delayTyping no send-text; algumas instâncias ainda aceitam presença.
 * Não lança: se o endpoint não existir, o delayTyping do envio cobre.
 */
export const sendZapiTyping = async (phone) => {
  const target = normalizeZapiPhone(phone);
  if (!target) return false;
  const hits = await Promise.all([
    postZapiSilent('send-chat-presence', { phone: target, status: 'COMPOSING' }),
    postZapiSilent('send-chat-state', { phone: target, chatState: 'composing' }),
    postZapiSilent('send-typing', { phone: target }),
  ]);
  return hits.some(Boolean);
};

/** Dispara o balão na hora — não espera resposta da Z-API. */
export const startZapiTypingSoon = (phone) => {
  sendZapiReadChat(phone).catch(() => {});
  sendZapiTyping(phone).catch(() => {});
};

/**
 * Mantém o "Digitando..." enquanto o OpenClaw processa (~7s por pulso).
 * @returns {() => void} para parar
 */
export const startZapiTypingPulse = (phone) => {
  let stopped = false;
  const pulse = () => {
    if (stopped) return;
    sendZapiTyping(phone).catch(() => {});
  };
  const timer = setInterval(pulse, 7_000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
};

/** Texto simples (lembretes de agenda, mensagem antes do PDF). */
export const sendZapiText = async ({ phone, message, delayTyping }) => {
  if (!isZapiOutboundConfigured()) {
    throw badRequest(
      'Z-API não configurada: defina ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN no backend.',
    );
  }
  const target = normalizeZapiPhone(phone);
  const text = String(message || '').trim();
  if (!target) throw badRequest('Telefone inválido para Z-API');
  if (!text) throw badRequest('Mensagem vazia');

  const typingSeconds = Number.isFinite(Number(delayTyping))
    ? Math.min(15, Math.max(1, Math.round(Number(delayTyping))))
    : resolveZapiDelayTyping(text);

  const response = await fetch(buildZapiUrl('send-text'), {
    method: 'POST',
    headers: zapiHeaders(),
    body: JSON.stringify({
      phone: target,
      message: text,
      delayTyping: typingSeconds,
    }),
  });
  return assertZapiOk(response, 'send-text');
};

/** PDF em base64 (sem prefixo data:…) — opcional mensagem de texto antes. */
export const sendZapiPdf = async ({ phone, pdfBase64, fileName, message }) => {
  if (!isZapiOutboundConfigured()) {
    throw badRequest('Z-API não configurada');
  }
  const target = normalizeZapiPhone(phone);
  const rawB64 = String(pdfBase64 || '').replace(/^data:application\/pdf;base64,/, '');
  if (!target) throw badRequest('Telefone inválido para Z-API');
  if (!rawB64) throw badRequest('PDF vazio');

  if (message && String(message).trim()) {
    await sendZapiText({ phone: target, message: String(message).trim() });
  }

  let safeFileName = String(fileName || 'documento').trim() || 'documento';
  safeFileName = safeFileName.replace(/\.pdf$/i, '');
  safeFileName = `${safeFileName}.pdf`;

  const document = `data:application/pdf;base64,${rawB64}`;
  const response = await fetch(buildZapiUrl('send-document/pdf'), {
    method: 'POST',
    headers: zapiHeaders(),
    body: JSON.stringify({
      phone: target,
      document,
      fileName: safeFileName,
    }),
  });
  return assertZapiOk(response, 'send-document/pdf');
};
