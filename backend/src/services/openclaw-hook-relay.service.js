import { env } from '../config/env.js';

/**
 * @param {string} relayUrlRaw
 * @param {string} publicOriginRaw
 * @returns {string}
 */
export const resolveOpenclawHooksAgentUrlFrom = (relayUrlRaw, publicOriginRaw = '') => {
  const raw = String(relayUrlRaw || '').trim().replace(/\/$/, '');
  if (!raw) return '';

  if (/\/hooks\/agent$/i.test(raw)) return raw;

  if (/\/hooks$/i.test(raw)) return `${raw}/agent`;

  const origin = String(publicOriginRaw || '').trim().replace(/\/$/, '');
  if (origin) return `${origin}/hooks/agent`;

  return raw;
};

/**
 * URL do POST /hooks/agent (sync Z-API → OpenClaw → Z-API).
 * @returns {string}
 */
export const resolveOpenclawHooksAgentUrl = () =>
  resolveOpenclawHooksAgentUrlFrom(env.OPENCLAW_ZAPI_RELAY_URL, env.OPENCLAW_PUBLIC_ORIGIN);

export const isOpenclawZapiRelaySyncEnabled = () =>
  String(env.OPENCLAW_ZAPI_RELAY_SYNC || 'true').trim().toLowerCase() !== 'false';

/**
 * @param {number} fallbackMs
 */
export const getOpenclawRelayTimeoutMs = (fallbackMs = 120_000) => {
  const configured = Number(env.OPENCLAW_ZAPI_RELAY_TIMEOUT_MS || 0);
  const ms = Number.isFinite(configured) && configured > 0 ? configured : fallbackMs;
  return Math.min(Math.max(ms, 5_000), 300_000);
};

/**
 * @param {{ phone: string, text: string, messageId?: string | null, hasAudio?: boolean }} normalized
 */
export const buildOpenclawHookAgentPayload = (normalized) => {
  const phone = String(normalized.phone || '').replace(/\D/g, '');
  const text = String(normalized.text || '').trim();
  const messageId = normalized.messageId != null ? String(normalized.messageId) : 'nomsg';
  const sessionKey = `hook:zapi:${phone}:${messageId}`;

  const hint =
    `REMETENTE_WHATSAPP=${phone}. O 1º argumento de mf-curl.sh DEVE ser exatamente ${phone}. `
    + 'Nunca uses número de outro chat nem exemplos do SOUL.\n\n';

  const timeoutSeconds = Math.max(5, Math.ceil(getOpenclawRelayTimeoutMs() / 1000));

  return {
    message: `${hint}${text}`,
    sessionKey,
    deliver: false,
    waitForResult: true,
    announceToMain: false,
    timeoutSeconds,
    agentHint:
      `mandatorySenderPhone=${phone}; mfCurlFirstArg=${phone}; source=zapi; `
      + (normalized.hasAudio ? 'messageType=transcribed_voice' : 'messageType=text'),
  };
};

/**
 * @param {unknown} body
 * @returns {string | null}
 */
export const extractOpenclawHookAgentReply = (body) => {
  if (!body || typeof body !== 'object') return null;

  const record = /** @type {Record<string, unknown>} */ (body);
  const nested = record.data && typeof record.data === 'object'
    ? /** @type {Record<string, unknown>} */ (record.data)
    : null;

  const candidates = [
    record.result,
    record.outputText,
    record.replyText,
    record.text,
    record.message,
    nested?.result,
    nested?.outputText,
    nested?.replyText,
  ];

  for (const candidate of candidates) {
    const trimmed = String(candidate ?? '').trim();
    if (trimmed) return trimmed;
  }

  return null;
};

/**
 * @param {unknown} raw
 */
const tryParseJson = async (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  const text = String(raw).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { result: text };
  }
};

/**
 * Relay síncrono: Z-API → OpenClaw /hooks/agent → texto de resposta.
 * @param {{ phone: string, text: string, messageId?: string | null, instanceId?: string | null, hasAudio?: boolean }} normalized
 * @returns {Promise<{
 *   ok: boolean,
 *   mode: 'sync' | 'legacy',
 *   status: string | null,
 *   runId: string | null,
 *   sessionKey: string | null,
 *   replyText: string | null,
 *   httpStatus: number | null,
 *   error: string | null
 * }>}
 */
export const callOpenclawHookAgentSync = async (normalized) => {
  const url = resolveOpenclawHooksAgentUrl();
  if (!url) {
    return {
      ok: false,
      mode: 'sync',
      status: null,
      runId: null,
      sessionKey: null,
      replyText: null,
      httpStatus: null,
      error: 'OPENCLAW_ZAPI_RELAY_URL não configurada',
    };
  }

  const secret = String(env.OPENCLAW_ZAPI_RELAY_SECRET || '').trim();
  const timeoutMs = getOpenclawRelayTimeoutMs();
  const payload = buildOpenclawHookAgentPayload(normalized);

  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers['x-openclaw-token'] = secret;
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

    const rawBody = await res.text().catch(() => '');
    const body = await tryParseJson(rawBody);

    if (!res.ok) {
      const errText = rawBody.slice(0, 500) || `HTTP ${res.status}`;
      return {
        ok: false,
        mode: 'sync',
        status: body && typeof body === 'object' ? String(/** @type {Record<string, unknown>} */ (body).status || '') : null,
        runId: null,
        sessionKey: null,
        replyText: null,
        httpStatus: res.status,
        error: errText,
      };
    }

    const record = body && typeof body === 'object'
      ? /** @type {Record<string, unknown>} */ (body)
      : {};
    const status = String(record.status || 'completed').trim() || 'completed';
    const agentError = String(record.agentError || record.error || '').trim();

    if (agentError) {
      return {
        ok: false,
        mode: 'sync',
        status,
        runId: record.runId != null ? String(record.runId) : null,
        sessionKey: record.sessionKey != null ? String(record.sessionKey) : null,
        replyText: null,
        httpStatus: res.status,
        error: agentError,
      };
    }

    const replyText = extractOpenclawHookAgentReply(body);

    return {
      ok: status === 'completed' || status === 'accepted' || Boolean(replyText),
      mode: 'sync',
      status,
      runId: record.runId != null ? String(record.runId) : null,
      sessionKey: record.sessionKey != null ? String(record.sessionKey) : null,
      replyText,
      httpStatus: res.status,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      mode: 'sync',
      status: null,
      runId: null,
      sessionKey: null,
      replyText: null,
      httpStatus: null,
      error: msg,
    };
  } finally {
    clearTimeout(timer);
  }
};
