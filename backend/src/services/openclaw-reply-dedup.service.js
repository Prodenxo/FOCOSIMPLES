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

const INBOUND_WINDOW_MS = 180_000;

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
 * Consome o registro: devolve `true` uma única vez se o agente entregou a resposta
 * dentro da janela.
 */
/**
 * A Z-API reenvia o webhook se a primeira chamada demora (o OpenClaw pode levar
 * dezenas de segundos). Marca o messageId na hora: a segunda cópia é ignorada.
 * @returns {boolean} true se esta é a primeira vez que vemos o id
 */
export const claimInboundMessage = (messageId, windowMs = INBOUND_WINDOW_MS) => {
  const key = String(messageId || '').trim();
  if (!key) return true;
  const now = Date.now();
  const limit = now - windowMs;
  for (const [id, at] of inboundSeenAt) {
    if (at < limit) inboundSeenAt.delete(id);
  }
  if (inboundSeenAt.has(key)) return false;
  inboundSeenAt.set(key, now);
  return true;
};

export const consumeReplyPushed = (phone, windowMs = DEFAULT_WINDOW_MS) => {
  const key = normalizeWhatsappPhoneDigits(phone || '');
  if (!key) return false;
  const at = pushedAt.get(key);
  if (at == null) return false;
  pushedAt.delete(key);
  return at >= Date.now() - windowMs;
};
