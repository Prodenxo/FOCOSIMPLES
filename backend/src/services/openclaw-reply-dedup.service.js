import { normalizeWhatsappPhoneDigits } from '../utils/whatsapp-phone.js';

/**
 * O Midas entrega a resposta empurrando `send_text_whatsapp` no backend, enquanto o
 * relay ainda pode capturar o mesmo texto pelo histórico da sessão. Sem esta trava o
 * usuário receberia a mensagem duas vezes.
 *
 * Estado em memória: um único processo atende tanto o push quanto o webhook.
 */

const DEFAULT_WINDOW_MS = 120_000;

/** @type {Map<string, number>} */
const pushedAt = new Map();

/** @type {Map<string, number>} */
const inboundSeenAt = new Map();

const INBOUND_WINDOW_MS = 60_000;

const purgeExpired = (windowMs) => {
  const limit = Date.now() - windowMs;
  for (const [key, at] of pushedAt) {
    if (at < limit) pushedAt.delete(key);
  }
};

/** Registra que o agente já entregou a resposta para este telefone. */
export const markReplyPushed = (phone) => {
  const key = normalizeWhatsappPhoneDigits(phone || '');
  if (!key) return;
  purgeExpired(DEFAULT_WINDOW_MS);
  pushedAt.set(key, Date.now());
};

/**
 * Chaves para reconhecer o mesmo inbound mesmo quando a Z-API muda o messageId
 * no retry. Sempre inclui telefone+texto (janela curta).
 * @param {{ phone?: string, text?: string, messageId?: string | null }} parsed
 * @returns {string[]}
 */
export const buildInboundDedupKeys = (parsed) => {
  const keys = [];
  const messageId = String(parsed?.messageId || '').trim();
  if (messageId) keys.push(`id:${messageId}`);
  const phone = normalizeWhatsappPhoneDigits(parsed?.phone || '');
  const text = String(parsed?.text || '').trim().toLowerCase();
  if (phone && text) keys.push(`txt:${phone}:${text}`);
  return keys;
};

/**
 * A Z-API reenvia o webhook se a primeira chamada demora. Marca as chaves na
 * hora: qualquer chave já vista → duplicata.
 * @returns {boolean} true se esta é a primeira vez
 */
export const claimInboundMessage = (messageIdOrKeys, windowMs = INBOUND_WINDOW_MS) => {
  const keys = Array.isArray(messageIdOrKeys)
    ? messageIdOrKeys.map((k) => String(k || '').trim()).filter(Boolean)
    : [String(messageIdOrKeys || '').trim()].filter(Boolean);
  if (keys.length === 0) return true;
  const now = Date.now();
  const limit = now - windowMs;
  for (const [id, at] of inboundSeenAt) {
    if (at < limit) inboundSeenAt.delete(id);
  }
  let seen = false;
  for (const key of keys) {
    if (inboundSeenAt.has(key)) seen = true;
    else inboundSeenAt.set(key, now);
  }
  return !seen;
};

export const consumeReplyPushed = (phone, windowMs = DEFAULT_WINDOW_MS) => {
  const key = normalizeWhatsappPhoneDigits(phone || '');
  if (!key) return false;
  const at = pushedAt.get(key);
  if (at == null) return false;
  pushedAt.delete(key);
  return at >= Date.now() - windowMs;
};
