/** Preços oficiais aproximados (USD / 1M tokens). Ajustar se a OpenAI mudar. */
export const OPENAI_CHAT_USD_PER_MILLION = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4o': { input: 2.5, output: 10 },
};

/** USD por minuto de áudio. */
export const OPENAI_AUDIO_USD_PER_MINUTE = {
  'whisper-1': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
};

export const normalizeOpenAiModel = (raw) => {
  const model = String(raw || '').trim().toLowerCase();
  if (!model) return 'gpt-4o-mini';
  if (model.includes('gpt-4.1-mini')) return 'gpt-4.1-mini';
  if (model.includes('gpt-4.1')) return 'gpt-4.1';
  if (model.includes('gpt-4o-mini-transcribe')) return 'gpt-4o-mini-transcribe';
  if (model.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (model.includes('gpt-4o')) return 'gpt-4o';
  if (model.includes('whisper')) return 'whisper-1';
  return model;
};

export const estimateChatCostUsd = ({
  model,
  promptTokens = 0,
  completionTokens = 0,
}) => {
  const key = normalizeOpenAiModel(model);
  const prices = OPENAI_CHAT_USD_PER_MILLION[key] || OPENAI_CHAT_USD_PER_MILLION['gpt-4o-mini'];
  const input = Math.max(0, Number(promptTokens) || 0);
  const output = Math.max(0, Number(completionTokens) || 0);
  return (input / 1_000_000) * prices.input + (output / 1_000_000) * prices.output;
};

export const estimateAudioCostUsd = ({ model, audioSeconds = 0 }) => {
  const key = normalizeOpenAiModel(model);
  const perMinute = OPENAI_AUDIO_USD_PER_MINUTE[key] || OPENAI_AUDIO_USD_PER_MINUTE['whisper-1'];
  const seconds = Math.max(0, Number(audioSeconds) || 0);
  return (seconds / 60) * perMinute;
};

export const roundUsd = (value) => Math.round((Number(value) || 0) * 1_000_000) / 1_000_000;

/** Aproximação de tokens para texto em português (~3 caracteres / token). */
export const estimateTokensFromText = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 3));
};

export const estimateUsageFromTexts = ({
  promptText = '',
  completionText = '',
  extraPromptTokens = 0,
} = {}) => {
  const promptTokens = estimateTokensFromText(promptText) + Math.max(0, Number(extraPromptTokens) || 0);
  const completionTokens = estimateTokensFromText(completionText);
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };
};

export const hasOpenAiUsageCounts = (usage) => {
  const total = Number(usage?.total_tokens) || 0;
  const prompt = Number(usage?.prompt_tokens) || 0;
  const completion = Number(usage?.completion_tokens) || 0;
  return total > 0 || prompt > 0 || completion > 0;
};
