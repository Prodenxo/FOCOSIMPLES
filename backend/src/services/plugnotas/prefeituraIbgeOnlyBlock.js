/**
 * DP-PLOGIN-02 — fallback emergencial de rollout para evitar envio ao Plugnotas de
 * `nfse.config.prefeitura` apenas com `codigoIbge` quando a política (lista IBGE + opt-in)
 * indica que o emissor costuma exigir dados adicionais (ex.: portal municipal).
 *
 * **Opt-in:** `PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED=true` e lista não vazia em
 * `PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES` (códigos IBGE de 7 dígitos, separados por vírgula).
 * Lista vazia ⇒ nenhum bloqueio (mitiga falsos positivos em todos os municípios).
 *
 * Com o preflight municipal dinâmico ativo, este módulo deixa de ser a fonte primária da decisão.
 * Executar apenas como guarda legada após `applyNfsePrefeituraIbgeIfEnabled` / derivação trilho B
 * e após a política de credenciais DP01.
 *
 * @see docs/stories/story-fr-plogin-backlog-dp02-bloqueio-prefeitura-incompleta-servidor.md
 * @see docs/adr/ADR-plugnotas-empresa-payload-apenas-nfse.md
 */

import { badRequest } from '../../utils/errors.js';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Identificador estável BFF / `errors.plugnotasCode` (UX spec §7 / contrato). */
export const PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_CODE = 'prefeitura_ibge_apenas_insuficiente_dp02';

export const PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_MESSAGE =
  'Para este município a configuração NFS-e da prefeitura no emissor costuma exigir dados adicionais além do código IBGE. '
  + 'Este produto não envia credenciais do portal municipal neste fluxo — contacte o suporte ou consulte a documentação do emissor.';

/**
 * @param {unknown} value
 * @returns {string}
 */
const onlyDigits = (value) => {
  if (value == null) return '';
  return String(value).replace(/\D/g, '');
};

/**
 * @param {string | undefined} raw
 * @returns {Set<string>}
 */
export function parsePrefeituraIbgeOnlyBlockCodes(raw) {
  const set = new Set();
  if (raw == null || typeof raw !== 'string') return set;
  for (const part of raw.split(/[,;\s]+/)) {
    const d = onlyDigits(part);
    if (d.length === 7) set.add(d);
  }
  return set;
}

export const isPrefeituraIbgeOnlyBlockEnabled = () =>
  process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_ENABLED === 'true';

/**
 * `prefeitura` tem apenas `codigoIbge` com 7 dígitos (e opcionalmente `login`/`senha` vazios ou ausentes).
 * @param {Record<string, unknown>} prefeitura
 */
export function isPrefeituraSomenteCodigoIbge(prefeitura) {
  if (!prefeitura || typeof prefeitura !== 'object' || Array.isArray(prefeitura)) return false;

  let codigoNorm = '';
  for (const k of Object.keys(prefeitura)) {
    const v = prefeitura[k];
    const s = v == null ? '' : String(v).trim();
    if (k === 'codigoIbge') {
      codigoNorm = onlyDigits(v);
      continue;
    }
    if (k === 'login' || k === 'senha') {
      if (s !== '') return false;
      continue;
    }
    if (s !== '') return false;
  }
  return codigoNorm.length === 7;
}

/**
 * @param {Record<string, unknown>} payload — mutado apenas se necessário (não esperado)
 */
export function applyPrefeituraIbgeOnlyBlockPolicy(payload) {
  if (!isPrefeituraIbgeOnlyBlockEnabled()) return;

  const codes = parsePrefeituraIbgeOnlyBlockCodes(process.env.PLUGNOTAS_NFSE_PREFEITURA_IBGE_ONLY_BLOCK_CODES);
  if (codes.size === 0) return;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;

  const nfse = payload.nfse;
  if (!nfse || typeof nfse !== 'object' || Array.isArray(nfse)) return;
  if (nfse.ativo === false) return;

  const config = nfse.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return;

  if (!hasOwn(config, 'prefeitura')) return;
  const prefeitura = config.prefeitura;
  if (prefeitura == null || typeof prefeitura !== 'object' || Array.isArray(prefeitura)) return;

  if (!isPrefeituraSomenteCodigoIbge(prefeitura)) return;

  const codigoIbge = onlyDigits(prefeitura.codigoIbge);
  if (!codes.has(codigoIbge)) return;

  throw badRequest(PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_MESSAGE, {
    plugnotasCode: PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_CODE
  });
}
