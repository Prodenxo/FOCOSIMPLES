/**
 * Defaults do bloco `servico.iss` exigido pelo PlugNotas (municipal e nacional).
 * Emissão municipal (ISSNET/ABRASF) exige `iss.aliquota` mesmo para Simples Nacional.
 * NFS-e Nacional (DPS): E0625 — ME/EPP no Simples, ISS apurado pelo SN e sem retenção
 * (`tpRetISSQN = 1`) não pode levar `iss.aliquota` no XML.
 */

/** Exigibilidade: 1 = exigível (padrão ABRASF / PlugNotas). */
export const NFSE_ISS_EXIGIBILIDADE_EXIGIVEL = 1;

/** Fallback quando o usuário/catálogo não informou alíquota (validação JSON PlugNotas). */
export const NFSE_ISS_ALIQUOTA_DEFAULT = 2;

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export const parseNfseIssAliquota = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

/**
 * @param {{ nfseNacional?: boolean, simplesNacional?: boolean, issnetOnline30?: boolean }} [options]
 * @returns {number}
 */
export const resolveDefaultTipoTributacao = ({
  nfseNacional = true,
  simplesNacional = true,
  issnetOnline30 = false,
} = {}) => {
  if (simplesNacional !== false) {
    if (issnetOnline30 || nfseNacional !== false) {
      return 6;
    }
    return 1;
  }
  return 1;
};

/**
 * NFS-e Nacional + Simples + ISS não retido: omitir alíquota (rejeição E0625).
 * @param {{ nfseNacional?: boolean, simplesNacional?: boolean }} [options]
 * @param {Record<string, unknown>|null|undefined} [issInput]
 */
export const shouldOmitNfseIssAliquota = (options = {}, issInput = {}) => {
  if (options.nfseNacional !== true) return false;
  if (options.simplesNacional === false) return false;
  if (issInput?.retido === true) return false;
  return true;
};

/**
 * @param {Record<string, unknown>|null|undefined} issInput
 * @param {{ nfseNacional?: boolean, simplesNacional?: boolean }} [options]
 * @returns {number|null} `null` quando a alíquota não deve ir no payload (E0625).
 */
export const resolveNfseIssAliquota = (issInput = {}, options = {}) => {
  if (shouldOmitNfseIssAliquota(options, issInput)) {
    return null;
  }

  const explicit = parseNfseIssAliquota(issInput?.aliquota);
  if (explicit !== null) return explicit;

  return NFSE_ISS_ALIQUOTA_DEFAULT;
};

/**
 * @param {Record<string, unknown>|null|undefined} issInput
 * @param {{ nfseNacional?: boolean, simplesNacional?: boolean, issnetOnline30?: boolean }} [options]
 * @returns {{ tipoTributacao: number, exigibilidade: number, retido: boolean, aliquota?: number, [key: string]: unknown }}
 */
export const resolveNfseIssForServico = (issInput = {}, options = {}) => {
  const { simplesNacional = true, nfseNacional = true, issnetOnline30 = false } = options;
  const source = issInput && typeof issInput === 'object' ? { ...issInput } : {};

  const tipoRaw = source.tipoTributacao;
  const tipoTributacao = Number.isFinite(Number(tipoRaw))
    ? Number(tipoRaw)
    : resolveDefaultTipoTributacao({ nfseNacional, simplesNacional, issnetOnline30 });

  const exigRaw = source.exigibilidade;
  const exigibilidade = Number.isFinite(Number(exigRaw))
    ? Number(exigRaw)
    : NFSE_ISS_EXIGIBILIDADE_EXIGIVEL;

  const aliquota = resolveNfseIssAliquota(source, { nfseNacional, simplesNacional });
  const iss = {
    tipoTributacao,
    exigibilidade,
    retido: source.retido === true,
    ...(aliquota !== null ? { aliquota } : {}),
  };

  for (const key of ['processoSuspensao', 'valor', 'valorRetido']) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
      iss[key] = source[key];
    }
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
 * @param {Record<string, unknown>|null|undefined} servicoItem
 * @returns {Record<string, unknown>}
 */
export const mergeNfseServicoIssInput = (servicoItem = {}) => {
  const iss = servicoItem.iss && typeof servicoItem.iss === 'object'
    ? { ...servicoItem.iss }
    : {};
  if (
    servicoItem.aliquota !== undefined
    && servicoItem.aliquota !== null
    && servicoItem.aliquota !== ''
    && iss.aliquota === undefined
  ) {
    iss.aliquota = servicoItem.aliquota;
  }
  return iss;
};

/**
 * Garante bloco `iss` em cada item de `servico` antes do POST PlugNotas.
 * @param {Record<string, unknown>|null|undefined} payload
 * @param {{ nfseNacional?: boolean, simplesNacional?: boolean, issnetOnline30?: boolean }} [options]
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
      const issInput = mergeNfseServicoIssInput(item);
      const iss = resolveNfseIssForServico(issInput, options);
      const omitAliquota = shouldOmitNfseIssAliquota(options, issInput);
      if (omitAliquota) {
        const { aliquota: _dropServicoAliquota, ...itemRest } = item;
        return { ...itemRest, iss };
      }
      return { ...item, iss };
    }),
  };
};
