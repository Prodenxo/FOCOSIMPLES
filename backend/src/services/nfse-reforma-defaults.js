/**
 * Campos da Reforma Tributária exigidos por municípios ISSNET (ex.: Ribeirão Preto).
 * PlugNotas mapeia finNFSe via `servico[].ibscbs.finNFSe` (FAQ Reforma Tributária).
 * finNFSe: 0 = NFS-e regular (emissão normal).
 */

/** NFS-e regular — emissão padrão de serviço. */
export const NFSE_FIN_NFSE_REGULAR = 0;

/** Operação não destinada a uso/consumo pessoal (operacaoPessoal / indFinal). */
export const NFSE_IND_FINAL_NAO = 0;

/**
 * @param {Record<string, unknown>|null|undefined} source
 * @returns {number}
 */
export const resolveFinNfseValue = (source = {}) => {
  const raw = source.finNFSe
    ?? source.finNfse
    ?? source.finalidadeNFSe
    ?? source.finalidadeNfse
    ?? source.FinalidadeNFSe;
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
const resolveOperacaoPessoalValue = (value) => {
  if (value === undefined || value === null || value === '') return NFSE_IND_FINAL_NAO;
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  if (value === false || value === 'false' || value === 0 || value === '0') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NFSE_IND_FINAL_NAO;
};

/**
 * @param {Record<string, unknown>|null|undefined} ibscbsInput
 * @param {{ finNFSe?: number, operacaoPessoal?: number }} defaults
 * @returns {Record<string, unknown>}
 */
export const buildMinimalServicoIbscbs = (ibscbsInput = {}, defaults = {}) => {
  const source = ibscbsInput && typeof ibscbsInput === 'object' ? { ...ibscbsInput } : {};
  const finNFSe = resolveFinNfseValue({
    finNFSe: source.finNFSe ?? source.finNfse ?? source.finalidadeNFSe ?? defaults.finNFSe,
  });
  const operacaoPessoal = resolveOperacaoPessoalValue(
    source.operacaoPessoal ?? source.indFinal ?? defaults.operacaoPessoal,
  );

  return {
    ...source,
    finNFSe,
    finalidadeNFSe: source.finalidadeNFSe ?? source.finalidadeNfse ?? finNFSe,
    operacaoPessoal,
    indFinal: source.indFinal ?? operacaoPessoal,
  };
};

/**
 * Preenche finNFSe no cabeçalho e em cada servico.ibscbs antes do POST PlugNotas.
 *
 * @param {Record<string, unknown>|null|undefined} payload
 * @returns {Record<string, unknown>|null|undefined}
 */
export const enrichNfseReformaCabecalhoInEmitPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;

  const finNFSe = resolveFinNfseValue(payload);
  const operacaoPessoal = resolveOperacaoPessoalValue(
    payload.indFinal ?? payload.indFinalNfse ?? payload?.ibscbs?.operacaoPessoal,
  );

  const rootIbscbs = buildMinimalServicoIbscbs(
    payload.ibscbs && typeof payload.ibscbs === 'object' && !Array.isArray(payload.ibscbs)
      ? payload.ibscbs
      : {},
    { finNFSe, operacaoPessoal },
  );

  const servicos = Array.isArray(payload.servico)
    ? payload.servico
    : payload.servico && typeof payload.servico === 'object'
      ? [payload.servico]
      : [];

  const servicoEnriched = servicos.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const itemIbscbs = item.ibscbs && typeof item.ibscbs === 'object' && !Array.isArray(item.ibscbs)
      ? item.ibscbs
      : {};
    return {
      ...item,
      ibscbs: buildMinimalServicoIbscbs(itemIbscbs, { finNFSe, operacaoPessoal }),
    };
  });

  return {
    ...payload,
    finNFSe,
    finalidadeNFSe: payload.finalidadeNFSe ?? payload.finalidadeNfse ?? finNFSe,
    indFinal: operacaoPessoal,
    ibscbs: rootIbscbs,
    ...(servicoEnriched.length ? { servico: servicoEnriched } : {}),
  };
};
