import { env } from '../config/env.js';
import { extractZapiInboundText } from './zapi-inbound-text.service.js';

/**
 * Extrai telefone e texto do callback Z-API "Ao receber" (ReceivedCallback).
 * @param {unknown} raw
 * @returns {{
 *   ignored: true,
 *   reason: string
 * } | {
 *   ignored: false,
 *   phone: string,
 *   text: string,
 *   messageId: string | null,
 *   instanceId: string | null,
 *   isGroup: boolean
 * }}
 */
export const parseZapiInbound = (raw) => {
  const body = unwrapZapiBody(raw);
  if (!body || typeof body !== 'object') {
    return { ignored: true, reason: 'empty_body' };
  }

  const type = String(body.type || '').trim();
  if (type && type !== 'ReceivedCallback') {
    return { ignored: true, reason: `type_${type}` };
  }

  if (body.fromMe === true) {
    return { ignored: true, reason: 'from_me' };
  }

  if (body.isGroup === true) {
    return { ignored: true, reason: 'group' };
  }

  const phone = normalizeZapiPhone(body.phone);
  if (!phone) {
    return { ignored: true, reason: 'no_phone' };
  }

  const text = extractZapiInboundText(body);

  const hasAudio = Boolean(
    body.audio
    && typeof body.audio === 'object'
    && String(/** @type {Record<string, unknown>} */ (body.audio).audioUrl || '').trim(),
  );

  return {
    ignored: false,
    phone,
    text,
    hasAudio,
    messageId: body.messageId != null ? String(body.messageId) : null,
    instanceId: body.instanceId != null ? String(body.instanceId) : null,
    isGroup: Boolean(body.isGroup),
  };
};

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
const unwrapZapiBody = (raw) => {
  if (raw == null) return null;
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') {
    return /** @type {Record<string, unknown>} */ (raw[0]);
  }
  if (typeof raw === 'object') {
    return /** @type {Record<string, unknown>} */ (raw);
  }
  return null;
};

/**
 * @param {unknown} value
 * @returns {string}
 */
const normalizeZapiPhone = (value) => {
  if (value == null) return '';
  return String(value).replace(/\D/g, '');
};

/**
 * Encaminha payload normalizado para n8n / OpenClaw / outro orquestrador (POST JSON).
 * @param {{ phone: string, text: string, messageId: string | null, instanceId: string | null }} normalized
 * @returns {Promise<void>}
 */
export const relayZapiInbound = async (normalized) => {
  const url = (env.OPENCLAW_ZAPI_RELAY_URL || '').trim();
  if (!url) return;

  const secret = (env.OPENCLAW_ZAPI_RELAY_SECRET || '').trim();
  const timeoutMs = Math.min(
    Math.max(Number(env.OPENCLAW_ZAPI_RELAY_TIMEOUT_MS || 8000) || 8000, 1000),
    60_000,
  );

  const payload = {
    source: 'zapi',
    phone: normalized.phone,
    /** Mesmo valor — para o gateway OpenClaw injetar no 1º arg do mf-curl.sh */
    mandatorySenderPhone: normalized.phone,
    mfCurlFirstArg: normalized.phone,
    /** Texto já transcrito (nota de voz) ou mensagem escrita — o agente deve executar, não perguntar o que fazer. */
    text: normalized.text,
    messageType: normalized.hasAudio ? 'transcribed_voice' : 'text',
    messageId: normalized.messageId,
    instanceId: normalized.instanceId,
    receivedAt: new Date().toISOString(),
    agentHint:
      `REMETENTE_WHATSAPP=${normalized.phone}. O 1º argumento de mf-curl.sh DEVE ser exatamente ${normalized.phone}. `
      + 'Nunca uses número de outro chat nem exemplos do SOUL.',
  };

  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error('[ZAPI] relay HTTP', res.status, t.slice(0, 500));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error('[ZAPI] relay falhou:', msg);
  } finally {
    clearTimeout(timer);
  }
};
