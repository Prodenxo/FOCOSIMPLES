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
  const sessionKey = `hook:zapi:${phone}`;

  const hint =
    `Conversa WhatsApp já em andamento. Responda SEMPRE em português do Brasil. `
    + `PROIBIDO inglês. PROIBIDO dizer que acabou de ligar, "I just came online", `
    + `"setting up my identity" ou se apresentar de novo. Você é o Midas do Foco Simples — vá direto ao pedido.\n`
    + `REMETENTE_WHATSAPP=${phone}. O 1º argumento de mf-curl.sh DEVE ser exatamente ${phone}. `
    + 'Nunca uses número de outro chat nem exemplos do SOUL.\n\n';

  const timeoutSeconds = Math.max(5, Math.ceil(getOpenclawRelayTimeoutMs() / 1000));

  const useSessionKey =
    String(env.OPENCLAW_ZAPI_RELAY_SESSION_KEY || 'true').trim().toLowerCase() !== 'false';

  /** OpenClaw antigo ignora waitForResult — sessionKey estável permite poll de history. */
  return {
    message: `${hint}${text}`,
    ...(useSessionKey ? { sessionKey } : {}),
    deliver: false,
    waitForResult: true,
    announceToMain: false,
    resultMode: 'assistant_text',
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
/**
 * Texto da resposta OpenAI-compatível (`POST /v1/chat/completions`).
 * @param {unknown} body
 * @returns {string | null}
 */
export const extractOpenclawChatCompletionReply = (body) => {
  if (!body || typeof body !== 'object') return null;
  const record = /** @type {Record<string, unknown>} */ (body);
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0] && typeof choices[0] === 'object'
    ? /** @type {Record<string, unknown>} */ (choices[0])
    : null;
  const message = first?.message && typeof first.message === 'object'
    ? /** @type {Record<string, unknown>} */ (first.message)
    : null;
  const content = flattenMessageContent(message?.content ?? first?.text ?? record.content);
  return content || null;
};

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

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * @param {unknown} content
 */
const flattenMessageContent = (content) => {
  if (content == null) return '';
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const block = /** @type {Record<string, unknown>} */ (part);
          return String(block.text || block.content || '');
        }
        return '';
      })
      .join('')
      .trim();
  }
  if (typeof content === 'object') {
    const record = /** @type {Record<string, unknown>} */ (content);
    return String(record.text || record.content || '').trim();
  }
  return String(content).trim();
};

/**
 * @param {unknown} historyBody
 * @param {string | null} runId
 */
export const extractAssistantTextFromSessionHistory = (historyBody, runId = null) => {
  if (!historyBody || typeof historyBody !== 'object') return null;
  const record = /** @type {Record<string, unknown>} */ (historyBody);
  const messages = Array.isArray(record.messages)
    ? record.messages
    : Array.isArray(record.data)
      ? record.data
      : [];

  const runToken = runId ? String(runId) : '';
  let lastAssistant = '';

  for (const item of messages) {
    if (!item || typeof item !== 'object') continue;
    const msg = /** @type {Record<string, unknown>} */ (item);
    const role = String(msg.role || msg.type || '').toLowerCase();
    if (role !== 'assistant') continue;

    const serialized = JSON.stringify(msg);
    if (runToken && !serialized.includes(runToken)) {
      const msgRunId = String(msg.runId || msg.run_id || '');
      if (msgRunId && msgRunId !== runToken) continue;
    }

    const text = flattenMessageContent(msg.content ?? msg.text ?? msg.message);
    if (text) lastAssistant = text;
  }

  return lastAssistant || null;
};

/**
 * Poll GET /sessions/:key/history quando waitForResult devolve só runId (OpenClaw async).
 * @param {{
 *   sessionKey: string,
 *   runId: string | null,
 *   secret: string,
 *   timeoutMs: number,
 *   pollIntervalMs?: number
 * }} params
 */
export const pollOpenclawSessionHistoryReply = async ({
  sessionKey,
  runId,
  secret,
  timeoutMs,
  pollIntervalMs = 2500,
}) => {
  const origin = String(env.OPENCLAW_PUBLIC_ORIGIN || '').trim().replace(/\/$/, '');
  if (!origin || !sessionKey) return null;

  /**
   * Sem `x-openclaw-scopes` o gateway resolve "nenhum escopo pedido" e recusa a leitura
   * com 403 (`missing scope: operator.read`). Declaramos só a leitura.
   */
  const headers = /** @type {Record<string, string>} */ ({
    Accept: 'application/json',
    'x-openclaw-scopes': 'operator.read',
  });
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers['x-openclaw-token'] = secret;
  }

  const paths = [
    `/sessions/${encodeURIComponent(sessionKey)}/history?limit=30`,
    `/api/sessions/${encodeURIComponent(sessionKey)}/history?limit=30`,
  ];

  const deadline = Date.now() + Math.max(timeoutMs, 10_000);
  const loggedStatuses = new Set();

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    for (const path of paths) {
      try {
        const res = await fetch(`${origin}${path}`, { headers });
        if (!res.ok) {
          const seen = `${path}:${res.status}`;
          if (!loggedStatuses.has(seen)) {
            loggedStatuses.add(seen);
            const hint = res.status === 401
              ? ' — token recusado: OPENCLAW_GATEWAY_TOKEN deve ser o gateway.auth.token (não o de hooks).'
              : res.status === 403
                ? ' — token aceito mas escopo recusado: confira o header x-openclaw-scopes: operator.read.'
                : ' — resposta não será lida por aqui.';
            // eslint-disable-next-line no-console
            console.warn(`[ZAPI] OpenClaw history HTTP ${res.status} em ${path}${hint}`);
          }
          continue;
        }
        const body = await res.json();
        const text = extractAssistantTextFromSessionHistory(body, runId);
        if (text) return text;
      } catch {
        /* retry */
      }
    }
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
 * Na 2026.4.x o GET /sessions/.../history recusa bearer (403) de propósito.
 * POST /v1/chat/completions nessa mesma série já devolve o texto do agente.
 * @param {{ phone: string, text: string, messageId?: string | null, hasAudio?: boolean }} normalized
 */
export const callOpenclawChatCompletions = async (normalized) => {
  const origin = String(env.OPENCLAW_PUBLIC_ORIGIN || '').trim().replace(/\/$/, '');
  const secret = String(env.OPENCLAW_GATEWAY_TOKEN || '').trim();
  const phone = String(normalized.phone || '').replace(/\D/g, '');
  const sessionKey = phone ? `hook:zapi:${phone}` : null;

  if (!origin || !secret) {
    return {
      ok: false,
      mode: 'sync',
      status: null,
      runId: null,
      sessionKey,
      replyText: null,
      httpStatus: null,
      error: 'OPENCLAW_PUBLIC_ORIGIN ou OPENCLAW_GATEWAY_TOKEN ausente',
    };
  }

  const timeoutMs = getOpenclawRelayTimeoutMs();
  const payload = buildOpenclawHookAgentPayload(normalized);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(`${origin}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${secret}`,
        ...(sessionKey ? { 'x-openclaw-session-key': sessionKey } : {}),
      },
      body: JSON.stringify({
        model: 'openclaw/default',
        user: phone ? `zapi:${phone}` : undefined,
        messages: [{ role: 'user', content: payload.message }],
      }),
      signal: ac.signal,
    });

    const rawBody = await res.text().catch(() => '');
    const body = await tryParseJson(rawBody);

    if (!res.ok) {
      return {
        ok: false,
        mode: 'sync',
        status: null,
        runId: null,
        sessionKey,
        replyText: null,
        httpStatus: res.status,
        error: rawBody.slice(0, 500) || `HTTP ${res.status}`,
      };
    }

    const replyText = extractOpenclawChatCompletionReply(body);
    return {
      ok: Boolean(replyText),
      mode: 'sync',
      status: replyText ? 'completed' : 'empty',
      runId: body && typeof body === 'object' && /** @type {Record<string, unknown>} */ (body).id != null
        ? String(/** @type {Record<string, unknown>} */ (body).id)
        : null,
      sessionKey,
      replyText,
      httpStatus: res.status,
      error: replyText ? null : 'chat/completions sem texto de assistente',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      mode: 'sync',
      status: null,
      runId: null,
      sessionKey,
      replyText: null,
      httpStatus: null,
      error: msg,
    };
  } finally {
    clearTimeout(timer);
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
  const gatewayToken = String(env.OPENCLAW_GATEWAY_TOKEN || '').trim();
  const publicOrigin = String(env.OPENCLAW_PUBLIC_ORIGIN || '').trim();
  if (gatewayToken && publicOrigin) {
    const viaChat = await callOpenclawChatCompletions(normalized);
    if (viaChat.replyText) {
      // eslint-disable-next-line no-console
      console.info('[ZAPI] resposta OpenClaw via /v1/chat/completions');
      return viaChat;
    }
    if (viaChat.httpStatus === 404) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ZAPI] /v1/chat/completions desligado — no OpenClaw rode: openclaw config set gateway.http.endpoints.chatCompletions.enabled true',
      );
    } else if (viaChat.error) {
      // eslint-disable-next-line no-console
      console.warn('[ZAPI] /v1/chat/completions falhou:', viaChat.httpStatus, viaChat.error);
    }
  }

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
    const status = String(record.status || (record.ok === true ? 'accepted' : 'completed')).trim() || 'completed';
    const agentError = String(record.agentError || record.error || '').trim();
    const runId = record.runId != null ? String(record.runId) : null;
    let sessionKey = record.sessionKey != null ? String(record.sessionKey) : null;
    const phone = String(normalized.phone || '').replace(/\D/g, '');

    if (!sessionKey && phone) {
      sessionKey = `hook:zapi:${phone}`;
    }

    if (agentError) {
      return {
        ok: false,
        mode: 'sync',
        status,
        runId,
        sessionKey,
        replyText: null,
        httpStatus: res.status,
        error: agentError,
      };
    }

    let replyText = extractOpenclawHookAgentReply(body);

    if (!replyText && sessionKey && String(env.OPENCLAW_ZAPI_RELAY_POLL_HISTORY || 'true').toLowerCase() !== 'false') {
      const pollMs = Math.max(timeoutMs - 3000, 15_000);
      // eslint-disable-next-line no-console
      console.info('[ZAPI] OpenClaw async — polling session history:', sessionKey);
      replyText = await pollOpenclawSessionHistoryReply({
        sessionKey,
        runId,
        secret: String(env.OPENCLAW_GATEWAY_TOKEN || '').trim() || secret,
        timeoutMs: pollMs,
      });
    }

    return {
      ok: Boolean(replyText) || status === 'completed' || Boolean(runId),
      mode: 'sync',
      status: replyText ? 'completed' : status,
      runId,
      sessionKey,
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
