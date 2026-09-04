import { env } from '../config/env.js';

const CHAT_TIMEOUT_MS = 45_000;

const CHAT_ENDPOINTS = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
};

export const normalizeWhatsappChatProvider = (raw) => {
  const value = String(raw || '').trim().toLowerCase();
  return value === 'openai' ? 'openai' : 'deepseek';
};

/**
 * Robô WhatsApp (texto): DeepSeek por padrão. OpenAI só se WHATSAPP_CHAT_PROVIDER=openai.
 * Áudio continua em whatsapp-audio-transcription.service.js (OpenAI/Groq).
 */
export const resolveWhatsappChatConfig = () => {
  const provider = normalizeWhatsappChatProvider(
    env.WHATSAPP_CHAT_PROVIDER || process.env.WHATSAPP_CHAT_PROVIDER || 'deepseek',
  );

  if (provider === 'openai') {
    const apiKey = (env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
    const model = (
      env.WHATSAPP_CHAT_MODEL
      || process.env.WHATSAPP_CHAT_MODEL
      || env.OPENAI_WHATSAPP_MODEL
      || process.env.OPENAI_WHATSAPP_MODEL
      || 'gpt-4o-mini'
    ).trim();
    return {
      provider,
      apiKey,
      model,
      endpoint: CHAT_ENDPOINTS.openai,
    };
  }

  const apiKey = (env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '').trim();
  const model = (
    env.WHATSAPP_CHAT_MODEL
    || process.env.WHATSAPP_CHAT_MODEL
    || 'deepseek-chat'
  ).trim();

  return {
    provider: 'deepseek',
    apiKey,
    model,
    endpoint: CHAT_ENDPOINTS.deepseek,
  };
};

export const isWhatsappChatLlmConfigured = () => {
  const { provider, apiKey } = resolveWhatsappChatConfig();
  if (!apiKey) return false;
  return provider === 'deepseek' || provider === 'openai';
};

/**
 * @param {Array<Record<string, unknown>>} messages
 * @param {unknown[]} tools
 */
export const callWhatsappChatLlm = async (messages, tools) => {
  const { provider, apiKey, model, endpoint } = resolveWhatsappChatConfig();
  if (!apiKey) {
    throw new Error(
      provider === 'deepseek'
        ? 'DEEPSEEK_API_KEY ausente'
        : 'OPENAI_API_KEY ausente',
    );
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CHAT_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages,
        tools,
        tool_choice: 'auto',
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = payload?.error?.message || res.statusText;
      throw new Error(`${provider} ${res.status}: ${detail}`);
    }
    return { payload, model, provider };
  } finally {
    clearTimeout(timer);
  }
};
