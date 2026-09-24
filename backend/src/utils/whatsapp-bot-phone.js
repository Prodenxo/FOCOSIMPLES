import { env } from '../config/env.js';
import {
  canonicalizeWhatsappPhone,
  expandWhatsappPhoneLookupVariants,
} from './whatsapp-phone.js';

/**
 * Números das nossas próprias instâncias WhatsApp (Z-API).
 * Env `WHATSAPP_BOT_PHONES`: lista separada por vírgula.
 * @param {string} [raw]
 * @returns {string[]} canónicos, sem repetições
 */
export const listWhatsappBotPhones = (raw = env.WHATSAPP_BOT_PHONES) => {
  const canonical = String(raw ?? '')
    .split(',')
    .map((entry) => canonicalizeWhatsappPhone(entry))
    .filter(Boolean);
  return [...new Set(canonical)];
};

/**
 * O agente às vezes passa o número do próprio robô em vez do remetente — isso
 * nunca resolve utilizador e confunde o cliente. Compara pelas variantes de
 * lookup para pegar também o número sem o nono dígito.
 * @param {string} phone
 * @param {string} [raw] — lista de números do robô (default: env)
 */
export const isWhatsappBotPhone = (phone, raw) => {
  const botPhones = listWhatsappBotPhones(raw);
  if (botPhones.length === 0) return false;

  const variants = new Set(expandWhatsappPhoneLookupVariants(phone));
  const canonical = canonicalizeWhatsappPhone(phone);
  if (canonical) variants.add(canonical);
  if (variants.size === 0) return false;

  return botPhones.some((bot) => variants.has(bot));
};
