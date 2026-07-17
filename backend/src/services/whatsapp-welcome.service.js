import { env } from '../config/env.js';
import { isGreetingOnlyMessage } from './openclaw-chat-guard.service.js';
import {
  isWhatsappOutboundConfigured,
  sendWhatsappMessage,
} from './whatsapp-outbound.service.js';

const DEFAULT_WELCOME =
  'Olá! Sou o *Midas*, assistente do *Meu Financeiro*. '
  + 'Ajudo com lançamentos, categorias, MEI, DAS, NFSe e agenda. '
  + 'O que você gostaria de fazer?';

const DEDUP_MS = 6 * 60 * 60 * 1000;

/** @type {Map<string, number>} */
const welcomeSentAt = new Map();

export const isWhatsappWelcomeEnabled = () =>
  String(env.WHATSAPP_WELCOME_ENABLED || 'true').toLowerCase() !== 'false';

export const getWhatsappWelcomeMessage = () =>
  String(env.WHATSAPP_WELCOME_MESSAGE || '').trim() || DEFAULT_WELCOME;

/**
 * Envia boas-vindas pela Z-API em saudações curtas (oi, tudo bom, etc.).
 * O `/new` no OpenClaw só reinicia sessão no painel — não envia WhatsApp.
 *
 * @param {{ phone: string, text: string }} params
 * @returns {Promise<{ sent: boolean, skipRelay: boolean, reason: string | null }>}
 */
export const maybeSendWhatsappWelcome = async ({ phone, text }) => {
  if (!isWhatsappWelcomeEnabled() || !isWhatsappOutboundConfigured()) {
    return { sent: false, skipRelay: false, reason: 'disabled_or_no_outbound' };
  }

  if (!isGreetingOnlyMessage(text)) {
    return { sent: false, skipRelay: false, reason: 'not_greeting' };
  }

  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    return { sent: false, skipRelay: false, reason: 'no_phone' };
  }

  const prev = welcomeSentAt.get(digits);
  if (prev && Date.now() - prev < DEDUP_MS) {
    return { sent: false, skipRelay: false, reason: 'dedup_recent' };
  }

  await sendWhatsappMessage({
    phone: digits,
    message: getWhatsappWelcomeMessage(),
    source: 'whatsapp_welcome',
  });

  welcomeSentAt.set(digits, Date.now());
  for (const [key, ts] of welcomeSentAt) {
    if (Date.now() - ts >= DEDUP_MS) welcomeSentAt.delete(key);
  }

  return { sent: true, skipRelay: true, reason: 'greeting_welcome_sent' };
};
