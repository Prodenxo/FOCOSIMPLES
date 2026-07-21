import { applyEmpresaPlugnotasNfseConfigRps } from './plugnotas-empresa-rps-inicial.js';
import { env } from '../../config/env.js';

/**
 * Política empresa Plugnotas (NFS-e / NF-e / NFC-e).
 * Foco Simples: Simples Nacional obrigatório; regime especial MEI (5) só se explícito.
 * FocoMEI: mantém default MEI (1 + especial 5).
 */
export const PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA = 'ISENTO';

const isFocoSimplesProduct = () =>
  String(env.APP_PRODUCT || '').trim().toLowerCase() === 'focosimples';

/**
 * Contrato oficial NFS-e Nacional no `POST/PATCH` empresa.
 * Política MVP: `consultaNfseNacional` acompanha `nfseNacional`.
 * @see docs/adr/ADR-plugnotas-nfse-nacional-empresa-spike.md
 */
export const PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY = 'nfseNacional';
export const PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY = 'consultaNfseNacional';
export const PLUGNOTAS_NFSE_NACIONAL_LEGACY_INPUT_KEY = 'nacional';
export const PLUGNOTAS_NFSE_NACIONAL_DEFAULT_ON = true;

const hasOwn = (value, key) =>
  Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toObject = (value) => (isPlainObject(value) ? value : {});

export const inspectNfseContractInput = (nfseRaw) => {
  const nfse = toObject(nfseRaw);
  const config = toObject(nfse.config);
  const hasOfficialContractInput =
    hasOwn(config, PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY)
    || hasOwn(config, PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY);
  const hasLegacyNationalInput = hasOwn(nfse, PLUGNOTAS_NFSE_NACIONAL_LEGACY_INPUT_KEY);

  return {
    hasOfficialContractInput,
    hasLegacyNationalInput,
    usesLegacyOnlyNationalInput: hasLegacyNationalInput && !hasOfficialContractInput
  };
};

export const applyNfseNationalContractPolicy = (payload) => {
  if (!isPlainObject(payload)) return inspectNfseContractInput(null);

  const nfse = toObject(payload.nfse);
  const contractInput = inspectNfseContractInput(nfse);
  if (!Object.keys(nfse).length) return contractInput;

  const next = { ...nfse };
  const nextConfig = toObject(next.config);
  delete next[PLUGNOTAS_NFSE_NACIONAL_LEGACY_INPUT_KEY];

  if (next.ativo === false) {
    delete nextConfig[PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY];
    delete nextConfig[PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY];
    if (Object.keys(nextConfig).length) next.config = nextConfig;
    else delete next.config;
    payload.nfse = next;
    return contractInput;
  }

  const configWithDefaults = {
    producao: true,
    ...nextConfig,
    [PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY]: PLUGNOTAS_NFSE_NACIONAL_DEFAULT_ON,
    [PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY]: PLUGNOTAS_NFSE_NACIONAL_DEFAULT_ON
  };

  next.config = configWithDefaults;
  payload.nfse = next;
  applyEmpresaPlugnotasNfseConfigRps(payload);
  return contractInput;
};

/** Código Plugnotas para regime tributário especial MEI (cadastro empresa). */
export const PLUGNOTAS_REGIME_ESPECIAL_MEI = 5;

/**
 * Garante Simples Nacional na Plugnotas.
 * - Sempre: regimeTributario 1 + simplesNacional true
 * - FocoMEI: se especial vazio, assume MEI (5)
 * - Foco Simples: não força especial 5
 * @param {Record<string, unknown>} payload
 */
export const normalizeMeiEmpresaPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  let regime = Number(payload.regimeTributario);
  const especial = Number(payload.regimeTributarioEspecial);

  if (regime === 4) {
    payload.regimeTributario = 1;
    payload.simplesNacional = true;
    if (!isFocoSimplesProduct()) {
      payload.regimeTributarioEspecial = PLUGNOTAS_REGIME_ESPECIAL_MEI;
    } else if (!Number.isFinite(especial) || especial === 0) {
      delete payload.regimeTributarioEspecial;
    }
    return payload;
  }

  if (!Number.isFinite(regime) || regime <= 0) {
    payload.regimeTributario = 1;
    regime = 1;
  }

  if (isFocoSimplesProduct() && regime !== 1) {
    const err = new Error('Apenas empresas do Simples Nacional podem emitir notas neste produto.');
    err.status = 400;
    throw err;
  }

  if (payload.simplesNacional === false && isFocoSimplesProduct()) {
    const err = new Error('Optante pelo Simples Nacional é obrigatório.');
    err.status = 400;
    throw err;
  }

  payload.simplesNacional = true;

  if (regime === 1 && (Number.isNaN(especial) || especial === 0)) {
    if (isFocoSimplesProduct()) {
      delete payload.regimeTributarioEspecial;
    } else {
      payload.regimeTributarioEspecial = PLUGNOTAS_REGIME_ESPECIAL_MEI;
    }
  }

  return payload;
};

/**
 * Payload mínimo para PATCH do regime na Plugnotas.
 * @param {string} cnpj14
 * @param {string} [certificadoId]
 * @param {{ asMei?: boolean }} [options]
 */
export const buildMeiRegimePatchPayload = (cnpj14, certificadoId, options = {}) => {
  const asMei = options.asMei === true || !isFocoSimplesProduct();
  const payload = {
    cpfCnpj: cnpj14,
    regimeTributario: 1,
    simplesNacional: true,
    inscricaoEstadual: PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA
  };
  if (asMei) {
    payload.regimeTributarioEspecial = PLUGNOTAS_REGIME_ESPECIAL_MEI;
  }
  const cert = certificadoId != null ? String(certificadoId).trim() : '';
  if (cert) payload.certificado = cert;
  normalizeMeiEmpresaPayload(payload);
  return payload;
};

/**
 * Modo municipal guiado — FR-ALNFB-06 (retry com `nfseNacional=false`).
 * @param {Record<string, unknown>} payload
 */
export const applyNfseMunicipalContractPolicy = (payload) => {
  if (!isPlainObject(payload)) return inspectNfseContractInput(null);

  const nfse = toObject(payload.nfse);
  const contractInput = inspectNfseContractInput(nfse);
  if (!Object.keys(nfse).length) return contractInput;

  const next = { ...nfse };
  const nextConfig = toObject(next.config);
  delete next[PLUGNOTAS_NFSE_NACIONAL_LEGACY_INPUT_KEY];

  if (next.ativo === false) {
    delete nextConfig[PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY];
    delete nextConfig[PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY];
    if (Object.keys(nextConfig).length) next.config = nextConfig;
    else delete next.config;
    payload.nfse = next;
    return contractInput;
  }

  next.config = {
    producao: true,
    ...nextConfig,
    [PLUGNOTAS_NFSE_CONFIG_NACIONAL_KEY]: false,
    [PLUGNOTAS_NFSE_CONFIG_CONSULTA_NACIONAL_KEY]: false
  };
  payload.nfse = next;
  applyEmpresaPlugnotasNfseConfigRps(payload);
  return contractInput;
};
