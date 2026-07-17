/**
 * Log de diagnóstico para HTTP 400 em chamadas JSON ao Plugnotas (emissão / requestJson).
 * Não inclui headers (evita vazar x-api-key). Request body é redigido (cpfCnpj mascarado).
 */

import { env } from '../../config/env.js';
import { messageFromPlugnotasParsedBody } from './plugnotas-error-message.js';

const maskDoc = (value) => {
  if (value === null || value === undefined || typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
};

/** Chaves em objeto JSON que nunca devem aparecer literalmente em log (US-NFCE-EMP-04 / emissão). */
const SENSITIVE_LEAF_KEYS = new Set([
  'senha',
  'password',
  'arquivo',
  'file',
  'token',
  'apikey',
  'api_key',
  'x-api-key',
  'authorization',
  'binary',
  'pfx',
  'certificadobinario'
]);

/**
 * Redige payload enviado ao Plugnotas para log de diagnóstico (HTTP 400).
 * Reutilizado por `logPlugnotasEmitir400` e `logPlugnotasEmpresaCadastro400Request` (US-NFCE-EMP-04).
 */
export const redactPayload = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(redactPayload);
  if (typeof obj !== 'object') return obj;
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    const k = key.toLowerCase();
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      out[key] = redactPayload(val);
    } else if (Array.isArray(val)) {
      out[key] = val.map(redactPayload);
    } else if (SENSITIVE_LEAF_KEYS.has(k)) {
      out[key] = '[redacted]';
    } else if (k === 'cpfcnpj' || k === 'cpf_cnpj' || k === 'cnpj') {
      out[key] = maskDoc(val);
    } else if (k === 'certificado') {
      out[key] = typeof val === 'string' ? maskDoc(val) : '[redacted]';
    } else {
      out[key] = val;
    }
  }
  return out;
};

const pickIdIntegracao = (body) => {
  if (body === undefined || body === null) return '';
  const row = Array.isArray(body) ? body[0] : body;
  if (row && typeof row === 'object' && row.idIntegracao != null && String(row.idIntegracao).trim() !== '') {
    return String(row.idIntegracao).trim();
  }
  return '';
};

/** `process.env` tem precedência (testes e override em runtime sem recarregar `env.js`). */
const emit400Log = (...args) => {
  const level = String(
    process.env.PLUGNOTAS_EMIT_400_LOG_LEVEL
    || env.PLUGNOTAS_EMIT_400_LOG_LEVEL
    || 'error'
  ).toLowerCase();
  if (level === 'warn' || level === 'warning') {
    console.warn(...args);
  } else {
    console.error(...args);
  }
};

/**
 * @param {object} options
 * @param {'NFSe'|'NFe'|'NFCe'} options.kind
 * @param {unknown} options.responseBody
 * @param {unknown} [options.body] corpo enviado no fetch (ex.: array com um documento)
 */
export const logPlugnotasEmitir400 = ({ kind, responseBody, body }) => {
  const prefix = `[emissao-fiscal ${kind}]`;
  emit400Log(`${prefix} 400 response:`, JSON.stringify(responseBody));
  const idIntegracao = pickIdIntegracao(body);
  if (idIntegracao) {
    emit400Log(`${prefix} 400 idIntegracao:`, idIntegracao);
  }
  if (body !== undefined && body !== null) {
    emit400Log(`${prefix} 400 request payload (redacted):`, JSON.stringify(redactPayload(body)));
  }
};

/**
 * Lê corpo de erro (JSON ou texto), registra log em 400 e devolve mensagem para o cliente.
 *
 * @param {Response} response
 * @param {{ kind: 'NFSe'|'NFe'|'NFCe', body?: unknown }} context
 * @returns {Promise<string>}
 */
export const resolvePlugnotasRequestJsonError = async (response, { kind, body }) => {
  const contentType = response.headers.get('content-type') || '';
  let responseBody;
  if (contentType.includes('application/json')) {
    responseBody = await response.json();
  } else {
    responseBody = await response.text();
  }
  const message = messageFromPlugnotasParsedBody(responseBody, response.statusText);
  if (response.status === 400) {
    logPlugnotasEmitir400({ kind, responseBody, body });
  }
  return message;
};
