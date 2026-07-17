/**
 * Diagnóstico HTTP 400 em POST /empresa e PATCH /empresa/:cnpj (US-NFCE-EMP-04).
 * Redação: `redactPayload` em `plugnotas-emit-400-log.js` (sem headers / x-api-key no corpo).
 */

import { isPlugnotasDebugExplicitlyEnabled } from './plugnotas-debug-env.js';
import { redactPayload } from './plugnotas-emit-400-log.js';

const MAX_DEBUG_JSON_CHARS = 8000;

export { isPlugnotasDebugExplicitlyEnabled } from './plugnotas-debug-env.js';

/** Só em não-produção ou com `PLUGNOTAS_DEBUG` “verdadeiro” (opt-in explícito em produção). */
export const isPlugnotasEmpresaCadastroDebugEnabled = () => (
  process.env.NODE_ENV !== 'production'
  || isPlugnotasDebugExplicitlyEnabled()
);

/** Campos de texto com PII / dados cadastrais: mascarados só no log de cadastro empresa (pós-`redactPayload`). */
const EMPRESA_CADASTRO_PII_KEYS = new Set([
  'razaosocial',
  'razãosocial',
  'nomefantasia',
  'email',
  'tipologradouro',
  'logradouro',
  'complemento',
  'bairro',
  'descricaocidade',
  'descricaopais',
  'inscricaomunicipal',
  'inscricaoestadual'
]);

const maskPiiString = (value) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  if (t.length <= 2) return '***';
  return `${t.slice(0, 2)}***${t.slice(-1)}`;
};

const maskCepDigits = (value) => {
  if (typeof value !== 'string') return value;
  const d = value.replace(/\D/g, '');
  if (d.length < 4) return '***';
  return `${d.slice(0, 2)}***${d.slice(-2)}`;
};

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export const applyEmpresaCadastroPiiMaskForLog = (value) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(applyEmpresaCadastroPiiMaskForLog);
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    const kk = key.toLowerCase();
    if (kk === 'cep' && typeof val === 'string') {
      out[key] = maskCepDigits(val);
    } else if ((kk === 'login' || kk === 'senha') && typeof val === 'string') {
      out[key] = '***';
    } else if (typeof val === 'string' && EMPRESA_CADASTRO_PII_KEYS.has(kk)) {
      out[key] = maskPiiString(val);
    } else if (val && typeof val === 'object') {
      out[key] = applyEmpresaCadastroPiiMaskForLog(val);
    } else {
      out[key] = val;
    }
  }
  return out;
};

export const isEmpresaCadastroPlugnotasPath = (path) => {
  if (typeof path !== 'string' || !path) return false;
  if (path === '/empresa') return true;
  return path.startsWith('/empresa/');
};

/**
 * @param {{ method: string, path: string, body: Record<string, unknown> }} params
 */
export const logPlugnotasEmpresaCadastro400Request = ({ method, path, body }) => {
  if (!isPlugnotasEmpresaCadastroDebugEnabled()) return;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;

  let serialized;
  try {
    const redacted = redactPayload(body);
    const forLog = applyEmpresaCadastroPiiMaskForLog(redacted);
    serialized = JSON.stringify(forLog);
  } catch {
    serialized = '[unserializable-body]';
  }
  if (serialized.length > MAX_DEBUG_JSON_CHARS) {
    serialized = `${serialized.slice(0, MAX_DEBUG_JSON_CHARS)}…[truncated]`;
  }

  const prefix = '[plugnotas empresa cadastro]';
  // eslint-disable-next-line no-console
  console.error(`${prefix} ${method} ${path} 400 request payload (redacted):`, serialized);
};
