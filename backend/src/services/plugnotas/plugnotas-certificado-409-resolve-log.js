/**
 * Log estruturado da cadeia GET após POST /certificado 409 (US-MEI-FISC-04).
 * Não loga URLs completas com query, senha, arquivo nem Authorization — só etapa + outcome + CNPJ mascarado.
 */
import { env } from '../../config/env.js';

/** Etapas estáveis para correlação com suporte / agregadores (FR-05). */
export const PLUGNOTAS_CERT_409_RESOLVE_STEPS = Object.freeze({
  EMPRESA_GET: 'empresa_get',
  CERTIFICADO_FILTRO: 'certificado_filtro',
  CERTIFICADO_LISTA: 'certificado_lista',
  PARSE_LISTAGEM: 'parse_listagem'
});

const maskCnpj14 = (digits) => {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length < 4) return '***';
  return `${d.slice(0, 2)}***${d.slice(-2)}`;
};

/**
 * Nível de saída para diagnóstico da resolução de ID pós-409.
 * `off` — desliga (útil se o volume incomodar).
 * `warn` — padrão.
 * `info` / `debug` — mesmo conteúdo estruturado; em `debug` inclui `firstItemKeysCount` quando informado.
 * @returns {'off'|'error'|'warn'|'info'|'debug'}
 */
export const getPlugnotasCert409ResolveLogLevel = () => {
  const raw = String(
    process.env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL
      || env.PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL
      || 'warn'
  ).toLowerCase().trim();
  if (raw === 'off' || raw === 'none' || raw === 'false' || raw === '0') return 'off';
  if (raw === 'error') return 'error';
  if (raw === 'info') return 'info';
  if (raw === 'debug') return 'debug';
  return 'warn';
};

const pickConsole = (sink) => {
  if (sink === 'error') return console.error.bind(console);
  if (sink === 'warn') return console.warn.bind(console);
  if (sink === 'info') return console.info.bind(console);
  return console.debug.bind(console);
};

/**
 * @param {object} params
 * @param {string} params.step — valor de PLUGNOTAS_CERT_409_RESOLVE_STEPS.*
 * @param {string} params.cpfCnpj14 — só dígitos (14); será mascarado no log
 * @param {string} params.outcome — ex.: http_error | no_certificado_id_in_payload | no_id_resolved
 * @param {number} [params.httpStatus]
 * @param {number} [params.listItemCount]
 * @param {number} [params.firstItemKeysCount] — só metadado; não envia valores do item
 */
export const logPlugnotasCertificado409Resolve = (params) => {
  const sink = getPlugnotasCert409ResolveLogLevel();
  if (sink === 'off') return;

  const { step, cpfCnpj14, outcome, httpStatus, listItemCount, firstItemKeysCount } = params;
  const payload = {
    tag: 'plugnotas_certificado_409_resolve',
    step,
    outcome,
    cpfCnpj: maskCnpj14(cpfCnpj14)
  };
  if (httpStatus != null) payload.httpStatus = httpStatus;
  if (listItemCount != null) payload.listItemCount = listItemCount;
  if (firstItemKeysCount != null && sink === 'debug') {
    payload.firstItemKeysCount = firstItemKeysCount;
  }

  pickConsole(sink)('[plugnotas] certificado 409 resolve', payload);
};
