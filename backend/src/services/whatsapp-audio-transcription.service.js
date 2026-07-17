import { env } from '../config/env.js';

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 45_000;
const TRANSCRIBE_TIMEOUT_MS = 90_000;

const isTruthy = (value) => String(value || '').toLowerCase() === 'true';

export const isWhatsappAudioTranscriptionEnabled = () => {
  const flag = (process.env.WHATSAPP_AUDIO_TRANSCRIPTION_ENABLED
    ?? env.WHATSAPP_AUDIO_TRANSCRIPTION_ENABLED
    ?? 'true').trim();
  if (!isTruthy(flag)) return false;
  return Boolean(resolveTranscriptionApiKey());
};

const resolveTranscriptionApiKey = () => {
  const openai = (
    process.env.WHATSAPP_TRANSCRIPTION_OPENAI_API_KEY
    || process.env.OPENAI_API_KEY
    || env.OPENAI_API_KEY
    || ''
  ).trim();
  if (openai) return { provider: 'openai', apiKey: openai };

  const groq = (process.env.GROQ_API_KEY || env.GROQ_API_KEY || '').trim();
  if (groq) return { provider: 'groq', apiKey: groq };

  return null;
};

/**
 * Extrai URL de áudio do payload Z-API ReceivedCallback.
 * @param {unknown} raw
 * @returns {{ audioUrl: string, mimeType: string } | null}
 */
export const extractZapiAudioFromBody = (raw) => {
  const body = unwrapBody(raw);
  if (!body?.audio || typeof body.audio !== 'object') return null;

  const audio = /** @type {Record<string, unknown>} */ (body.audio);
  const audioUrl = String(audio.audioUrl || audio.url || '').trim();
  if (!audioUrl.startsWith('http')) return null;

  const mimeType = String(audio.mimeType || 'audio/ogg').trim() || 'audio/ogg';
  return { audioUrl, mimeType };
};

const unwrapBody = (raw) => {
  if (raw == null) return null;
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') {
    return /** @type {Record<string, unknown>} */ (raw[0]);
  }
  if (typeof raw === 'object') {
    return /** @type {Record<string, unknown>} */ (raw);
  }
  return null;
};

const extensionForMime = (mimeType) => {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('wav')) return 'wav';
  return 'ogg';
};

/**
 * @param {string} audioUrl
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 */
const downloadZapiAudio = async (audioUrl) => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(audioUrl, { signal: ac.signal });
    if (!res.ok) {
      throw new Error(`download_audio_http_${res.status}`);
    }
    const mimeType = res.headers.get('content-type') || 'audio/ogg';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > MAX_AUDIO_BYTES) {
      throw new Error('download_audio_too_large');
    }
    if (buffer.length === 0) {
      throw new Error('download_audio_empty');
    }
    return { buffer, mimeType };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<string>}
 */
const transcribeWithOpenAiCompatible = async (buffer, mimeType) => {
  const creds = resolveTranscriptionApiKey();
  if (!creds) {
    throw new Error('transcription_not_configured');
  }

  const baseUrl = creds.provider === 'groq'
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : 'https://api.openai.com/v1/audio/transcriptions';

  const model = creds.provider === 'groq' ? 'whisper-large-v3' : 'gpt-4o-mini-transcribe';

  const ext = extensionForMime(mimeType);
  const form = new FormData();
  form.append(
    'file',
    new Blob([buffer], { type: mimeType || 'audio/ogg' }),
    `voice.${ext}`,
  );
  form.append('model', model);
  form.append('language', 'pt');
  form.append('response_format', 'json');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TRANSCRIBE_TIMEOUT_MS);
  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: form,
      signal: ac.signal,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = typeof payload === 'object' && payload
        ? String(payload.error?.message || payload.message || JSON.stringify(payload)).slice(0, 300)
        : `http_${res.status}`;
      throw new Error(`transcription_failed:${detail}`);
    }
    const text = String(payload?.text || '').trim();
    if (!text) {
      throw new Error('transcription_empty');
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Transcreve áudio de mensagem Z-API (nota de voz) para texto.
 * @param {unknown} rawBody — corpo do webhook Z-API
 * @returns {Promise<string|null>}
 */
export const transcribeZapiInboundAudio = async (rawBody) => {
  if (!isWhatsappAudioTranscriptionEnabled()) {
    return null;
  }

  const audio = extractZapiAudioFromBody(rawBody);
  if (!audio) return null;

  try {
    const { buffer, mimeType } = await downloadZapiAudio(audio.audioUrl);
    const text = await transcribeWithOpenAiCompatible(buffer, mimeType || audio.mimeType);
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn('[ZAPI] transcrição de áudio falhou:', msg);
    return null;
  }
};

export const getWhatsappAudioTranscriptionStatus = () => {
  const creds = resolveTranscriptionApiKey();
  return {
    enabled: isWhatsappAudioTranscriptionEnabled(),
    provider: creds?.provider || null,
    configured: Boolean(creds),
  };
};
