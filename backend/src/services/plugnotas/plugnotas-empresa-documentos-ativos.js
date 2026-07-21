/**
 * Seleção canónica de documentos ativos (NFSe / NF-e / NFC-e) para POST/PATCH empresa Plugnotas.
 * Resposta GET /empresa: ver `extractDocumentosAtivosFromEmpresaResponse` e docs/operacao-mei-nfse.md.
 * @see docs/stories/story-fr-cad-doc-p0-backend-documentos-ativos-plugnotas.md
 * @see docs/stories/story-fr-upd-doc-p0-backend-reconcile-get-espelho.md
 * @see docs/adr/ADR-plugnotas-empresa-payload-apenas-nfse.md
 */
import { badRequest } from '../../utils/errors.js';
import {
  applyNfseMunicipalContractPolicy,
  applyNfseNationalContractPolicy,
  PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA,
} from './plugnotas-mei-empresa-policy.js';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Default PRD §6.2 — alinhado ao comportamento histórico “apenas NFS-e”. */
export const DOCUMENTOS_ATIVOS_DEFAULT = Object.freeze({
  nfse: true,
  nfe: false,
  nfce: false
});

const PLUGNOTAS_EMPRESA_DOC_INATIVO = Object.freeze({ ativo: false, tipoContrato: 0 });

/** Config mínimo para blocos ativos — alinhado a spike sandbox; revisar com doc oficial Plugnotas. */
const PLUGNOTAS_NFE_ATIVO_CONFIG_MIN = Object.freeze({
  producao: true,
  serie: 1,
  numero: 1
});
const PLUGNOTAS_NFCE_ATIVO_CONFIG_MIN = Object.freeze({
  producao: true,
  serie: 1,
  numero: 1,
  versaoQrCode: 2
});

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return value !== 0;
  const t = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'sim'].includes(t)) return true;
  if (['0', 'false', 'no', 'nao', 'não'].includes(t)) return false;
  return fallback;
};

/**
 * Extrai a partir de um objecto onde `nfse` / `nfe` / `nfce` estão neste nível (shape “plano”).
 * @param {Record<string, unknown>} o
 * @returns {{ nfse: boolean, nfe: boolean, nfce: boolean } | null}
 */
const extractFromFlatEmpresaShape = (o) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const blockAtivo = (key) => {
    const block = o[key];
    if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
    return toBool(/** @type {Record<string, unknown>} */ (block).ativo, false);
  };
  const nfse = blockAtivo('nfse');
  const nfe = blockAtivo('nfe');
  const nfce = blockAtivo('nfce');
  if (!nfse && !nfe && !nfce) return null;
  return { nfse, nfe, nfce };
};

const pushCandidate = (list, obj) => {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) list.push(obj);
};

/**
 * Deriva `documentosAtivos` a partir do JSON de **GET /empresa** (Plugnotas).
 * Procura blocos `nfse` / `nfe` / `nfce` no **nível raiz** ou dentro de envelopes comuns (`data`, `empresa`, `data.empresa`).
 * Não lança: formas inesperadas degradam para `null`.
 *
 * @param {unknown} empresaJson — corpo típico de GET empresa (pode incluir outros campos).
 * @returns {{ nfse: boolean, nfe: boolean, nfce: boolean } | null} `null` se input inválido ou **nenhum** tipo ativo.
 */
export const extractDocumentosAtivosFromEmpresaResponse = (empresaJson) => {
  try {
    if (!empresaJson || typeof empresaJson !== 'object' || Array.isArray(empresaJson)) {
      return null;
    }
    const root = /** @type {Record<string, unknown>} */ (empresaJson);
    const candidates = [];
    pushCandidate(candidates, root);
    pushCandidate(candidates, root.data);
    pushCandidate(candidates, root.empresa);
    const data = root.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      pushCandidate(candidates, /** @type {Record<string, unknown>} */ (data).empresa);
    }
    for (const c of candidates) {
      const sel = extractFromFlatEmpresaShape(c);
      if (sel) return sel;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * @param {unknown} raw
 * @returns {{ nfse: boolean, nfe: boolean, nfce: boolean }}
 */
export const normalizeDocumentosAtivosShape = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw badRequest(
      'Campo documentosAtivos deve ser um objeto com nfse, nfe e nfce (booleanos).'
    );
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  return {
    nfse: toBool(o.nfse, false),
    nfe: toBool(o.nfe, false),
    nfce: toBool(o.nfce, false)
  };
};

/**
 * @param {{ nfse: boolean, nfe: boolean, nfce: boolean }} selection
 */
export const assertAtLeastOneDocumentoAtivo = (selection) => {
  if (!selection.nfse && !selection.nfe && !selection.nfce) {
    throw badRequest('Seleccione pelo menos um tipo de documento.');
  }
};

/**
 * Remove `documentosAtivos` do payload antes do fetch ao Plugnotas.
 * @param {Record<string, unknown>} payload
 */
export const stripDocumentosAtivos = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  delete payload.documentosAtivos;
};

/**
 * @param {Record<string, unknown>} payload
 * @returns {{ selection: { nfse: boolean, nfe: boolean, nfce: boolean } }}
 */
export const resolveDocumentosAtivosForPost = (payload) => {
  if (!hasOwn(payload, 'documentosAtivos')) {
    return { selection: { ...DOCUMENTOS_ATIVOS_DEFAULT } };
  }
  const selection = normalizeDocumentosAtivosShape(payload.documentosAtivos);
  assertAtLeastOneDocumentoAtivo(selection);
  return { selection };
};

/**
 * @param {Record<string, unknown>} payload
 * @returns {{ present: boolean, selection?: { nfse: boolean, nfe: boolean, nfce: boolean } }}
 */
export const resolveDocumentosAtivosForPatch = (payload) => {
  if (!hasOwn(payload, 'documentosAtivos')) {
    return { present: false };
  }
  const selection = normalizeDocumentosAtivosShape(payload.documentosAtivos);
  assertAtLeastOneDocumentoAtivo(selection);
  return { present: true, selection };
};

/**
 * POST: IE vazia → ISENTO (mantém contrato MEI).
 * @param {Record<string, unknown>} payload
 */
const normalizeInscricaoEstadualApenasNfse = (payload) => {
  const ieRaw = payload.inscricaoEstadual;
  const ieStr = ieRaw != null ? String(ieRaw).trim() : '';
  if (!ieStr) {
    payload.inscricaoEstadual = PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA;
  }
};

/**
 * Monta apenas nfse / nfe / nfce (sem IE). POST e PATCH com `documentosAtivos` partilham esta árvore.
 * @param {Record<string, unknown>} payload
 * @param {{ nfse: boolean, nfe: boolean, nfce: boolean }} selection
 */
const cloneIncomingPrefeituraConfig = (payload) => {
  const raw = payload?.nfse;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cfg = raw.config;
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return null;
  const prefeitura = cfg.prefeitura;
  if (prefeitura === undefined || prefeitura === null) return null;
  if (typeof prefeitura !== 'object' || Array.isArray(prefeitura)) return null;
  return { ...prefeitura };
};

/**
 * @param {Record<string, unknown>} payload
 * @param {{ nfse: boolean, nfe: boolean, nfce: boolean }} selection
 * @param {{ nfseMode?: 'nacional' | 'municipal' }} [opts]
 */
const assignDocumentBlocksFromSelection = (payload, selection, opts = {}) => {
  const nfseMode = opts.nfseMode === 'municipal' ? 'municipal' : 'nacional';
  const incomingPrefeitura = cloneIncomingPrefeituraConfig(payload);

  if (selection.nfse) {
    payload.nfse = {
      ativo: true,
      tipoContrato: 0,
      config: {
        producao: true,
        ...(incomingPrefeitura ? { prefeitura: incomingPrefeitura } : {})
      }
    };
    if (nfseMode === 'municipal') {
      applyNfseMunicipalContractPolicy(payload);
    } else {
      applyNfseNationalContractPolicy(payload);
    }
  } else {
    payload.nfse = { ...PLUGNOTAS_EMPRESA_DOC_INATIVO };
  }

  payload.nfe = selection.nfe
    ? {
      ativo: true,
      tipoContrato: 0,
      config: { ...PLUGNOTAS_NFE_ATIVO_CONFIG_MIN }
    }
    : { ...PLUGNOTAS_EMPRESA_DOC_INATIVO };

  payload.nfce = selection.nfce
    ? {
      ativo: true,
      tipoContrato: 0,
      config: { ...PLUGNOTAS_NFCE_ATIVO_CONFIG_MIN }
    }
    : { ...PLUGNOTAS_EMPRESA_DOC_INATIVO };
};

/**
 * Monta blocos nfse / nfe / nfce a partir da selecção canónica (POST).
 * @param {Record<string, unknown>} payload
 * @param {{ nfse: boolean, nfe: boolean, nfce: boolean }} selection
 * @param {{ nfseMode?: 'nacional' | 'municipal' }} [opts]
 */
export const applyEmpresaPlugnotasDocumentSelectionForPost = (payload, selection, opts = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  assignDocumentBlocksFromSelection(payload, selection, opts);
  normalizeInscricaoEstadualApenasNfse(payload);
};

/**
 * PATCH com `documentosAtivos`: mesma montagem de blocos que no POST (arquitetura §3.2).
 * @param {Record<string, unknown>} payload
 * @param {{ nfse: boolean, nfe: boolean, nfce: boolean }} selection
 * @param {{ nfseMode?: 'nacional' | 'municipal' }} [opts]
 */
export const applyEmpresaPlugnotasDocumentSelectionForPatch = (payload, selection, opts = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  assignDocumentBlocksFromSelection(payload, selection, opts);
  // Igual ao POST: PlugNotas exige IE quando NF-e/NFC-e está ativo
  normalizeInscricaoEstadualApenasNfse(payload);
};
