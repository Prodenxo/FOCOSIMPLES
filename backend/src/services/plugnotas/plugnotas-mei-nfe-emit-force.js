import { unwrapPlugnotasEmpresaRecord } from '../mei-emitente-empresa-sync.js';
import {
  atualizarEmpresaPlugNotas,
  consultarEmpresaPlugNotas,
  ensureMeiRegimeEspecialPlugnotasEmpresa,
} from './empresa.service.js';
import {
  PLUGNOTAS_REGIME_ESPECIAL_MEI,
} from './plugnotas-mei-empresa-policy.js';
import { env } from '../../config/env.js';

/** CRT MEI na NF-e (NT 2024.001). */
export const PLUGNOTAS_CRT_MEI = 4;

/** Esquema XML com suporte a CRT 4. */
export const PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI = 'pl_010c';

const toObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const isFocoSimplesProduct = () =>
  String(env.APP_PRODUCT || '').trim().toLowerCase() === 'focosimples';

export const isMeiNfeEmitForceEnabled = () => {
  if (isFocoSimplesProduct()) return false;
  const raw = String(process.env.MEI_NFE_FORCE_CRT_EMIT ?? 'true').trim().toLowerCase();
  return ['1', 'true', 'yes', 'sim'].includes(raw);
};

const empresaPrecisaVersaoEsquemaMei = (empresa) => {
  const versao = String(empresa?.nfe?.config?.versaoEsquema || '').trim();
  return versao !== PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI;
};

/**
 * Best-effort: regime MEI (1+5) + versaoEsquema pl_010c no cadastro Plugnotas antes da NF-e.
 * @param {string} cnpjInput
 * @returns {Promise<Record<string, unknown>|null>}
 */
export const ensureMeiNfePlugnotasCadastroBeforeEmit = async (cnpjInput) => {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return null;

  try {
    await ensureMeiRegimeEspecialPlugnotasEmpresa(cnpj);
  } catch (error) {
    console.warn('[plugnotas] falha ao garantir regime MEI antes da NF-e', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let empresaJson;
  try {
    empresaJson = await consultarEmpresaPlugNotas(cnpj);
  } catch {
    return null;
  }

  const empresa = unwrapPlugnotasEmpresaRecord(empresaJson) || {};
  if (!empresaPrecisaVersaoEsquemaMei(empresa)) {
    return empresa;
  }

  try {
    const nfe = toObject(empresa.nfe);
    const config = toObject(nfe.config);
    await atualizarEmpresaPlugNotas({
      cpfCnpj: cnpj,
      regimeTributario: 1,
      regimeTributarioEspecial: PLUGNOTAS_REGIME_ESPECIAL_MEI,
      simplesNacional: true,
      nfse: empresa.nfse,
      nfe: {
        ...nfe,
        ativo: nfe.ativo !== false,
        config: {
          ...config,
          versaoEsquema: PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI,
        },
      },
      nfce: empresa.nfce,
    });
    return unwrapPlugnotasEmpresaRecord(await consultarEmpresaPlugNotas(cnpj)) || empresa;
  } catch (error) {
    console.warn('[plugnotas] falha ao aplicar versaoEsquema MEI antes da NF-e', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      error: error instanceof Error ? error.message : String(error),
    });
    return empresa;
  }
};

/**
 * Preenche IE do emitente a partir do cadastro Plugnotas quando o payload não trouxe.
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} empresa
 */
export const hydrateMeiNfeEmitenteIeFromEmpresa = (payload, empresa) => {
  if (!payload || typeof payload !== 'object') return payload;
  const emitente = toObject(payload.emitente);
  const existingIe = String(emitente.inscricaoEstadual || '').trim();
  if (existingIe) return payload;

  const empresaIe = String(empresa?.inscricaoEstadual || '').trim();
  if (!empresaIe || empresaIe.toUpperCase() === 'ISENTO') return payload;

  return {
    ...payload,
    emitente: {
      ...emitente,
      inscricaoEstadual: empresaIe,
    },
  };
};

/**
 * Força campos MEI/CRT no JSON de emissão NF-e/NFC-e (best-effort; Plugnotas pode ignorar).
 * @param {Record<string, unknown>} payload
 */
export const applyMeiNfeEmitForcePolicy = (payload) => {
  if (!isMeiNfeEmitForceEnabled() || !payload || typeof payload !== 'object') {
    return payload;
  }

  const emitente = toObject(payload.emitente);
  const config = toObject(payload.config);
  const existingIe = String(emitente.inscricaoEstadual || '').trim();

  const nextEmitente = {
    ...emitente,
    crt: PLUGNOTAS_CRT_MEI,
    regimeTributario: 1,
    regimeTributarioEspecial: PLUGNOTAS_REGIME_ESPECIAL_MEI,
    simplesNacional: true,
  };
  if (existingIe) {
    nextEmitente.inscricaoEstadual = existingIe;
  }

  return {
    ...payload,
    crt: PLUGNOTAS_CRT_MEI,
    emitente: nextEmitente,
    config: {
      ...config,
      versaoEsquema: String(config.versaoEsquema || '').trim() || PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI,
    },
  };
};
