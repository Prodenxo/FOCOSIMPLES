/**
 * Defaults do bloco `servico.iss` exigido pelo PlugNotas (municipal e nacional).
 * Optantes Simples Nacional não enviam alíquota ISS (regra fiscal / prefeitura).
 */

/** Exigibilidade: 1 = exigível (padrão ABRASF / PlugNotas). */
export const NFSE_ISS_EXIGIBILIDADE_EXIGIVEL = 1;

/**
 * @param {{ nfseNacional?: boolean, simplesNacional?: boolean }} [options]
 * @returns {number}
 */
export const resolveDefaultTipoTributacao = ({
  nfseNacional = true,
  simplesNacional = true,
} = {}) => {
  if (simplesNacional !== false) {
    // Nacional ADN: 6 (Simples). Municipal ISSNET/ABRASF: 1 (tributável no município).
    return nfseNacional === false ? 1 : 6;
  }
  return 1;
};

/**
 * @param {Record<string, unknown>|null|undefined} issInput
 * @param {{ nfseNacional?: boolean, simplesNacional?: boolean }} [options]
 * @returns {{ tipoTributacao: number, exigibilidade: number, retido: boolean, [key: string]: unknown }}
 */
export const resolveNfseIssForServico = (issInput = {}, options = {}) => {
  const { simplesNacional = true, nfseNacional = true } = options;
  const source = issInput && typeof issInput === 'object' ? { ...issInput } : {};

  const tipoRaw = source.tipoTributacao;
  const tipoTributacao = Number.isFinite(Number(tipoRaw))
    ? Number(tipoRaw)
    : resolveDefaultTipoTributacao({ nfseNacional, simplesNacional });

  const exigRaw = source.exigibilidade;
  const exigibilidade = Number.isFinite(Number(exigRaw))
    ? Number(exigRaw)
    : NFSE_ISS_EXIGIBILIDADE_EXIGIVEL;

  const iss = {
    tipoTributacao,
    exigibilidade,
    retido: source.retido === true,
  };

  for (const key of ['processoSuspensao', 'valor', 'valorRetido']) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
      iss[key] = source[key];
    }
  }

  // Simples Nacional / MEI: não informar alíquota ISS no JSON.
  if (simplesNacional === false && source.aliquota !== undefined && source.aliquota !== null && source.aliquota !== '') {
    iss.aliquota = source.aliquota;
  }

  return iss;
};

/**
 * @param {Record<string, unknown>|null|undefined} empresaJson
 * @returns {boolean}
 */
export const readNfseNacionalFromEmpresa = (empresaJson) => {
  const nfse = empresaJson?.nfse;
  const config = nfse?.config ?? nfse?.Config ?? {};
  if (config.nfseNacional === false) return false;
  return true;
};

/**
 * Garante bloco `iss` em cada item de `servico` antes do POST PlugNotas.
 * @param {Record<string, unknown>|null|undefined} payload
 * @param {{ nfseNacional?: boolean, simplesNacional?: boolean }} [options]
 * @returns {Record<string, unknown>|null|undefined}
 */
export const enrichNfseIssInEmitPayload = (payload, options = {}) => {
  if (!payload || typeof payload !== 'object') return payload;
  const servicos = payload.servico;
  if (!Array.isArray(servicos) || !servicos.length) return payload;

  return {
    ...payload,
    servico: servicos.map((item) => {
      if (!item || typeof item !== 'object') return item;
      return {
        ...item,
        iss: resolveNfseIssForServico(item.iss, options),
      };
    }),
  };
};
