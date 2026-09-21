/**
 * Correlação oficial da NFS-e (Reforma Tributária): cTribNac × cNBS × cClassTrib × CST × cIndOp.
 *
 * A prefeitura rejeita com EM062 quando o conjunto não existe na tabela oficial. Em vez de
 * chutar `cst 000 / cct 000001` (tributação integral), derivamos os quatro campos da própria
 * tabela que o validador usa.
 *
 * @see NFSE_CORRELACAO_REFORMA_FONTE
 */

import {
  NFSE_CORRELACAO_NBS_DESCRICOES,
  NFSE_CORRELACAO_REFORMA_FONTE,
  NFSE_CORRELACAO_REFORMA_POR_TRIBNAC,
  NFSE_CORRELACAO_TRIBNAC_DESCRICOES,
} from '../data/nfse-correlacao-reforma.js';

export { NFSE_CORRELACAO_REFORMA_FONTE };

/** Tributação integral — padrão quando o serviço não tem redução própria. */
const CLASS_TRIB_INTEGRAL = '000001';

/**
 * Classificações que dependem de uma condição específica do prestador/tomador (Prouni, ICT,
 * reabilitação urbana, administração pública, regime especial). Não servem de escolha automática:
 * só entram quando o contador informa explicitamente ou quando são a única opção do serviço.
 */
export const NFSE_CLASS_TRIB_CONDICIONAIS = Object.freeze(new Set([
  '010002', '011003',
  '200016', '200021', '200025', '200026', '200037', '200038',
  '200040', '200041', '200042', '200043', '200044', '200045',
  '400001',
  '820001', '820002', '820003', '820006',
]));

/**
 * @param {unknown} codigo
 * @returns {string}
 */
export const normalizeCodigoTributacaoNacionalKey = (codigo) => {
  const digits = String(codigo ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits.padStart(6, '0');
};

/**
 * @param {unknown} value
 * @param {number} tamanho
 * @returns {string|null}
 */
const normalizeFixedDigits = (value, tamanho) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === tamanho ? digits : null;
};

/**
 * @typedef {object} NfseCorrelacaoReforma
 * @property {string} codigoNbs
 * @property {string} cClassTrib
 * @property {string} cst
 * @property {string} cIndOp
 */

/**
 * Combinações válidas para um código de tributação nacional (LC 116).
 *
 * @param {unknown} codigo
 * @returns {NfseCorrelacaoReforma[]}
 */
export const listNfseCorrelacoesForCodigo = (codigo) => {
  const key = normalizeCodigoTributacaoNacionalKey(codigo);
  const rows = NFSE_CORRELACAO_REFORMA_POR_TRIBNAC[key];
  if (!Array.isArray(rows)) return [];
  return rows.map(([codigoNbs, cClassTrib, cst, cIndOp]) => ({
    codigoNbs,
    cClassTrib,
    cst,
    cIndOp,
  }));
};

/**
 * @param {unknown} codigo
 * @returns {boolean}
 */
export const hasNfseCorrelacaoForCodigo = (codigo) => (
  listNfseCorrelacoesForCodigo(codigo).length > 0
);

/**
 * @param {NfseCorrelacaoReforma} a
 * @param {NfseCorrelacaoReforma} b
 * @returns {number}
 */
const compareCandidatos = (a, b) => {
  const integral = (item) => (item.cClassTrib === CLASS_TRIB_INTEGRAL ? 0 : 1);
  if (integral(a) !== integral(b)) return integral(a) - integral(b);
  const condicional = (item) => (NFSE_CLASS_TRIB_CONDICIONAIS.has(item.cClassTrib) ? 1 : 0);
  if (condicional(a) !== condicional(b)) return condicional(a) - condicional(b);
  return 0;
};

/**
 * Aplica um filtro só quando ele sobra candidato — valor informado errado não pode zerar a busca.
 *
 * @param {NfseCorrelacaoReforma[]} candidatos
 * @param {(item: NfseCorrelacaoReforma) => boolean} predicado
 * @returns {NfseCorrelacaoReforma[]}
 */
const preferirFiltro = (candidatos, predicado) => {
  const filtrados = candidatos.filter(predicado);
  return filtrados.length ? filtrados : candidatos;
};

/**
 * @param {NfseCorrelacaoReforma[]} candidatos
 * @param {{ cIndOp?: unknown, cClassTrib?: unknown, cst?: unknown }} input
 * @returns {NfseCorrelacaoReforma}
 */
const resolvePreferido = (candidatos, input) => {
  const cClassTrib = normalizeFixedDigits(input.cClassTrib, 6);
  const cst = normalizeFixedDigits(input.cst, 3);
  const cIndOp = normalizeFixedDigits(input.cIndOp, 6);

  let restantes = candidatos;
  if (cClassTrib) restantes = preferirFiltro(restantes, (item) => item.cClassTrib === cClassTrib);
  if (cst) restantes = preferirFiltro(restantes, (item) => item.cst === cst);
  if (cIndOp) restantes = preferirFiltro(restantes, (item) => item.cIndOp === cIndOp);

  return [...restantes].sort(compareCandidatos)[0];
};

/**
 * Resolve o conjunto (cNBS, cClassTrib, CST, cIndOp) que o validador aceita.
 * Valores informados são usados como preferência; se não existirem na tabela, a tabela vence.
 *
 * @param {{ codigo?: unknown, codigoNbs?: unknown, cIndOp?: unknown, cClassTrib?: unknown, cst?: unknown }} input
 * @returns {NfseCorrelacaoReforma|null} null quando o serviço/NBS não está na tabela
 */
export const resolveNfseCorrelacaoReforma = (input = {}) => {
  const candidatosBase = listNfseCorrelacoesForCodigo(input.codigo);
  if (!candidatosBase.length) return null;

  const codigoNbs = normalizeFixedDigits(input.codigoNbs, 9);
  if (!codigoNbs) return resolvePreferido(candidatosBase, input);

  const porNbs = candidatosBase.filter((item) => item.codigoNbs === codigoNbs);
  // NBS fora da lista do serviço: quem avisa é o preflight, não um palpite silencioso.
  if (!porNbs.length) return null;
  return resolvePreferido(porNbs, input);
};

/**
 * NBS aceitos para o serviço, com a descrição oficial (mensagens ao contador).
 *
 * @param {unknown} codigo
 * @returns {Array<{ codigoNbs: string, descricao: string }>}
 */
export const listNfseCodigoNbsOptionsForCodigo = (codigo) => {
  const vistos = new Set();
  const opcoes = [];
  for (const item of listNfseCorrelacoesForCodigo(codigo)) {
    if (vistos.has(item.codigoNbs)) continue;
    vistos.add(item.codigoNbs);
    opcoes.push({
      codigoNbs: item.codigoNbs,
      descricao: NFSE_CORRELACAO_NBS_DESCRICOES[item.codigoNbs] ?? '',
    });
  }
  return opcoes;
};

/**
 * @param {unknown} codigo
 * @param {unknown} codigoNbs
 * @returns {boolean}
 */
export const isNfseCodigoNbsValidoForCodigo = (codigo, codigoNbs) => {
  const nbs = normalizeFixedDigits(codigoNbs, 9);
  if (!nbs) return false;
  return listNfseCorrelacoesForCodigo(codigo).some((item) => item.codigoNbs === nbs);
};

/**
 * @param {unknown} codigo
 * @returns {string}
 */
export const describeCodigoTributacaoNacional = (codigo) => (
  NFSE_CORRELACAO_TRIBNAC_DESCRICOES[normalizeCodigoTributacaoNacionalKey(codigo)] ?? ''
);

/**
 * Mensagem pronta listando os NBS válidos do serviço.
 *
 * @param {unknown} codigo
 * @param {{ limite?: number }} [options]
 * @returns {string}
 */
export const formatNfseCodigoNbsOptionsMessage = (codigo, options = {}) => {
  const limite = Number.isFinite(options.limite) ? Number(options.limite) : 6;
  const opcoes = listNfseCodigoNbsOptionsForCodigo(codigo);
  if (!opcoes.length) return '';
  const lista = opcoes
    .slice(0, limite)
    .map(({ codigoNbs, descricao }) => (descricao ? `${codigoNbs} (${descricao})` : codigoNbs))
    .join('; ');
  const restantes = opcoes.length - Math.min(limite, opcoes.length);
  return restantes > 0 ? `${lista}; e outros ${restantes}` : lista;
};
