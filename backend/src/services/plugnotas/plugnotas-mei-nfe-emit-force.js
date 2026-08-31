import { unwrapPlugnotasEmpresaRecord } from '../mei-emitente-empresa-sync.js';
import { badRequest } from '../../utils/errors.js';
import {
  atualizarEmpresaPlugNotas,
  consultarEmpresaPlugNotas,
  ensureMeiRegimeEspecialPlugnotasEmpresa,
  resolverCertificadoIdPorCnpj,
  vincularCertificadoEmpresaPlugNotas,
} from './empresa.service.js';
import {
  PLUGNOTAS_REGIME_ESPECIAL_MEI,
} from './plugnotas-mei-empresa-policy.js';
import {
  extractDocumentosAtivosFromEmpresaResponse,
} from './plugnotas-empresa-documentos-ativos.js';
import { env } from '../../config/env.js';
import { normalizeCertificadoIdCandidate } from './plugnotas-certificado-listagem-parse.js';

/** CRT MEI na NF-e (NT 2024.001). */
export const PLUGNOTAS_CRT_MEI = 4;

/** Esquema XML com suporte a CRT 4. */
export const PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI = 'pl_010c';

const toObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

/** @internal — injecção para testes */
export let plugnotasNfeEmitPrepDeps = {
  consultarEmpresaPlugNotas,
  atualizarEmpresaPlugNotas,
  resolverCertificadoIdPorCnpj,
  vincularCertificadoEmpresaPlugNotas,
};

export const configurePlugnotasNfeEmitPrepDeps = (deps = {}) => {
  plugnotasNfeEmitPrepDeps = {
    consultarEmpresaPlugNotas: deps.consultarEmpresaPlugNotas ?? consultarEmpresaPlugNotas,
    atualizarEmpresaPlugNotas: deps.atualizarEmpresaPlugNotas ?? atualizarEmpresaPlugNotas,
    resolverCertificadoIdPorCnpj: deps.resolverCertificadoIdPorCnpj ?? resolverCertificadoIdPorCnpj,
    vincularCertificadoEmpresaPlugNotas:
      deps.vincularCertificadoEmpresaPlugNotas ?? vincularCertificadoEmpresaPlugNotas,
  };
};

export const resetPlugnotasNfeEmitPrepDeps = () => {
  plugnotasNfeEmitPrepDeps = {
    consultarEmpresaPlugNotas,
    atualizarEmpresaPlugNotas,
    resolverCertificadoIdPorCnpj,
    vincularCertificadoEmpresaPlugNotas,
  };
};

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

const readInscricaoEstadual = (...values) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

/**
 * CRT da NF-e. Foco Simples = sempre Simples Nacional (1). Nunca MEI (4).
 * @param {{ empresa?: Record<string, unknown>|null, emitente?: Record<string, unknown>|null }} [input]
 * @returns {1|2|3|4}
 */
export const resolvePlugnotasNfeCrt = (input = {}) => {
  if (isFocoSimplesProduct()) return 1;

  const empresa = toObject(input.empresa);
  const emitente = toObject(input.emitente);
  const especial = Number(empresa.regimeTributarioEspecial);
  if (especial === PLUGNOTAS_REGIME_ESPECIAL_MEI) return PLUGNOTAS_CRT_MEI;

  const ie = readInscricaoEstadual(emitente.inscricaoEstadual, empresa.inscricaoEstadual);
  if (!ie || ie.toUpperCase() === 'ISENTO') return PLUGNOTAS_CRT_MEI;

  const existing = Number(emitente.crt ?? emitente.CRT ?? empresa.crt);
  if (existing === 1 || existing === 2 || existing === 3 || existing === 4) {
    return /** @type {1|2|3|4} */ (existing);
  }
  return 1;
};

/**
 * Garante CRT no JSON da NF-e. Foco Simples: CRT 1, sem esquema MEI.
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} empresa
 */
export const applyNfeCrtAndSchemaForEmit = (payload, empresa = null) => {
  if (!payload || typeof payload !== 'object') return payload;
  const emitente = toObject(payload.emitente);
  const crt = resolvePlugnotasNfeCrt({ empresa, emitente });
  const config = toObject(payload.config);
  const nextEmitente = { ...emitente, crt };
  if (isFocoSimplesProduct()) {
    delete nextEmitente.regimeTributarioEspecial;
    nextEmitente.regimeTributario = 1;
    nextEmitente.simplesNacional = true;
  }
  return {
    ...payload,
    crt,
    emitente: nextEmitente,
    config: crt === PLUGNOTAS_CRT_MEI && !isFocoSimplesProduct()
      ? {
        ...config,
        versaoEsquema: String(config.versaoEsquema || '').trim() || PLUGNOTAS_NFE_VERSAO_ESQUEMA_MEI,
      }
      : config,
  };
};

const isNfeBlockAtivo = (empresa) => toObject(empresa?.nfe).ativo === true;

/**
 * Garante bloco NF-e activo no cadastro Plugnotas antes de POST /nfe.
 * Empresas cadastradas só com NFS-e (default histórico) falham com erro genérico da Plugnotas.
 * @param {string} cnpj
 * @param {Record<string, unknown>} empresa
 */
const ensureEmpresaPlugnotasNfeAtivoForEmit = async (cnpj, empresa) => {
  if (isNfeBlockAtivo(empresa)) return empresa;

  const current = extractDocumentosAtivosFromEmpresaResponse(empresa)
    || { nfse: true, nfe: false, nfce: false };
  const certId = readCertificadoIdFromEmpresa(empresa)
    || await plugnotasNfeEmitPrepDeps.resolverCertificadoIdPorCnpj(cnpj);

  try {
    await plugnotasNfeEmitPrepDeps.atualizarEmpresaPlugNotas({
      cpfCnpj: cnpj,
      ...(certId ? { certificado: certId } : {}),
      documentosAtivos: {
        nfse: current.nfse,
        nfe: true,
        nfce: current.nfce,
      },
    });
    const refreshed = unwrapPlugnotasEmpresaRecord(
      await plugnotasNfeEmitPrepDeps.consultarEmpresaPlugNotas(cnpj),
    ) || empresa;
    if (!isNfeBlockAtivo(refreshed)) {
      throw badRequest(
        'NF-e não está activa no emissor fiscal. Abra Certificado → Empresa na app e active NF-e antes de emitir.',
        {
          code: 'NFE_PLUGNOTAS_INACTIVE',
          botHint:
            'Peça ao utilizador abrir Foco Simples → Certificado → Empresa, marcar NF-e e gravar. '
            + 'Depois tente emit_nfe de novo com confirm:true.',
        },
      );
    }
    return refreshed;
  } catch (error) {
    if (error?.errors?.code === 'NFE_PLUGNOTAS_INACTIVE') throw error;
    console.warn('[plugnotas] falha ao activar NF-e antes da emissão', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      error: error instanceof Error ? error.message : String(error),
    });
    throw badRequest(
      'Não foi possível activar NF-e no emissor fiscal. Verifique certificado e cadastro da empresa na app.',
      {
        code: 'NFE_PLUGNOTAS_ACTIVATE_FAILED',
        botHint:
          'Oriente Certificado → Empresa (certificado .pfx + NF-e activa). Não volte ao preview — só repita emit após corrigir.',
      },
    );
  }
};

const readCertificadoIdFromEmpresa = (empresa) => {
  if (!empresa || typeof empresa !== 'object') return null;
  const candidates = [
    empresa.certificado,
    empresa.certificadoId,
    empresa.idCertificado,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const id = normalizeCertificadoIdCandidate(candidate);
      if (id) return id;
    }
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const nested = normalizeCertificadoIdCandidate(
        candidate.id ?? candidate._id ?? candidate.uuid,
      );
      if (nested) return nested;
    }
  }
  return null;
};

/**
 * Garante certificado vivo vinculado à empresa no PlugNotas antes da NF-e.
 * @param {string} cnpj
 * @param {Record<string, unknown>} empresa
 */
const ensureCertificadoVinculadoAntesNfe = async (cnpj, empresa) => {
  const resolved = await plugnotasNfeEmitPrepDeps.resolverCertificadoIdPorCnpj(cnpj);
  if (!resolved) {
    throw badRequest(
      'Certificado digital não encontrado no emissor para este CNPJ. '
      + 'Abra Certificado, envie o .pfx novamente e grave a empresa no emissor.',
      { plugnotasCode: 'certificado_nao_configurado' },
    );
  }

  const linked = readCertificadoIdFromEmpresa(empresa);
  if (linked === resolved) return empresa;

  try {
    await plugnotasNfeEmitPrepDeps.vincularCertificadoEmpresaPlugNotas(cnpj, resolved, empresa);
    return unwrapPlugnotasEmpresaRecord(
      await plugnotasNfeEmitPrepDeps.consultarEmpresaPlugNotas(cnpj),
    ) || empresa;
  } catch (error) {
    console.warn('[plugnotas] falha ao vincular certificado antes da NF-e', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      error: error instanceof Error ? error.message : String(error),
    });
    // Segue com o que tem; a emissão pode ainda falhar com mensagem clara do PlugNotas.
    return empresa;
  }
};

/**
 * Foco Simples: tira regime especial MEI (5) do cadastro Plugnotas.
 * A PlugNotas gera CRT 4 no XML se especial=5 — a SEFAZ recusa no Simples.
 * @param {string} cnpj
 * @param {Record<string, unknown>} empresa
 */
const ensureFocoSimplesSimplesNacionalEmpresa = async (cnpj, empresa) => {
  const especial = Number(empresa?.regimeTributarioEspecial);
  if (especial !== PLUGNOTAS_REGIME_ESPECIAL_MEI) return empresa;

  try {
    const certId = readCertificadoIdFromEmpresa(empresa)
      || await plugnotasNfeEmitPrepDeps.resolverCertificadoIdPorCnpj(cnpj);
    const ie = String(empresa?.inscricaoEstadual || '').trim();
    await plugnotasNfeEmitPrepDeps.atualizarEmpresaPlugNotas({
      cpfCnpj: cnpj,
      ...(certId ? { certificado: certId } : {}),
      regimeTributario: 1,
      regimeTributarioEspecial: 0,
      simplesNacional: true,
      ...(ie && ie.toUpperCase() !== 'ISENTO' ? { inscricaoEstadual: ie } : {}),
    });
    console.info('[plugnotas] Foco Simples: regime MEI removido — CRT 1 (Simples Nacional)');
    return unwrapPlugnotasEmpresaRecord(
      await plugnotasNfeEmitPrepDeps.consultarEmpresaPlugNotas(cnpj),
    ) || { ...empresa, regimeTributarioEspecial: 0 };
  } catch (error) {
    console.warn('[plugnotas] falha ao limpar regime MEI no Foco Simples', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      error: error instanceof Error ? error.message : String(error),
    });
    return empresa;
  }
};

/**
 * Best-effort: cadastro Plugnotas pronto para NF-e (certificado vivo; MEI só no FocoMEI).
 * @param {string} cnpjInput
 * @returns {Promise<Record<string, unknown>|null>}
 */
export const ensureMeiNfePlugnotasCadastroBeforeEmit = async (cnpjInput) => {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return null;

  // Foco Simples: NÃO forçar regime MEI / IE ISENTO (quebra NF-e de Simples com IE real).
  if (!isFocoSimplesProduct()) {
    try {
      const certId = await plugnotasNfeEmitPrepDeps.resolverCertificadoIdPorCnpj(cnpj);
      await ensureMeiRegimeEspecialPlugnotasEmpresa(cnpj, certId);
    } catch (error) {
      console.warn('[plugnotas] falha ao garantir regime MEI antes da NF-e', {
        cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let empresaJson;
  try {
    empresaJson = await plugnotasNfeEmitPrepDeps.consultarEmpresaPlugNotas(cnpj);
  } catch {
    return null;
  }

  let empresa = unwrapPlugnotasEmpresaRecord(empresaJson) || {};
  empresa = await ensureCertificadoVinculadoAntesNfe(cnpj, empresa);
  empresa = await ensureEmpresaPlugnotasNfeAtivoForEmit(cnpj, empresa);

  if (isFocoSimplesProduct()) {
    return ensureFocoSimplesSimplesNacionalEmpresa(cnpj, empresa);
  }

  // FocoMEI: CRT 4 no XML exige esquema pl_010c.
  const crt = resolvePlugnotasNfeCrt({ empresa });
  if (crt !== PLUGNOTAS_CRT_MEI || !empresaPrecisaVersaoEsquemaMei(empresa)) {
    return empresa;
  }

  try {
    const nfe = toObject(empresa.nfe);
    const config = toObject(nfe.config);
    const certId = readCertificadoIdFromEmpresa(empresa)
      || await plugnotasNfeEmitPrepDeps.resolverCertificadoIdPorCnpj(cnpj);
    await plugnotasNfeEmitPrepDeps.atualizarEmpresaPlugNotas({
      cpfCnpj: cnpj,
      ...(certId ? { certificado: certId } : {}),
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
    return unwrapPlugnotasEmpresaRecord(
      await plugnotasNfeEmitPrepDeps.consultarEmpresaPlugNotas(cnpj),
    ) || empresa;
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
