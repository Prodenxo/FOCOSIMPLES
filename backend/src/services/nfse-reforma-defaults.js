/**
 * Campos da Reforma Tributária / NFS-e Nacional exigidos por municípios ISSNET (ex.: Ribeirão Preto).
 * finNFSe: 0 = NFS-e regular (emissão normal).
 */

/** NFS-e regular — emissão padrão de serviço. */
export const NFSE_FIN_NFSE_REGULAR = 0;

/** Operação não destinada a uso/consumo pessoal (indFinal / operacaoPessoal). */
export const NFSE_IND_FINAL_NAO = 0;

/**
 * @param {Record<string, unknown>|null|undefined} source
 * @returns {number}
 */
export const resolveFinNfseValue = (source = {}) => {
  const raw = source.finNFSe ?? source.finNfse ?? source.finalidadeNfse ?? source.FinalidadeNFSe;
  if (raw !== undefined && raw !== null && raw !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9) return parsed;
  }
  return NFSE_FIN_NFSE_REGULAR;
};

/**
 * @param {unknown} value
 * @returns {number}
 */
const resolveIndFinalValue = (value) => {
  if (value === undefined || value === null || value === '') return NFSE_IND_FINAL_NAO;
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  if (value === false || value === 'false' || value === 0 || value === '0') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NFSE_IND_FINAL_NAO;
};

/**
 * Preenche finNFSe / indFinal no cabeçalho da NFS-e antes do POST PlugNotas.
 * Municípios ISSNET rejeitam a montagem do TX2 sem finNFSe (1 caractere: 0, 1 ou 2).
 *
 * @param {Record<string, unknown>|null|undefined} payload
 * @returns {Record<string, unknown>|null|undefined}
 */
export const enrichNfseReformaCabecalhoInEmitPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;

  const finNFSe = resolveFinNfseValue(payload);
  const indFinal = resolveIndFinalValue(payload.indFinal ?? payload.indFinalNfse);

  const existingIbscbs = payload.ibscbs && typeof payload.ibscbs === 'object' && !Array.isArray(payload.ibscbs)
    ? payload.ibscbs
    : {};

  return {
    ...payload,
    finNFSe,
    indFinal,
    ibscbs: {
      ...existingIbscbs,
      finNFSe: existingIbscbs.finNFSe ?? existingIbscbs.finNfse ?? finNFSe,
      operacaoPessoal: existingIbscbs.operacaoPessoal ?? indFinal,
    },
  };
};
