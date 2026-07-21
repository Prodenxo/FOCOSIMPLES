import { createSupabaseClient } from '../config/supabase.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import {
  cancelarNfse,
  consultarNfse,
  consultarNfsePorIdOuProtocolo,
  consultarNfsePorIntegracao,
  downloadNfsePdf,
  downloadNfsePdfPorIntegracao,
  downloadNfseXml,
  downloadNfseXmlPorIntegracao,
  emitirNfse
} from './plugnotas/nfse.service.js';
import {
  advancePlugnotasNfseRpsAfterEmit,
  ensureEmpresaPlugnotasRpsForNfseEmit,
  isNfseE0014FromPlugnotasResponse,
  isNfseRejectedPlugnotasResponse,
  isNfseRpsDuplicateRejectionLoose,
  isPlugnotasNfseRpsNumeroJaUtilizadoError,
  queryAuthoritativeNfseRpsMaxUsed,
  readRpsNumeroFromNfseHistoryRow,
  readRpsNumeroFromNfsePlugnotasBody,
  readRpsFromNfseEmitPayload,
  resolveNfseRpsLocalMaxFromHistory,
} from './plugnotas/plugnotas-empresa-rps-heal.js';
import {
  allocateNfseRpsForEmit,
  applyAllocatedNfseRpsToEmitPayload,
  forceNfseRpsCounterFloor,
  setNfseRpsCounterLast,
} from './plugnotas/nfse-rps-allocator.js';
import {
  ensureMeiNfsePlugnotasCadastroBeforeEmit,
  rethrowIfPlugnotasEmpresaNaoCadastrada,
} from './plugnotas/plugnotas-mei-nfse-emit-prep.js';
import {
  assertNfsePrestadorEmailOrThrow,
  enrichCatalogClienteMetadataFromCep,
  enrichNfseEmitPayloadEmails,
  normalizeTomadorEnderecoFromEmitPayload,
  resolvePrestadorEmitEmail,
} from './plugnotas/plugnotas-nfse-email-resolve.js';
import {
  enrichCodigosServicosComNbs,
  resolveCodigoNbsForServico,
  resolveCodigoTributacaoForServico,
  resolveRegimeApuracaoTributaria,
} from './nfse-codigo-nbs.js';
import {
  extractNfeItemQuantidade,
  extractNfeItemValorUnitario,
  normalizePlugnotasNfePayload,
} from './plugnotas/plugnotas-nfe-payload.js';
import {
  applyMeiNfeEmitForcePolicy,
  ensureMeiNfePlugnotasCadastroBeforeEmit,
  hydrateMeiNfeEmitenteIeFromEmpresa,
} from './plugnotas/plugnotas-mei-nfe-emit-force.js';
import {
  cancelarNfe,
  consultarNfe,
  consultarNfePorIdOuProtocolo,
  consultarNfePorIntegracao,
  downloadNfePdf,
  downloadNfePdfPorIntegracao,
  downloadNfeXml,
  downloadNfeXmlPorIntegracao,
  emitirNfe,
  relatorioNfe
} from './plugnotas/nfe.service.js';
import {
  cancelarNfce,
  consultarNfce,
  consultarNfcePorIdOuProtocolo,
  consultarNfcePorIntegracao,
  downloadNfcePdf,
  downloadNfcePdfPorIntegracao,
  downloadNfceXml,
  downloadNfceXmlPorIntegracao,
  emitirNfce
} from './plugnotas/nfce.service.js';
import { isPlugnotasDebugExplicitlyEnabled } from './plugnotas/plugnotas-debug-env.js';
import { agregarLimiteMeiDasLinhas } from '../utils/meiLimitePayloadSum.js';
import {
  logMeiEmitOutcome,
  extractMeiEmitHttpMeta,
  fallbackDocumentTypeLabelFromInput,
  sanitizePlugnotasStatusForLog,
  MEI_EMIT_ROUTE_EMITIR_NOTA
} from '../utils/logMeiEmitOutcome.js';

/**
 * Intervalo [início, fim) em ISO UTC para o ano civil Y em America/Sao_Paulo.
 * Assume UTC−3 o ano todo (sem DST em SP desde 2019).
 */
const civilYearCreatedAtBoundsUtcIso = (y) => {
  const startMs = Date.UTC(y, 0, 1, 3, 0, 0, 0);
  const endExclusiveMs = Date.UTC(y + 1, 0, 1, 3, 0, 0, 0);
  return {
    startIso: new Date(startMs).toISOString(),
    endExclusiveIso: new Date(endExclusiveMs).toISOString()
  };
};
import crypto from 'node:crypto';

const TABLE = 'mei_nfse';
/** Limite de linhas lidas para o agregado (notas mais recentes primeiro). */
const MEI_LIMITE_AGG_QUERY_LIMIT = 5000;
const CLIENTS_TABLE = 'mei_nfse_clientes';
const PRODUCTS_TABLE = 'mei_nfse_produtos';
const CODIGOS_SERVICOS_TABLE = 'codigosservicos';
const DOCUMENT_TYPE_NFSE = 'NFSE';
const DOCUMENT_TYPE_NFE = 'NFE';
const DOCUMENT_TYPE_NFCE = 'NFCE';

/**
 * Soft-hide sem alterar schema compartilhado: `metadata_json.catalogActive === false`.
 * Ausência da chave = ativo (compatível com outros sistemas que ignoram a chave).
 */
const CATALOG_ACTIVE_META_KEY = 'catalogActive';

const isCatalogClienteRowActive = (row) => {
  const meta = row?.metadata_json;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return true;
  return meta[CATALOG_ACTIVE_META_KEY] !== false;
};

const withDerivedCatalogActive = (row) => {
  if (!row || typeof row !== 'object') return row;
  return { ...row, active: isCatalogClienteRowActive(row) };
};

const setCatalogActiveInMetadata = (existingMeta, active) => {
  const base = toObject(existingMeta);
  if (active) {
    if (!(CATALOG_ACTIVE_META_KEY in base)) {
      return Object.keys(base).length ? base : null;
    }
    const next = { ...base };
    delete next[CATALOG_ACTIVE_META_KEY];
    return Object.keys(next).length ? next : null;
  }
  return { ...base, [CATALOG_ACTIVE_META_KEY]: false };
};

const CLIENT_CATALOG_SELECT =
  'id, document_type, documento, nome, email, metadata_json, last_used_at, created_at, updated_at';

/** FR-GUIA-FISC-16 — alinhado ao frontend: só `MEI_NFE_NFCE_EMIT_ENABLED=false` desactiva; omitir = comportamento actual. */
const isMeiNfeNfceEmitDisabledByServerPolicy = () =>
  String(process.env.MEI_NFE_NFCE_EMIT_ENABLED || '').toLowerCase() === 'false';

/**
 * Tamanho mínimo do código de serviço NFSe após normalização "sem máscara" (Plugnotas).
 * @see docs/prd/PRD-nfse-servico-codigo-validacao-minima.md
 */
export const NFSE_SERVICO_CODIGO_MIN_LENGTH = 6;

/**
 * Produz o valor usado para medir comprimento do código de serviço NFSe: apenas caracteres
 * alfanuméricos ASCII (remove pontos, traços, espaços e demais símbolos de máscara).
 * Deve permanecer alinhado ao frontend (Story 6.6).
 * @see docs/prd/PRD-nfse-servico-codigo-validacao-minima.md
 */
export const normalizeNfseServicoCodigoForLength = (raw) => (
  String(raw ?? '').replace(/[^0-9A-Za-z]/g, '')
);

/**
 * Garante que cada `servico[].codigo` preenchido tenha comprimento normalizado >= mínimo.
 * @throws {HttpError} 400 se algum código violar a regra
 */
export const assertNfseServicoCodigosMinLength = (payload) => {
  const servicos = Array.isArray(payload?.servico) ? payload.servico : [];
  servicos.forEach((item, index) => {
    const codigoRaw = item?.codigo;
    if (codigoRaw === undefined || codigoRaw === null) return;
    const trimmed = String(codigoRaw).trim();
    if (!trimmed) return;
    const normalized = normalizeNfseServicoCodigoForLength(trimmed);
    if (normalized.length < NFSE_SERVICO_CODIGO_MIN_LENGTH) {
      const pos = index + 1;
      throw badRequest(
        `Código do serviço (NFSe) deve ter pelo menos ${NFSE_SERVICO_CODIGO_MIN_LENGTH} caracteres alfanuméricos após remover máscaras (serviço ${pos}). Use o item completo da lista municipal (ex.: 17.19.01 → 171901); códigos como 17.19 não bastam.`
      );
    }
  });
};
const SUPPORTED_DOCUMENT_TYPES = new Set(['NFSE', 'NFE', 'NFCE', 'CTE']);
const PROVIDER_PLUGNOTAS = 'plugnotas';
const EDITABLE_STATUSES = new Set(['processando', 'rejeitado', 'interrompido']);

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');
const isValidCnpj = (value) => normalizeDoc(value).length === 14;
const isValidCpfOrCnpj = (value) => {
  const digits = normalizeDoc(value);
  return !digits || digits.length === 11 || digits.length === 14;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const nested = value.comercial ?? value.tributavel ?? value.valor;
    if (nested !== undefined && nested !== null && nested !== '') {
      return toNumber(nested);
    }
  }
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeText = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const normalizeEmail = (value) => normalizeText(value);

const toCatalogLimit = (value, { defaultValue = 20, max = 50 } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return defaultValue;
  return Math.min(normalized, max);
};

const sanitizeSearchTerm = (value) => String(value || '')
  .trim()
  .replace(/[,%()]/g, ' ')
  .replace(/\s+/g, ' ');

const normalizeDocumentType = (value = DOCUMENT_TYPE_NFSE) => {
  const normalized = String(value || DOCUMENT_TYPE_NFSE).trim().toUpperCase();
  if (!SUPPORTED_DOCUMENT_TYPES.has(normalized)) {
    throw badRequest('documentType inválido');
  }
  return normalized;
};

const parseBooleanLike = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'sim'].includes(text)) return true;
  if (['0', 'false', 'no', 'nao', 'não'].includes(text)) return false;
  return fallback;
};

const normalizeWebhookDocumentType = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'nfse') return DOCUMENT_TYPE_NFSE;
  if (text === 'nfe') return DOCUMENT_TYPE_NFE;
  if (text === 'nfce') return DOCUMENT_TYPE_NFCE;
  if (!text) return null;
  return null;
};

const resolveInputDocumentType = (input = {}) => {
  return normalizeDocumentType(input?.documentType || input?.document_type || DOCUMENT_TYPE_NFSE);
};

const getAdapterByDocumentType = (documentType) => {
  const normalized = normalizeDocumentType(documentType);
  if (normalized === DOCUMENT_TYPE_NFSE) {
    return {
      emitir: emitirNfse,
      consultar: consultarNfse,
      consultarPorIdOuProtocolo: consultarNfsePorIdOuProtocolo,
      consultarPorIntegracao: consultarNfsePorIntegracao,
      cancelar: cancelarNfse,
      downloadPdf: downloadNfsePdf,
      downloadPdfPorIntegracao: downloadNfsePdfPorIntegracao,
      downloadXml: downloadNfseXml,
      downloadXmlPorIntegracao: downloadNfseXmlPorIntegracao
    };
  }
  if (normalized === DOCUMENT_TYPE_NFE) {
    return {
      emitir: emitirNfe,
      consultar: consultarNfe,
      consultarPorIdOuProtocolo: consultarNfePorIdOuProtocolo,
      consultarPorIntegracao: consultarNfePorIntegracao,
      cancelar: cancelarNfe,
      downloadPdf: downloadNfePdf,
      downloadPdfPorIntegracao: downloadNfePdfPorIntegracao,
      downloadXml: downloadNfeXml,
      downloadXmlPorIntegracao: downloadNfeXmlPorIntegracao
    };
  }
  if (normalized === DOCUMENT_TYPE_NFCE) {
    return {
      emitir: emitirNfce,
      consultar: consultarNfce,
      consultarPorIdOuProtocolo: consultarNfcePorIdOuProtocolo,
      consultarPorIntegracao: consultarNfcePorIntegracao,
      cancelar: cancelarNfce,
      downloadPdf: downloadNfcePdf,
      downloadPdfPorIntegracao: downloadNfcePdfPorIntegracao,
      downloadXml: downloadNfceXml,
      downloadXmlPorIntegracao: downloadNfceXmlPorIntegracao
    };
  }
  throw badRequest('documentType sem suporte operacional');
};

const collectResponseCandidates = (response) => {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [response];
  const list = [response];
  if (Array.isArray(response.documents)) list.push(...response.documents);
  if (Array.isArray(response.documentos)) list.push(...response.documentos);
  if (response.data !== undefined && response.data !== null) {
    if (Array.isArray(response.data)) list.push(...response.data);
    else if (typeof response.data === 'object') list.push(response.data);
  }
  if (response.nfse && typeof response.nfse === 'object') list.push(response.nfse);
  if (response.documento && typeof response.documento === 'object') list.push(response.documento);
  if (response.retorno && typeof response.retorno === 'object') list.push(response.retorno);
  if (response.xml && typeof response.xml === 'object') {
    list.push(response.xml);
    if (response.xml.retorno && typeof response.xml.retorno === 'object') {
      list.push(response.xml.retorno);
    }
  }
  return list;
};

/** Prioridade para desempate quando a resposta Plugnotas traz campos contraditórios. */
const plugnotasStatusRank = (normalized) => {
  if (normalized === 'cancelado') return 6;
  if (normalized === 'cancelamento_pendente') return 5;
  if (normalized === 'concluido') return 4;
  if (normalized === 'rejeitado') return 3;
  if (normalized === 'interrompido') return 2;
  if (normalized === 'processando') return 1;
  return 0;
};

const readStatusFromCandidate = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return null;
  const raw = candidate.situacao
    ?? candidate.status
    ?? candidate.message
    ?? candidate.mensagem;
  if (raw === undefined || raw === null || raw === '') return null;
  return normalizeStatus(raw);
};

const pickCandidateValue = (candidates, accessor) => {
  for (const candidate of candidates) {
    const value = accessor(candidate);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
};

const stripDiacritics = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '');

const normalizeStatus = (value) => {
  const ascii = stripDiacritics(String(value || '')).toUpperCase();
  if (!ascii) return 'processando';
  if (ascii.includes('CANCELAMENTO_PENDENTE') || (ascii.includes('CANCELAMENTO') && ascii.includes('PENDENTE'))) {
    return 'cancelamento_pendente';
  }
  if (ascii.includes('CONCLUIDO') || ascii.includes('CONCLUIDA') || ascii.includes('AUTORIZ')) return 'concluido';
  if (ascii.includes('PROCESS')) return 'processando';
  if (ascii.includes('REJEIT')) return 'rejeitado';
  if (ascii.includes('CANCEL')) return 'cancelado';
  if (ascii.includes('INTERROMP')) return 'interrompido';
  return String(value || '').toLowerCase();
};

const prune = (value) => {
  if (Array.isArray(value)) {
    const list = value.map(prune).filter((item) => item !== undefined);
    return list.length ? list : undefined;
  }
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, item]) => {
      const cleaned = prune(item);
      if (cleaned !== undefined) {
        next[key] = cleaned;
      }
    });
    return Object.keys(next).length ? next : undefined;
  }
  if (value === null || value === undefined || value === '') return undefined;
  return value;
};

const buildServicoFromInput = (input) => {
  if (!input || typeof input !== 'object') return null;
  const issSource = input.iss && typeof input.iss === 'object' ? { ...input.iss } : {};
  delete issSource.aliquota;
  const valor = input.valor || {};
  const codigoRaw = input.codigo || input.codigoServico || null;
  const codigoKey = normalizeNfseServicoCodigoForLength(codigoRaw);
  // ADN / PlugNotas: cTribNac costuma ir sem máscara (ex.: 171901).
  const codigo = codigoKey || codigoRaw;
  const discriminacao = input.discriminacao || input.descricaoServico || null;
  const cnae = input.cnae || null;
  const valorServico = input.valorServico ?? valor.servico;
  const codigoNbs = resolveCodigoNbsForServico({
    codigo,
    codigoNbs: input.codigoNbs ?? input.codigo_nbs,
  });
  const codigoTributacao = resolveCodigoTributacaoForServico(input);

  // MEI optante pelo Simples Nacional: não informar alíquota ISS no JSON (regra fiscal / prefeitura).
  return prune({
    id: input.id || null,
    codigo,
    discriminacao,
    cnae,
    codigoNbs,
    codigoTributacao,
    iss: prune(issSource),
    valor: prune({
      ...valor,
      ...(valorServico !== undefined ? { servico: toNumber(valorServico) } : {})
    })
  });
};

const estadoToUf = (estado) => {
  const s = estado ? String(estado).trim().toUpperCase() : '';
  return s.length >= 2 ? s.slice(0, 2) : s || null;
};

const buildPartyEnderecoFromInput = (enderecoInput = {}) => {
  const estadoNorm = enderecoInput?.estado ? String(enderecoInput.estado).trim().toUpperCase() : null;
  const uf = estadoToUf(estadoNorm || enderecoInput?.uf);
  const cepRaw = enderecoInput?.cep ? normalizeDoc(enderecoInput.cep).slice(0, 8) : null;
  const codigoCidadeRaw = enderecoInput?.codigoCidade;
  const codigoCidade =
    codigoCidadeRaw !== undefined && codigoCidadeRaw !== null && codigoCidadeRaw !== ''
      ? String(codigoCidadeRaw).trim()
      : null;

  return prune({
    ...enderecoInput,
    logradouro: enderecoInput?.logradouro || null,
    numero: enderecoInput?.numero || null,
    codigoCidade,
    cep: cepRaw ? String(cepRaw) : null,
    complemento: enderecoInput?.complemento || null,
    bairro: enderecoInput?.bairro || null,
    estado: estadoNorm,
    uf,
    descricaoCidade: enderecoInput?.descricaoCidade || null
  });
};

const buildPrestadorEnderecoFromInput = (input) => {
  const enderecoInput = (
    input?.prestadorEndereco
    && typeof input.prestadorEndereco === 'object'
    && !Array.isArray(input.prestadorEndereco)
      ? input.prestadorEndereco
      : (
          input?.prestador?.endereco
          && typeof input.prestador.endereco === 'object'
          && !Array.isArray(input.prestador.endereco)
            ? input.prestador.endereco
            : {}
        )
  );
  return buildPartyEnderecoFromInput(enderecoInput);
};

const buildTomadorEnderecoFromInput = (input) => {
  const flatFromPayload = normalizeTomadorEnderecoFromEmitPayload(input) || {};
  const enderecoInput = (
    input?.tomadorEndereco
    && typeof input.tomadorEndereco === 'object'
    && !Array.isArray(input.tomadorEndereco)
      ? input.tomadorEndereco
      : (
          input?.tomador?.endereco
          && typeof input.tomador.endereco === 'object'
          && !Array.isArray(input.tomador.endereco)
            ? input.tomador.endereco
            : {}
        )
  );
  return buildPartyEnderecoFromInput({ ...flatFromPayload, ...enderecoInput });
};

const buildPayloadFromInput = (input, userId) => {
  const idIntegracao = input?.idIntegracao || `mei-${userId}-${Date.now()}`;
  const prestadorDoc = normalizeDoc(
    input?.prestador?.cpfCnpj
      || input?.prestadorCpfCnpj
      || input?.cnpjPrestador
      || input?.cnpj
      || ''
  );
  const tomadorDoc = normalizeDoc(
    input?.tomador?.cpfCnpj
      || input?.tomadorCpfCnpj
      || input?.cnpjTomador
      || ''
  );
  const servicosInput = input?.servicos || input?.servico || null;
  const servicosList = Array.isArray(servicosInput)
    ? servicosInput.map(buildServicoFromInput).filter(Boolean)
    : [buildServicoFromInput(servicosInput)].filter(Boolean);
  const prestadorEndereco = buildPrestadorEnderecoFromInput(input);
  const tomadorEndereco = buildTomadorEnderecoFromInput(input);

  const prestadorBase = { ...(input?.prestador || {}) };
  delete prestadorBase.inscricaoMunicipal;

  const payload = prune({
    idIntegracao,
    enviarEmail: input?.enviarEmail ?? false,
    naturezaTributacao: input?.naturezaTributacao ?? null,
    // ADN / PlugNotas E0166: obrigatório para optante SN ME/EPP (regApTribSN).
    // 1 = trib. fed. e mun. pelo SN (padrão DAS / ISS no Simples). Número, não string.
    regimeApuracaoTributaria: resolveRegimeApuracaoTributaria(input),
    descricao: input?.descricao ?? null,
    informacoesComplementares: input?.informacoesComplementares ?? null,
    prestador: prune({
      ...prestadorBase,
      cpfCnpj: prestadorDoc || input?.prestador?.cpfCnpj || null,
      razaoSocial: input?.prestador?.razaoSocial || input?.prestadorRazaoSocial || null,
      email: input?.prestador?.email || input?.prestadorEmail || null,
      endereco: prestadorEndereco
    }),
    tomador: prune({
      ...(input?.tomador || {}),
      cpfCnpj: tomadorDoc || input?.tomador?.cpfCnpj || null,
      razaoSocial: input?.tomador?.razaoSocial || input?.tomadorRazaoSocial || null,
      email: input?.tomador?.email || input?.tomadorEmail || null,
      endereco: tomadorEndereco
    }),
    cidadePrestacao: prune(input?.cidadePrestacao || null),
    servico: servicosList
  });

  return { payload, prestadorDoc, tomadorDoc };
};

const buildNfeLikePayloadFromInput = (input, userId, { defaultModel = '55' } = {}) => {
  const idIntegracao = input?.idIntegracao || `mei-${userId}-${Date.now()}`;
  const emitenteDoc = normalizeDoc(
    input?.emitente?.cpfCnpj
      || input?.emitenteCpfCnpj
      || input?.prestadorCpfCnpj
      || input?.cnpj
      || ''
  );
  const destinatarioDoc = normalizeDoc(
    input?.destinatario?.cpfCnpj
      || input?.destinatarioCpfCnpj
      || input?.tomadorCpfCnpj
      || ''
  );
  const itensInput = Array.isArray(input?.itens)
    ? input.itens
    : (input?.item ? [input.item] : []);

  const payload = prune({
    idIntegracao,
    ...(input?.payload && typeof input.payload === 'object' ? input.payload : {}),
    modelo: input?.modelo || defaultModel,
    natureza: input?.natureza || input?.descricao || 'VENDA',
    emitente: prune({
      ...(input?.emitente || {}),
      cpfCnpj: emitenteDoc || input?.emitente?.cpfCnpj || null,
      razaoSocial: input?.emitente?.razaoSocial || input?.emitenteRazaoSocial || null,
      inscricaoEstadual: input?.emitente?.inscricaoEstadual || input?.emitenteInscricaoEstadual || null
    }),
    destinatario: prune({
      ...(input?.destinatario || {}),
      cpfCnpj: destinatarioDoc || input?.destinatario?.cpfCnpj || null,
      razaoSocial: input?.destinatario?.razaoSocial || input?.destinatarioRazaoSocial || null,
      email: input?.destinatario?.email || input?.destinatarioEmail || null,
      indIEDest: input?.destinatario?.indIEDest || input?.destinatarioIndIEDest || null,
      inscricaoEstadual:
        input?.destinatario?.inscricaoEstadual || input?.destinatarioInscricaoEstadual || null,
      endereco: prune(input?.destinatario?.endereco || input?.destinatarioEndereco || null)
    }),
    itens: itensInput,
    ...(input?.config && typeof input.config === 'object'
      ? { config: { ...input.config } }
      : {})
  }) || {};

  if (payload?.config && payload.config.producao === undefined) {
    payload.config.producao = parseBooleanLike(input?.producao, false);
  }

  return { payload, prestadorDoc: emitenteDoc, tomadorDoc: destinatarioDoc };
};

const validatePayload = (payload) => {
  const prestadorDoc = normalizeDoc(payload?.prestador?.cpfCnpj || '');
  if (!prestadorDoc) {
    throw badRequest('CNPJ do prestador é obrigatório');
  }
  if (!isValidCnpj(prestadorDoc)) {
    throw badRequest('CNPJ do prestador deve ter 14 dígitos');
  }
  const prestadorEndereco = payload?.prestador?.endereco;
  const prestadorLogradouro = String(prestadorEndereco?.logradouro || '').trim();
  if (!prestadorLogradouro) {
    throw badRequest('Logradouro do prestador é obrigatório');
  }
  const prestadorNumero = String(prestadorEndereco?.numero || '').trim();
  if (!prestadorNumero) {
    throw badRequest('Número do endereço do prestador é obrigatório');
  }
  const prestadorCodigoCidade = String(prestadorEndereco?.codigoCidade || '').trim();
  if (!prestadorCodigoCidade) {
    throw badRequest('Código IBGE da cidade do prestador é obrigatório');
  }
  const prestadorCep = normalizeDoc(prestadorEndereco?.cep || '');
  if (prestadorCep.length !== 8) {
    throw badRequest('CEP do prestador deve ter 8 dígitos');
  }

  const tomadorDoc = normalizeDoc(payload?.tomador?.cpfCnpj || '');
  if (!tomadorDoc) {
    throw badRequest('CPF/CNPJ do tomador é obrigatório');
  }
  if (!isValidCpfOrCnpj(tomadorDoc)) {
    throw badRequest('CPF/CNPJ do tomador inválido');
  }
  const tomadorRazaoSocial = String(payload?.tomador?.razaoSocial || '').trim();
  if (!tomadorRazaoSocial) {
    throw badRequest('Razão social do tomador é obrigatória');
  }

  if (tomadorDoc.length === 14) {
    const tomadorEndereco = payload?.tomador?.endereco;
    const tomadorCep = normalizeDoc(tomadorEndereco?.cep || '');
    if (tomadorCep.length !== 8) {
      throw badRequest('CEP do tomador (CNPJ) é obrigatório com 8 dígitos');
    }
    if (!String(tomadorEndereco?.logradouro || '').trim()) {
      throw badRequest('Logradouro do tomador (CNPJ) é obrigatório');
    }
    if (!String(tomadorEndereco?.numero || '').trim()) {
      throw badRequest('Número do endereço do tomador (CNPJ) é obrigatório');
    }
    if (!String(tomadorEndereco?.bairro || '').trim()) {
      throw badRequest('Bairro do tomador (CNPJ) é obrigatório');
    }
    if (!String(tomadorEndereco?.codigoCidade || '').trim()) {
      throw badRequest('Código IBGE da cidade do tomador (CNPJ) é obrigatório');
    }
    if (!String(tomadorEndereco?.descricaoCidade || '').trim()) {
      throw badRequest('Cidade do tomador (CNPJ) é obrigatória');
    }
    const tomadorUf = String(tomadorEndereco?.estado || '').trim().toUpperCase();
    if (tomadorUf.length !== 2) {
      throw badRequest('UF do tomador (CNPJ) é obrigatória');
    }
  }

  const servicos = Array.isArray(payload?.servico) ? payload.servico : [];
  if (!servicos.length) {
    throw badRequest('Serviço da NFSe é obrigatório');
  }

  const hasValidService = servicos.some((item) => {
    if (item?.id) return true;
    const valorServico = toNumber(item?.valor?.servico);

    return Boolean(
      item?.codigo
      && item?.discriminacao
      && item?.cnae
      && valorServico !== null
      && valorServico > 0
    );
  });

  if (!hasValidService) {
    throw badRequest('Serviço da NFSe está incompleto');
  }

  assertNfseServicoCodigosMinLength(payload);
};

const validateNfeLikePayload = (payload, { label = 'NF-e' } = {}) => {
  const emitenteDoc = normalizeDoc(payload?.emitente?.cpfCnpj || '');
  if (!emitenteDoc) {
    throw badRequest(`CNPJ do emitente da ${label} é obrigatório`);
  }
  if (!isValidCnpj(emitenteDoc)) {
    throw badRequest(`CNPJ do emitente da ${label} deve ter 14 dígitos`);
  }

  const destinatarioDoc = normalizeDoc(payload?.destinatario?.cpfCnpj || '');
  if (!destinatarioDoc) {
    throw badRequest(`CPF/CNPJ do destinatário da ${label} é obrigatório`);
  }
  if (!isValidCpfOrCnpj(destinatarioDoc)) {
    throw badRequest(`CPF/CNPJ do destinatário da ${label} inválido`);
  }
  const destinatarioNome = String(payload?.destinatario?.razaoSocial || '').trim();
  if (!destinatarioNome) {
    throw badRequest(`Razão social do destinatário da ${label} é obrigatória`);
  }

  if (label === 'NF-e') {
    const endereco = payload?.destinatario?.endereco;
    const cep = normalizeDoc(endereco?.cep || '');
    if (cep.length !== 8) {
      throw badRequest('CEP do destinatário da NF-e deve ter 8 dígitos');
    }
    if (!String(endereco?.logradouro || '').trim()) {
      throw badRequest('Logradouro do destinatário da NF-e é obrigatório');
    }
    if (!String(endereco?.numero || '').trim()) {
      throw badRequest('Número do endereço do destinatário da NF-e é obrigatório');
    }
    if (!String(endereco?.bairro || '').trim()) {
      throw badRequest('Bairro do destinatário da NF-e é obrigatório');
    }
    const codigoCidade = normalizeDoc(endereco?.codigoCidade || '');
    if (codigoCidade.length !== 7) {
      throw badRequest('Código IBGE da cidade do destinatário da NF-e deve ter 7 dígitos');
    }
    if (!String(endereco?.descricaoCidade || '').trim()) {
      throw badRequest('Cidade do destinatário da NF-e é obrigatória');
    }
    const uf = String(endereco?.estado || '').trim().toUpperCase();
    if (uf.length !== 2) {
      throw badRequest('UF do destinatário da NF-e deve ter 2 letras');
    }
  }

  const itens = Array.isArray(payload?.itens) ? payload.itens : [];
  if (!itens.length) {
    throw badRequest(`Itens da ${label} são obrigatórios`);
  }

  itens.forEach((item, index) => {
    const itemPos = index + 1;
    const codigo = String(item?.codigo || item?.sku || '').trim();
    if (!codigo) {
      throw badRequest(`Item ${itemPos} da ${label}: código é obrigatório`);
    }

    const descricao = String(item?.descricao || '').trim();
    if (!descricao) {
      throw badRequest(`Item ${itemPos} da ${label}: descrição é obrigatória`);
    }

    const ncm = normalizeDoc(item?.ncm || '');
    if (ncm.length !== 8) {
      throw badRequest(`Item ${itemPos} da ${label}: NCM deve ter 8 dígitos`);
    }

    const cfop = normalizeDoc(item?.cfop || '');
    if (cfop.length !== 4) {
      throw badRequest(`Item ${itemPos} da ${label}: CFOP deve ter 4 dígitos`);
    }

    const unidade = String(item?.unidade || item?.unidadeComercial || '').trim();
    if (!unidade) {
      throw badRequest(`Item ${itemPos} da ${label}: unidade é obrigatória`);
    }

    const quantidade = extractNfeItemQuantidade(item);
    if (quantidade === null || quantidade <= 0) {
      throw badRequest(`Item ${itemPos} da ${label}: quantidade deve ser maior que zero`);
    }

    const valorUnitario = extractNfeItemValorUnitario(item);
    if (valorUnitario === null || valorUnitario <= 0) {
      throw badRequest(`Item ${itemPos} da ${label}: valor unitário deve ser maior que zero`);
    }

    const tributos = toObject(item?.tributos);
    const icms = toObject(tributos?.icms);
    const pis = toObject(tributos?.pis);
    const cofins = toObject(tributos?.cofins);
    const hasIcmsCode = String(icms?.cst || '').trim() || String(icms?.csosn || '').trim();
    if (!hasIcmsCode) {
      throw badRequest(`Item ${itemPos} da ${label}: informe CST ou CSOSN do ICMS`);
    }
    if (!String(pis?.cst || '').trim()) {
      throw badRequest(`Item ${itemPos} da ${label}: CST do PIS é obrigatório`);
    }
    if (!String(cofins?.cst || '').trim()) {
      throw badRequest(`Item ${itemPos} da ${label}: CST do COFINS é obrigatório`);
    }
  });
};

const normalizeNfeLikeModel = (payload, documentType) => {
  const expected = documentType === DOCUMENT_TYPE_NFE ? '55' : '65';
  const label = documentType === DOCUMENT_TYPE_NFE ? 'NF-e' : 'NFC-e';
  const rawModel = payload?.modelo;
  const parsedModel = String(rawModel || '').trim();
  if (!parsedModel) {
    payload.modelo = expected;
    return payload;
  }
  if (parsedModel !== expected) {
    throw badRequest(`Modelo inválido para ${label}. Informe ${expected}`);
  }
  payload.modelo = expected;
  return payload;
};

const buildPayloadByDocumentType = (input, userId, documentType) => {
  const payloadBase = input?.payload && typeof input.payload === 'object'
    ? normalizePayloadShape(prune(input.payload))
    : null;

  if (documentType === DOCUMENT_TYPE_NFSE) {
    if (payloadBase) {
      return {
        payload: payloadBase,
        prestadorDoc: normalizeDoc(payloadBase?.prestador?.cpfCnpj || ''),
        tomadorDoc: normalizeDoc(payloadBase?.tomador?.cpfCnpj || '')
      };
    }
    return buildPayloadFromInput(input, userId);
  }

  if (payloadBase) {
    if (documentType === DOCUMENT_TYPE_NFE || documentType === DOCUMENT_TYPE_NFCE) {
      normalizeNfeLikeModel(payloadBase, documentType);
    }
    return {
      payload: payloadBase,
      prestadorDoc: normalizeDoc(payloadBase?.emitente?.cpfCnpj || ''),
      tomadorDoc: normalizeDoc(payloadBase?.destinatario?.cpfCnpj || '')
    };
  }

  if (documentType === DOCUMENT_TYPE_NFE) {
    return buildNfeLikePayloadFromInput(input, userId, { defaultModel: '55' });
  }
  if (documentType === DOCUMENT_TYPE_NFCE) {
    return buildNfeLikePayloadFromInput(input, userId, { defaultModel: '65' });
  }

  throw badRequest(`documentType ${documentType} sem suporte de payload`);
};

const validatePayloadByDocumentType = (payload, documentType) => {
  if (documentType === DOCUMENT_TYPE_NFSE) {
    validatePayload(payload);
    return;
  }
  if (documentType === DOCUMENT_TYPE_NFE) {
    normalizeNfeLikeModel(payload, documentType);
    validateNfeLikePayload(payload, { label: 'NF-e' });
    return;
  }
  if (documentType === DOCUMENT_TYPE_NFCE) {
    normalizeNfeLikeModel(payload, documentType);
    validateNfeLikePayload(payload, { label: 'NFC-e' });
    return;
  }
  throw badRequest(`documentType ${documentType} sem suporte de validação`);
};

const normalizePayloadShape = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const next = { ...payload };
  if (next.servico && !Array.isArray(next.servico)) {
    next.servico = [next.servico];
  }
  return next;
};

const ensureRecordId = (id) => {
  if (!id) throw badRequest('ID da nota fiscal é obrigatório');
};

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const sanitizeMetadata = (value) => {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('metadata deve ser um objeto');
  }
  return prune(value) || {};
};

const sanitizeReason = (value, { required = false } = {}) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    if (required) throw badRequest('Informe o motivo da operação');
    return null;
  }
  if (normalized.length > 500) {
    throw badRequest('Motivo deve ter no máximo 500 caracteres');
  }
  return normalized;
};

const appendAuditEvent = (record, event) => {
  const current = toObject(record?.metadata_json);
  const history = Array.isArray(current.audit) ? current.audit : [];
  return prune({
    ...current,
    audit: [...history, event].slice(-50)
  }) || {};
};

const mergeResponsePayload = (record, extra) => {
  const current = record?.response_json;
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    return prune(extra) || null;
  }
  return prune({
    ...current,
    ...extra
  }) || null;
};

const parseUpdateInput = (input) => {
  const metadata = sanitizeMetadata(input?.metadata);
  const internalDescriptionRaw = input?.descricaoInterna;
  const hasDescription = internalDescriptionRaw !== undefined;
  const descricaoInterna = hasDescription ? String(internalDescriptionRaw || '').trim() : null;
  if (hasDescription && descricaoInterna.length > 500) {
    throw badRequest('Descrição interna deve ter no máximo 500 caracteres');
  }

  const rawTags = input?.tags;
  let tags;
  if (rawTags !== undefined) {
    if (!Array.isArray(rawTags)) {
      throw badRequest('tags deve ser uma lista');
    }
    tags = rawTags
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  if (!Object.keys(metadata).length && !hasDescription && rawTags === undefined) {
    throw badRequest('Informe ao menos um campo editável para atualizar a nota fiscal');
  }

  return {
    metadata,
    ...(hasDescription ? { descricaoInterna } : {}),
    ...(rawTags !== undefined ? { tags } : {})
  };
};

const parseArchivedInput = (value) => {
  if (value === undefined) return true;
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw badRequest('Campo archived deve ser booleano');
};

const buildClienteCatalogEntry = (payload, { documentType = DOCUMENT_TYPE_NFSE } = {}) => {
  const normalizedType = normalizeDocumentType(documentType);
  const tomador = normalizedType === DOCUMENT_TYPE_NFSE
    ? toObject(payload?.tomador)
    : toObject(payload?.destinatario);
  const documento = normalizeDoc(tomador.cpfCnpj);
  const nome = String(tomador.razaoSocial || '').trim();
  const email = normalizeEmail(tomador.email);

  if (!documento && !nome && !email) return null;

  const fallbackKey = [normalizeText(nome), email].filter(Boolean).join('|');
  if (!documento && !fallbackKey) return null;

  return {
    dedupe_key: documento ? `doc:${documento}` : `fallback:${fallbackKey}`,
    documento: documento || null,
    nome: nome || null,
    email: email || null
  };
};

const mergeClienteCatalogMetadata = (existingMeta, incomingMeta) => {
  const existing = toObject(existingMeta);
  const incoming = toObject(incomingMeta);
  if (!Object.keys(incoming).length) {
    return Object.keys(existing).length ? existing : null;
  }
  const merged = { ...existing, ...incoming };
  const existingEnd = toObject(existing.endereco);
  const incomingEnd = toObject(incoming.endereco);
  if (Object.keys(existingEnd).length || Object.keys(incomingEnd).length) {
    const enderecoMerged = prune({ ...existingEnd, ...incomingEnd });
    if (enderecoMerged) merged.endereco = enderecoMerged;
  }
  return Object.keys(merged).length ? merged : null;
};

const buildClienteCatalogMetadataFromPayload = (payload, documentType) => {
  const normalizedType = normalizeDocumentType(documentType);
  const dest = normalizedType === DOCUMENT_TYPE_NFSE
    ? toObject(payload?.tomador)
    : toObject(payload?.destinatario);
  const endereco = prune(toObject(dest.endereco));
  const indIEDest = String(dest.indIEDest || '').trim();
  const meta = {};
  if (indIEDest === '1' || indIEDest === '2' || indIEDest === '9') {
    meta.indIEDest = indIEDest;
  }
  if (endereco && Object.keys(endereco).length) {
    meta.endereco = endereco;
  }
  return Object.keys(meta).length ? meta : null;
};

const buildProdutoCatalogEntries = (payload, { documentType = DOCUMENT_TYPE_NFSE } = {}) => {
  const normalizedType = normalizeDocumentType(documentType);
  if (normalizedType !== DOCUMENT_TYPE_NFSE) {
    const itens = Array.isArray(payload?.itens) ? payload.itens : [];
    return itens
      .map((item) => {
        const codigo = String(item?.codigo || item?.sku || '').trim();
        const cnae = String(item?.ncm || item?.cfop || '').trim();
        const discriminacao = String(item?.descricao || '').trim();
        const discriminacaoNorm = normalizeText(discriminacao);
        const aliquota = toNumber(
          item?.tributos?.icms?.aliquota
            ?? item?.tributos?.pis?.aliquota
            ?? item?.tributos?.cofins?.aliquota
        );
        const valorSugerido = toNumber(item?.valor || item?.valorUnitario?.comercial);
        const aliquotaKey = aliquota === null ? '' : aliquota.toFixed(4);

        if (!codigo && !cnae && !discriminacaoNorm) return null;

        return {
          dedupe_key: `item:${normalizeText(codigo)}|${normalizeText(cnae)}|${discriminacaoNorm}|${aliquotaKey}`,
          codigo,
          cnae,
          discriminacao,
          aliquota,
          valor_sugerido: valorSugerido
        };
      })
      .filter(Boolean);
  }
  const servicos = Array.isArray(payload?.servico) ? payload.servico : [];
  return servicos
    .map((item) => {
      const codigo = String(item?.codigo || '').trim();
      const cnae = String(item?.cnae || '').trim();
      const discriminacao = String(item?.discriminacao || '').trim();
      const discriminacaoNorm = normalizeText(discriminacao);
      const aliquota = toNumber(item?.iss?.aliquota);
      const valorSugerido = toNumber(item?.valor?.servico);
      const aliquotaKey = aliquota === null ? '' : aliquota.toFixed(4);

      if (!codigo && !cnae && !discriminacaoNorm) return null;

      const codigoKey = normalizeNfseServicoCodigoForLength(codigo);
      const cnaeKey = normalizeCatalogProdutoCnae(cnae);

      return {
        dedupe_key: `servico:${codigoKey}|${cnaeKey}`,
        codigo,
        cnae,
        discriminacao,
        aliquota,
        valor_sugerido: valorSugerido
      };
    })
    .filter(Boolean);
};

const applyCatalogSearch = (query, q, fields) => {
  const search = sanitizeSearchTerm(q);
  if (!search) return query;
  const like = `%${search}%`;
  const filters = fields.map((field) => `${field}.ilike.${like}`);
  return query.or(filters.join(','));
};

const defaultGetDb = () => createSupabaseClient({ useServiceRole: true });
/** @type {null | (() => import('@supabase/supabase-js').SupabaseClient)} */
let getDbOverride = null;

/** @internal Apenas testes — substitui o cliente Supabase enquanto ativo. */
export const __setGetDbForTests = (fn) => {
  getDbOverride = typeof fn === 'function' ? fn : null;
};

export const __resetGetDbForTests = () => {
  getDbOverride = null;
};

const getDb = () => (getDbOverride ? getDbOverride() : defaultGetDb());

const buildMeiIdIntegracao = (userId) =>
  `mei-${userId}-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

const resolveIdIntegracaoForEmit = async (userId, proposed) => {
  const trimmed = typeof proposed === 'string' ? proposed.trim() : '';
  if (!trimmed) return buildMeiIdIntegracao(userId);

  const dbClient = getDb();
  const { data, error } = await dbClient
    .from(TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('id_integracao', trimmed)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (data?.id) return buildMeiIdIntegracao(userId);
  return trimmed;
};

const resolveUsedNfseRpsFromEmit = (emitPayload, response) => {
  const fromPayload = readRpsFromNfseEmitPayload(emitPayload);
  if (fromPayload) return fromPayload;
  const numero = readRpsNumeroFromNfsePlugnotasBody(response);
  if (!Number.isFinite(numero)) return null;
  return { serie: '1', numero, lote: 1 };
};

const syncNfseRpsAfterE0014 = async (cnpjPrestadorNfse, emitPayload, response) => {
  const usedRps = resolveUsedNfseRpsFromEmit(emitPayload, response);
  if (!usedRps || normalizeDoc(cnpjPrestadorNfse).length !== 14) return;
  await advancePlugnotasNfseRpsAfterEmit(cnpjPrestadorNfse, usedRps).catch(() => {});
  await setNfseRpsCounterLast(getDb, cnpjPrestadorNfse, usedRps.numero).catch(() => {});
};

const maybeAdvanceNfseRpsAfterPlugnotas = (cnpjPrestador, emitPayload, response) => {
  if (normalizeDoc(cnpjPrestador).length !== 14) return;
  const usedRps = resolveUsedNfseRpsFromEmit(emitPayload, response);
  if (!usedRps) return;
  advancePlugnotasNfseRpsAfterEmit(cnpjPrestador, usedRps).catch(() => {});
};

const isNfseDuplicateRpsRejectedEmit = (response, status) => (
  isNfseRejectedPlugnotasResponse(response, normalizeStatus(status))
  && isNfseRpsDuplicateRejectionLoose(response)
);

const isNfseEmitStatusTerminal = (status) => {
  const normalized = normalizeStatus(status);
  return normalized === 'concluido'
    || normalized === 'rejeitado'
    || normalized === 'cancelado'
    || normalized === 'interrompido';
};

const parsePositiveIntLocal = (value, fallback = NaN) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(n) && n >= 1) return n;
  return fallback;
};

const NFSE_EMIT_TERMINAL_POLL_MAX_MS = 8000;
const NFSE_EMIT_PROCESSING_POLL_MAX_MS = 28000;
const NFSE_EMIT_TERMINAL_POLL_INTERVAL_MS = 1000;
const NFSE_EMIT_E0014_RETRY_MAX = 5;
const NFSE_PERIODO_FAST_PAGES = 6;
const NFSE_PROCESSING_FOLLOWUP_MS = 95000;
/** Tempo mínimo na lista principal antes de arquivar E0014 automaticamente. */
const NFSE_E0014_VISIBLE_BEFORE_ARCHIVE_MS = 20000;

/** Serializa emissões NFS-e por CNPJ prestador — evita duas requisições paralelas queimando DPS seguidos. */
const nfseEmitLockTailByCnpj = new Map();

const withNfseEmitLock = async (cnpjPrestador, task) => {
  const cnpj = normalizeDoc(cnpjPrestador);
  if (cnpj.length !== 14) return await task();

  const previous = nfseEmitLockTailByCnpj.get(cnpj) || Promise.resolve();
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const current = previous.then(() => gate);
  nfseEmitLockTailByCnpj.set(cnpj, current);

  await previous;
  try {
    return await task();
  } finally {
    release();
    if (nfseEmitLockTailByCnpj.get(cnpj) === current) {
      nfseEmitLockTailByCnpj.delete(cnpj);
    }
  }
};

const isHiddenNfseE0014RejectedRow = (row) => {
  if (normalizeDocumentType(row?.document_type || DOCUMENT_TYPE_NFSE) !== DOCUMENT_TYPE_NFSE) {
    return false;
  }
  const status = normalizeStatus(row?.status);
  if (status === 'rejeitado') {
    if (isNfseE0014FromPlugnotasResponse(row?.response_json)) return true;
    if (isNfseE0014FromPlugnotasResponse(row?.payload_json)) return true;
    if (row?.metadata_json?.nfseRejectionCode === 'E0014') return true;
  }
  return false;
};

const archiveE0014RejectedRowsOnList = async (userId, rows) => {
  if (!userId || !Array.isArray(rows) || !rows.length) return;
  const now = Date.now();
  const targets = rows.filter((row) => {
    if (!isHiddenNfseE0014RejectedRow(row) || row.archived_at) return false;
    const createdMs = new Date(row.created_at).getTime();
    if (!Number.isFinite(createdMs)) return false;
    return now - createdMs >= NFSE_E0014_VISIBLE_BEFORE_ARCHIVE_MS;
  });
  if (!targets.length) return;

  await Promise.all(targets.map(async (row) => {
    try {
      await updateRecord(userId, row.id, {
        archived_at: new Date().toISOString(),
        metadata_json: appendAuditEvent(row, {
          type: 'auto_archive_e0014',
          nfseRejectionCode: 'E0014',
          at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.warn('[plugnotas-rps] auto-arquivar E0014 na listagem falhou', {
        notaId: row.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }));
};

const scheduleNfseProcessandoSyncFollowUp = (userId, notaId) => {
  if (!userId || !notaId) return;
  void (async () => {
    await sleep(NFSE_PROCESSING_FOLLOWUP_MS);
    try {
      await obterNota(userId, notaId, { sync: true, skipWhatsappDelivery: true });
    } catch (error) {
      console.warn('[plugnotas-rps] follow-up sync processando falhou', {
        notaId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();
};

const healNfseRpsAfterE0014RecordIfNeeded = async (userId, record, response, status) => {
  if (!record?.id || !userId) return record;
  const isE0014 = isNfseDuplicateRpsRejectedEmit(response, status)
    || isNfseE0014FromPlugnotasResponse(response);
  if (!isE0014) return record;

  const cnpjPrestador = normalizeDoc(record.cnpj_prestador)
    || normalizeDoc(record.payload_json?.prestador?.cpfCnpj);
  const usedRps = resolveUsedNfseRpsFromEmit(record.payload_json, response);
  if (usedRps && cnpjPrestador.length === 14) {
    await syncNfseRpsAfterE0014(cnpjPrestador, record.payload_json, response);
  }

  return record;
};

/**
 * Poll curto em PROCESSANDO para bloquear E0014 antes de gravar; CONCLUIDO retorna na hora.
 */
const finalizeNfseEmitStateBeforePersist = async (
  adapter,
  { response, emitPayload, cnpjPrestadorNfse },
) => {
  let currentResponse = response;
  let status = extractPlugNotasStatus(currentResponse);
  let normalized = normalizeStatus(status);

  if (normalized === 'concluido') {
    return { response: currentResponse, status };
  }

  if (normalized === 'processando') {
    const integracao = extractIntegracaoId(currentResponse) || emitPayload?.idIntegracao;
    if (integracao && cnpjPrestadorNfse.length === 14) {
      currentResponse = await awaitNfseEmitTerminalResponse(adapter, {
        initialResponse: currentResponse,
        idIntegracao: integracao,
        cnpjPrestador: cnpjPrestadorNfse,
        maxWaitMs: NFSE_EMIT_PROCESSING_POLL_MAX_MS,
        intervalMs: NFSE_EMIT_TERMINAL_POLL_INTERVAL_MS,
      });
      status = extractPlugNotasStatus(currentResponse);
      normalized = normalizeStatus(status);
    }
    if (isNfseDuplicateRpsRejectedEmit(currentResponse, status)
      || isNfseRpsDuplicateRejectionLoose(currentResponse)) {
      await syncNfseRpsAfterE0014(cnpjPrestadorNfse, emitPayload, currentResponse);
    }
    if (normalized !== 'processando') {
      return { response: currentResponse, status };
    }
    return { response: currentResponse, status };
  }

  if (isNfseDuplicateRpsRejectedEmit(currentResponse, status)) {
    await syncNfseRpsAfterE0014(cnpjPrestadorNfse, emitPayload, currentResponse);
  }

  if (isNfseEmitStatusTerminal(status)) {
    return { response: currentResponse, status };
  }

  const integracao = extractIntegracaoId(currentResponse) || emitPayload?.idIntegracao;
  if (integracao && cnpjPrestadorNfse.length === 14) {
    currentResponse = await awaitNfseEmitTerminalResponse(adapter, {
      initialResponse: currentResponse,
      idIntegracao: integracao,
      cnpjPrestador: cnpjPrestadorNfse,
      maxWaitMs: NFSE_EMIT_TERMINAL_POLL_MAX_MS,
      intervalMs: NFSE_EMIT_TERMINAL_POLL_INTERVAL_MS,
    });
    status = extractPlugNotasStatus(currentResponse);
    if (isNfseDuplicateRpsRejectedEmit(currentResponse, status)) {
      await syncNfseRpsAfterE0014(cnpjPrestadorNfse, emitPayload, currentResponse);
    }
  }

  return { response: currentResponse, status };
};

const prepareNfseEmitRpsAfterDuplicateRejection = async (
  response,
  status,
  emitPayload,
  cnpjPrestadorNfse,
) => {
  if (isNfseDuplicateRpsRejectedEmit(response, status)) {
    await syncNfseRpsAfterE0014(cnpjPrestadorNfse, emitPayload, response);
    return;
  }
  if (
    normalizeStatus(status) === 'rejeitado'
    && isNfseRpsDuplicateRejectionLoose(response)
  ) {
    await syncNfseRpsAfterE0014(cnpjPrestadorNfse, emitPayload, response);
  }
};

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * NFS-e Nacional pode voltar PROCESSANDO no POST e rejeitar segundos depois (E0014).
 * Consulta até estado terminal antes de gravar no banco.
 */
const awaitNfseEmitTerminalResponse = async (
  adapter,
  {
    initialResponse,
    idIntegracao,
    cnpjPrestador,
    maxWaitMs = NFSE_EMIT_TERMINAL_POLL_MAX_MS,
    intervalMs = NFSE_EMIT_TERMINAL_POLL_INTERVAL_MS,
  },
) => {
  let response = initialResponse;
  let status = extractPlugNotasStatus(response);
  if (isNfseEmitStatusTerminal(status)) return response;

  const integracao = idIntegracao || extractIntegracaoId(response);
  const cnpj = normalizeDoc(cnpjPrestador);
  if (!integracao || cnpj.length !== 14 || !adapter.consultarPorIntegracao) {
    return response;
  }

  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    await sleep(intervalMs);
    try {
      const polled = await adapter.consultarPorIntegracao(integracao, cnpj);
      if (!polled) continue;
      response = polled;
      status = extractPlugNotasStatus(polled);
      if (isNfseEmitStatusTerminal(status)) return response;
    } catch {
      // continua até timeout
    }
  }

  return response;
};

/**
 * Emite NFS-e com reserva atômica (RPC Postgres) e até 3 tentativas em E0014 no mesmo clique.
 */
const emitNfseWithAutoRpsRecovery = async (
  adapter,
  userId,
  cnpjPrestadorNfse,
  basePayload,
  prep = {},
) => {
  const emitStartedAt = Date.now();
  let localMax = parsePositiveIntLocal(prep.initialLocalMax, 0)
    || parsePositiveIntLocal(await queryMaxRpsNumeroEmitted(userId, cnpjPrestadorNfse), 0);

  const empresaJsonCache = prep.empresaJson ?? null;
  let emitPayload = { ...basePayload };
  let response;

  for (let attempt = 0; attempt < NFSE_EMIT_E0014_RETRY_MAX; attempt += 1) {
    emitPayload = { ...basePayload };
    const allocation = await allocateNfseRpsForEmit(
      getDb,
      cnpjPrestadorNfse,
      localMax,
      empresaJsonCache,
    );
    localMax = Math.max(localMax, allocation.numero);

    console.info('[plugnotas-rps] emit baseline', {
      attempt: attempt + 1,
      localMax,
      floor: allocation.floor,
      reserved: allocation.numero,
    });

    try {
      await applyAllocatedNfseRpsToEmitPayload(
        emitPayload,
        cnpjPrestadorNfse,
        allocation,
        empresaJsonCache,
      );
    } catch (syncError) {
      // Contador local atrasado vs Plug (Pendente/Processando/Cancelado): sync falha
      // ANTES do POST — sem isso o usuário vê "conflito RPS" e nada aparece na Plug.
      if (isPlugnotasNfseRpsNumeroJaUtilizadoError(syncError)) {
        console.warn('[plugnotas-rps] sync pré-emissão: número já usado — avanço e nova reserva', {
          attempt: attempt + 1,
          blockedAt: allocation.numero,
          message: syncError instanceof Error ? syncError.message : String(syncError),
        });
        await forceNfseRpsCounterFloor(getDb, cnpjPrestadorNfse, allocation.numero).catch(() => {});
        await advancePlugnotasNfseRpsAfterEmit(cnpjPrestadorNfse, {
          serie: allocation.serie,
          lote: allocation.lote,
          numero: allocation.numero,
        }).catch(() => {});
        localMax = Math.max(localMax, allocation.numero);
        if (attempt + 1 >= NFSE_EMIT_E0014_RETRY_MAX) {
          throw new Error(
            'Numeração RPS/DPS em conflito na PlugNotas (número já utilizado). '
            + 'No painel PlugNotas, confira Pendente/Processando; se persistir, '
            + 'em Certificado → Empresa aumente o próximo número acima do último DPS.',
          );
        }
        continue;
      }
      throw syncError;
    }

    emitPayload.idIntegracao = buildMeiIdIntegracao(userId);
    response = await adapter.emitir(emitPayload);

    const integracaoPoll = extractIntegracaoId(response) || emitPayload.idIntegracao;
    let status = extractPlugNotasStatus(response);
    let normalized = normalizeStatus(status);

    if (normalized !== 'concluido' && integracaoPoll && cnpjPrestadorNfse.length === 14) {
      response = await awaitNfseEmitTerminalResponse(adapter, {
        initialResponse: response,
        idIntegracao: integracaoPoll,
        cnpjPrestador: cnpjPrestadorNfse,
        maxWaitMs: NFSE_EMIT_PROCESSING_POLL_MAX_MS,
        intervalMs: NFSE_EMIT_TERMINAL_POLL_INTERVAL_MS,
      });
      status = extractPlugNotasStatus(response);
      normalized = normalizeStatus(status);
    }

    if (!isNfseE0014FromPlugnotasResponse(response)) {
      break;
    }

    const usedRps = resolveUsedNfseRpsFromEmit(emitPayload, response);
    if (usedRps) {
      await syncNfseRpsAfterE0014(cnpjPrestadorNfse, emitPayload, response);
      localMax = Math.max(localMax, usedRps.numero);
    }

    console.warn('[plugnotas-rps] E0014 na emissão — nova reserva no mesmo clique', {
      attempt: attempt + 1,
      usedDps: usedRps?.numero,
      nextLocalMax: localMax,
    });
  }

  const payloadNumero = readRpsFromNfseEmitPayload(emitPayload)?.numero;
  console.info('[plugnotas-rps] emit response', {
    status: normalizeStatus(extractPlugNotasStatus(response)),
    dps: payloadNumero,
    elapsedMs: Date.now() - emitStartedAt,
  });

  return { response, emitPayload };
};

const queryMaxRpsNumeroEmitted = async (userId, cnpjPrestador) => {
  const cnpj = normalizeDoc(cnpjPrestador);
  if (!userId || cnpj.length !== 14) return null;

  const dbClient = getDb();
  const { data, error } = await dbClient
    .from(TABLE)
    .select('payload_json, response_json, document_type, cnpj_prestador')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw badRequest(error.message);

  let maxKnown = 0;
  for (const row of data || []) {
    const docType = row.document_type;
    if (docType && docType !== DOCUMENT_TYPE_NFSE) continue;

    const rowCnpj = normalizeDoc(row.cnpj_prestador)
      || normalizeDoc(row.payload_json?.prestador?.cpfCnpj);
    if (rowCnpj && rowCnpj !== cnpj) continue;

    const numero = readRpsNumeroFromNfseHistoryRow(row);
    if (numero > maxKnown) maxKnown = numero;
  }
  return resolveNfseRpsLocalMaxFromHistory({ maxKnownNumero: maxKnown });
};

const mapInsertRecordError = (error) => {
  const message = String(error?.message || '');
  const code = String(error?.code || '');
  if (
    code === '23505'
    && (message.includes('id_integracao') || message.includes('mei_nfse_user_doc_type_id_integracao'))
  ) {
    throw badRequest(
      'Esta emissão já foi registrada. Confira a lista de notas ou aguarde alguns segundos e tente novamente.',
      { code: 'MEI_ID_INTEGRACAO_DUPLICATE' }
    );
  }
  throw badRequest(message);
};

const insertRecord = async (userId, data) => {
  const dbClient = getDb();
  const { data: created, error } = await dbClient
    .from(TABLE)
    .insert({
      ...data,
      user_id: userId,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  if (error) mapInsertRecordError(error);
  return created;
};

const updateRecord = async (userId, id, updates) => {
  const dbClient = getDb();
  const { data, error } = await dbClient
    .from(TABLE)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw badRequest(error.message);
  return data;
};

const findRecord = async (userId, id) => {
  const dbClient = getDb();
  const { data, error } = await dbClient
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound('Nota fiscal não encontrada');
  return data;
};

const upsertClienteCatalogo = async (userId, payload, { documentType = DOCUMENT_TYPE_NFSE } = {}) => {
  const normalizedType = normalizeDocumentType(documentType);
  const entry = buildClienteCatalogEntry(payload, { documentType: normalizedType });
  if (!entry) return null;

  const fiscalMeta = buildClienteCatalogMetadataFromPayload(payload, normalizedType);

  const now = new Date().toISOString();
  const dbClient = getDb();
  const upsertRow = {
    ...entry,
    user_id: userId,
    document_type: normalizedType,
    last_used_at: now,
    updated_at: now
  };
  if (fiscalMeta) {
    const { data: existingRow } = await dbClient
      .from(CLIENTS_TABLE)
      .select('metadata_json')
      .eq('user_id', userId)
      .eq('document_type', normalizedType)
      .eq('dedupe_key', entry.dedupe_key)
      .maybeSingle();
    const merged = mergeClienteCatalogMetadata(existingRow?.metadata_json, fiscalMeta);
    upsertRow.metadata_json = setCatalogActiveInMetadata(merged, true);
  } else {
    const { data: existingRow } = await dbClient
      .from(CLIENTS_TABLE)
      .select('metadata_json')
      .eq('user_id', userId)
      .eq('document_type', normalizedType)
      .eq('dedupe_key', entry.dedupe_key)
      .maybeSingle();
    if (existingRow && !isCatalogClienteRowActive(existingRow)) {
      upsertRow.metadata_json = setCatalogActiveInMetadata(existingRow.metadata_json, true);
    }
  }
  const { error } = await dbClient
    .from(CLIENTS_TABLE)
    .upsert(upsertRow, { onConflict: 'user_id,document_type,dedupe_key' });
  if (error) throw badRequest(error.message);
  return entry;
};

const upsertProdutosCatalogo = async (userId, payload, { documentType = DOCUMENT_TYPE_NFSE } = {}) => {
  const normalizedType = normalizeDocumentType(documentType);
  const entries = buildProdutoCatalogEntries(payload, { documentType: normalizedType });
  if (!entries.length) return 0;

  const now = new Date().toISOString();
  const dbClient = getDb();
  let upserted = 0;

  for (const entry of entries) {
    const existing = await findCatalogoProdutoByCodigoCnae(
      userId,
      entry.codigo,
      entry.cnae,
      normalizedType,
    );
    if (existing?.id) {
      const { error } = await dbClient
        .from(PRODUCTS_TABLE)
        .update({ last_used_at: now, updated_at: now })
        .eq('id', existing.id)
        .eq('user_id', userId);
      if (error) throw badRequest(error.message);
      upserted += 1;
      continue;
    }

    const { error } = await dbClient
      .from(PRODUCTS_TABLE)
      .upsert({
        ...entry,
        user_id: userId,
        document_type: normalizedType,
        last_used_at: now,
        updated_at: now,
      }, { onConflict: 'user_id,document_type,dedupe_key' });
    if (error) throw badRequest(error.message);
    upserted += 1;
  }

  return upserted;
};

/**
 * Pós-emissão NFSe: só marca last_used_at em serviço já cadastrado (código+CNAE).
 * Não insere linhas novas — discriminação na nota costuma diferir do catálogo.
 */
const touchProdutosCatalogoOnEmit = async (userId, payload, { documentType = DOCUMENT_TYPE_NFSE } = {}) => {
  const normalizedType = normalizeDocumentType(documentType);
  if (normalizedType !== DOCUMENT_TYPE_NFSE) {
    return upsertProdutosCatalogo(userId, payload, { documentType: normalizedType });
  }

  const entries = buildProdutoCatalogEntries(payload, { documentType: normalizedType });
  if (!entries.length) return 0;

  const now = new Date().toISOString();
  const dbClient = getDb();
  let touched = 0;

  for (const entry of entries) {
    const existing = await findCatalogoProdutoByCodigoCnae(
      userId,
      entry.codigo,
      entry.cnae,
      normalizedType,
    );
    if (!existing?.id) continue;

    const { error } = await dbClient
      .from(PRODUCTS_TABLE)
      .update({ last_used_at: now, updated_at: now })
      .eq('id', existing.id)
      .eq('user_id', userId);
    if (error) throw badRequest(error.message);
    touched += 1;
  }

  return touched;
};

const hasCancelamentoSolicitado = (record) => {
  const meta = toObject(record?.metadata_json);
  const cancel = toObject(meta?.cancelamento);
  return Boolean(cancel?.requestedAt);
};

/**
 * Evita que sync com o emissor reverta cancelamento local para "concluido"
 * enquanto a nota ainda aparece AUTORIZADA na Plugnotas.
 */
export const resolveStatusAfterPlugnotasSync = (record, providerStatus) => {
  const local = normalizeStatus(record?.status);
  const remote = normalizeStatus(providerStatus);
  if (!remote) return local;

  if (remote === 'cancelado') return 'cancelado';

  if (local === 'cancelado') return 'cancelado';

  const cancelamentoEmCurso =
    local === 'cancelamento_pendente' || hasCancelamentoSolicitado(record);

  if (cancelamentoEmCurso) {
    if (remote === 'concluido' || remote === 'processando') {
      return 'cancelamento_pendente';
    }
    return local === 'cancelamento_pendente' ? 'cancelamento_pendente' : remote;
  }

  return remote;
};

export const extractPlugNotasStatus = (response) => {
  const candidates = collectResponseCandidates(response);
  let best = '';
  let bestRank = 0;
  for (const candidate of candidates) {
    const normalized = readStatusFromCandidate(candidate);
    if (!normalized) continue;
    const rank = plugnotasStatusRank(normalized);
    if (rank > bestRank) {
      bestRank = rank;
      best = normalized;
    }
  }
  if (best) return best;
  return normalizeStatus(
    pickCandidateValue(candidates, (candidate) => (
      candidate?.status
        || candidate?.situacao
        || candidate?.message
        || candidate?.mensagem
    )) || '',
  );
};

export const extractPlugNotasId = (response) => {
  const candidates = collectResponseCandidates(response);
  return pickCandidateValue(candidates, (candidate) => candidate?.id);
};

export const extractIntegracaoId = (response) => {
  const candidates = collectResponseCandidates(response);
  return pickCandidateValue(candidates, (candidate) => candidate?.idIntegracao);
};

const extractProtocol = (response) => {
  const candidates = collectResponseCandidates(response);
  return pickCandidateValue(candidates, (candidate) => candidate?.protocol || candidate?.protocolo);
};

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Evita usar o id interno Supabase como id Plugnotas (protocolo errado na lista). */
const isLikelyInternalRecordUuid = (value, recordId) => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (recordId && normalized === String(recordId).trim()) return true;
  return UUID_V4_RE.test(normalized);
};

/**
 * Resolve id remoto Plugnotas para cancelar/consultar (prioriza consulta por integração).
 */
export const resolvePlugnotasProviderIdForRecord = async (record, adapter) => {
  if (!record || !adapter) return null;
  const recordId = record.id;

  const plugId = record.plugnotas_id ? String(record.plugnotas_id).trim() : '';
  if (plugId && !isLikelyInternalRecordUuid(plugId, recordId)) {
    return plugId;
  }

  if (record.id_integracao && record.cnpj_prestador && adapter.consultarPorIntegracao) {
    try {
      const lookup = await adapter.consultarPorIntegracao(record.id_integracao, record.cnpj_prestador);
      const resolved = extractPlugNotasId(lookup);
      if (resolved && !isLikelyInternalRecordUuid(resolved, recordId)) {
        return String(resolved).trim();
      }
    } catch (_error) {
      // segue para outros fallbacks
    }
  }

  const protocol = record.protocol ? String(record.protocol).trim() : '';
  if (protocol && !isLikelyInternalRecordUuid(protocol, recordId) && adapter.consultarPorIdOuProtocolo) {
    try {
      const lookup = await adapter.consultarPorIdOuProtocolo(protocol);
      const resolved = extractPlugNotasId(lookup) || protocol;
      if (resolved && !isLikelyInternalRecordUuid(resolved, recordId)) {
        return String(resolved).trim();
      }
    } catch (_error) {
      // ignora
    }
  }

  if (plugId) return plugId;
  if (protocol && !isLikelyInternalRecordUuid(protocol, recordId)) return protocol;
  return null;
};

const refreshWithPlugNotas = async (record) => {
  const documentType = normalizeDocumentType(record?.document_type || DOCUMENT_TYPE_NFSE);
  const adapter = getAdapterByDocumentType(documentType);
  // NFSe: rota consultar/{idIntegracao}/{cnpj} costuma trazer retorno.situacao (AUTORIZADA) completo.
  if (
    documentType === DOCUMENT_TYPE_NFSE
    && record?.id_integracao
    && record?.cnpj_prestador
    && adapter.consultarPorIntegracao
  ) {
    return await adapter.consultarPorIntegracao(record.id_integracao, record.cnpj_prestador);
  }
  if (record?.plugnotas_id) return await adapter.consultar(record.plugnotas_id);
  if (record?.protocol && adapter.consultarPorIdOuProtocolo) {
    return await adapter.consultarPorIdOuProtocolo(record.protocol);
  }
  if (record?.id_integracao && record?.cnpj_prestador && adapter.consultarPorIntegracao) {
    return await adapter.consultarPorIntegracao(record.id_integracao, record.cnpj_prestador);
  }
  return null;
};

export const emitirNota = async (userId, input) => {
  const startedAt = Date.now();
  let documentType = fallbackDocumentTypeLabelFromInput(input);
  /** @type {'resolve'|'adapter'|'build'|'validate'|'plugnotas_emit'|'insert_record'} */
  let phase = 'resolve';

  try {
    documentType = resolveInputDocumentType(input);
    if (
      isMeiNfeNfceEmitDisabledByServerPolicy() &&
      (documentType === DOCUMENT_TYPE_NFE || documentType === DOCUMENT_TYPE_NFCE)
    ) {
      throw forbidden('Emissão de NF-e ou NFC-e indisponível neste ambiente.');
    }
    phase = 'adapter';
    const adapter = getAdapterByDocumentType(documentType);
    phase = 'build';
    const { payload, prestadorDoc, tomadorDoc } = buildPayloadByDocumentType(input, userId, documentType);
    const metadata = sanitizeMetadata(input?.metadata);

    if (!payload?.idIntegracao) {
      payload.idIntegracao = buildMeiIdIntegracao(userId);
    } else {
      payload.idIntegracao = await resolveIdIntegracaoForEmit(userId, payload.idIntegracao);
    }

    let emitPayload = payload;
    if (documentType === DOCUMENT_TYPE_NFSE) {
      emitPayload = await enrichNfseEmitPayloadEmails(userId, emitPayload, {
        prestadorDoc,
        tomadorDoc,
        emitInput: input,
      });
    }

    phase = 'validate';
    validatePayloadByDocumentType(emitPayload, documentType);

    if (documentType === DOCUMENT_TYPE_NFSE) {
      assertNfsePrestadorEmailOrThrow(emitPayload);
    }
    if (documentType === DOCUMENT_TYPE_NFE || documentType === DOCUMENT_TYPE_NFCE) {
      emitPayload = normalizePlugnotasNfePayload(payload);
      const cnpjEmitente = prestadorDoc
        || String(payload?.emitente?.cpfCnpj || payload?.prestador?.cpfCnpj || '').replace(/\D/g, '');
      if (cnpjEmitente.length === 14) {
        const empresaPlugnotas = await ensureMeiNfePlugnotasCadastroBeforeEmit(cnpjEmitente);
        emitPayload = hydrateMeiNfeEmitenteIeFromEmpresa(emitPayload, empresaPlugnotas);
      }
      emitPayload = applyMeiNfeEmitForcePolicy(emitPayload);
    }

    phase = 'plugnotas_emit';
    let cnpjPrestadorNfse = '';
    let nfseEmitPrep = null;
    if (documentType === DOCUMENT_TYPE_NFSE) {
      cnpjPrestadorNfse = prestadorDoc
        || String(payload?.prestador?.cpfCnpj || payload?.emitente?.cpfCnpj || '').replace(/\D/g, '');
      if (cnpjPrestadorNfse.length === 14) {
        const empresaJsonCache = await ensureMeiNfsePlugnotasCadastroBeforeEmit(userId, cnpjPrestadorNfse);
        await ensureEmpresaPlugnotasRpsForNfseEmit(cnpjPrestadorNfse, empresaJsonCache);
        const [initialLocalMax, authoritativeMax] = await Promise.all([
          queryMaxRpsNumeroEmitted(userId, cnpjPrestadorNfse),
          queryAuthoritativeNfseRpsMaxUsed(cnpjPrestadorNfse, 0),
        ]);
        nfseEmitPrep = {
          empresaJson: empresaJsonCache,
          initialLocalMax: Math.max(initialLocalMax ?? 0, authoritativeMax),
          periodoMax: authoritativeMax,
        };
      }
    }
    let response;
    try {
      if (documentType === DOCUMENT_TYPE_NFSE && cnpjPrestadorNfse.length === 14) {
        const auto = await withNfseEmitLock(cnpjPrestadorNfse, () => emitNfseWithAutoRpsRecovery(
          adapter,
          userId,
          cnpjPrestadorNfse,
          emitPayload,
          nfseEmitPrep ?? {},
        ));
        response = auto.response;
        emitPayload = auto.emitPayload;
      } else {
        response = await adapter.emitir(emitPayload);
      }
    } catch (emitError) {
      if (documentType === DOCUMENT_TYPE_NFSE) {
        rethrowIfPlugnotasEmpresaNaoCadastrada(emitError);
      }
      throw emitError;
    }
    const plugnotasId = extractPlugNotasId(response);
    const idIntegracao = extractIntegracaoId(response) || payload.idIntegracao;
    let status = extractPlugNotasStatus(response);
    const protocol = extractProtocol(response);

    if (documentType === DOCUMENT_TYPE_NFSE && cnpjPrestadorNfse.length === 14) {
      const finalized = await finalizeNfseEmitStateBeforePersist(adapter, {
        response,
        emitPayload,
        cnpjPrestadorNfse,
      });
      response = finalized.response;
      status = finalized.status;
      await prepareNfseEmitRpsAfterDuplicateRejection(
        response,
        status,
        emitPayload,
        cnpjPrestadorNfse,
      );
    }

    if (isPlugnotasDebugExplicitlyEnabled()) {
      const hasData = response && typeof response === 'object' && 'data' in response;
      const dataIsArray = hasData && Array.isArray(response.data);
      console.log('[mei-notas] emissão resposta', {
        responseIsArray: Array.isArray(response),
        hasData,
        dataIsArray,
        plugnotasId: plugnotasId ? 'presente' : 'ausente',
        idIntegracao: idIntegracao ? 'presente' : 'ausente'
      });
    }

    phase = 'insert_record';
    if (documentType === DOCUMENT_TYPE_NFSE && cnpjPrestadorNfse.length === 14) {
      await prepareNfseEmitRpsAfterDuplicateRejection(
        response,
        status,
        emitPayload,
        cnpjPrestadorNfse,
      );
    }
    const rejectionMeta = (() => {
      if (documentType !== DOCUMENT_TYPE_NFSE) return null;
      if (normalizeStatus(status) !== 'rejeitado') return null;
      if (!isNfseE0014FromPlugnotasResponse(response)) return null;
      return { nfseRejectionCode: 'E0014' };
    })();
    const created = await insertRecord(userId, {
      plugnotas_id: plugnotasId,
      protocol,
      id_integracao: idIntegracao,
      status,
      document_type: documentType,
      provider: PROVIDER_PLUGNOTAS,
      cnpj_prestador: prestadorDoc
        || normalizeDoc(payload?.prestador?.cpfCnpj || payload?.emitente?.cpfCnpj || ''),
      cnpj_tomador: tomadorDoc
        || normalizeDoc(payload?.tomador?.cpfCnpj || payload?.destinatario?.cpfCnpj || ''),
      payload_json: emitPayload,
      response_json: response,
      metadata_json: prune({
        ...(Object.keys(metadata).length ? metadata : {}),
        ...(rejectionMeta ?? {}),
      }) || null
    });

    try {
      await upsertClienteCatalogo(userId, emitPayload, { documentType });
      await touchProdutosCatalogoOnEmit(userId, emitPayload, { documentType });
    } catch (error) {
      console.warn(
        `[mei-notas] Falha ao atualizar catalogo ${documentType}`,
        error instanceof Error ? error.message : error
      );
    }

    if (documentType === DOCUMENT_TYPE_NFSE && cnpjPrestadorNfse.length === 14) {
      const usedRps = resolveUsedNfseRpsFromEmit(emitPayload, response);
      const isDuplicateRpsRejection = isNfseDuplicateRpsRejectedEmit(response, status);
      if (isDuplicateRpsRejection && usedRps) {
        await syncNfseRpsAfterE0014(cnpjPrestadorNfse, emitPayload, response);
      } else {
        maybeAdvanceNfseRpsAfterPlugnotas(cnpjPrestadorNfse, emitPayload, response);
      }
      if (normalizeStatus(status) === 'processando') {
        scheduleNfseProcessandoSyncFollowUp(userId, created.id);
      }
    }

    const duration_ms = Date.now() - startedAt;
    const plugnotas_status = sanitizePlugnotasStatusForLog(status);
    logMeiEmitOutcome({
      document_type: documentType,
      duration_ms,
      outcome: 'success',
      route: MEI_EMIT_ROUTE_EMITIR_NOTA,
      ...(plugnotas_status ? { plugnotas_status } : {})
    });

    return created;
  } catch (error) {
    const duration_ms = Date.now() - startedAt;
    const plugnotasPhase = phase === 'plugnotas_emit' || phase === 'insert_record';
    const outcome = plugnotasPhase ? 'plugnotas_error' : 'validation_error';
    const meta = extractMeiEmitHttpMeta(error);
    logMeiEmitOutcome({
      document_type: documentType,
      duration_ms,
      outcome,
      route: MEI_EMIT_ROUTE_EMITIR_NOTA,
      failure_phase: phase,
      ...meta
    });
    throw error;
  }
};

const clampListarNotasLimit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 500;
  return Math.min(Math.max(Math.trunc(n), 1), 1000);
};

export const listarNotas = async (
  userId,
  { includeArchived = false, documentType, limit: limitOpt } = {}
) => {
  const safeLimit = clampListarNotasLimit(limitOpt);
  const dbClient = getDb();
  let query = dbClient
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (documentType) {
    query = query.eq('document_type', normalizeDocumentType(documentType));
  }
  if (!includeArchived) {
    query = query.is('archived_at', null);
  }
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  const rows = data || [];
  await archiveE0014RejectedRowsOnList(userId, rows);
  if (includeArchived) return rows;
  return rows.filter((row) => !row.archived_at);
};

const clampAnoCivilLimite = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const y = Math.trunc(n);
  if (y < 2000 || y > 2100) return null;
  return y;
};

/**
 * Agrega faturamento MEI no ano civil a partir de `payload_json` na tabela `mei_nfse`
 * (paridade com o cliente em `meiLimiteFaturamento.ts`).
 * FR-GUIA-FISC-17: consulta só linhas `document_type` NFSE ou legado `null`; NFE/NFCE não entram no somatório.
 * Notas arquivadas na UI entram no total (arquivar ≠ cancelar); só status cancelado/rejeitado fica de fora.
 * @param {string} userId
 * @param {number} anoCivil
 * @returns {Promise<{ anoCivil: number, totalUtilizadoReais: number, notasConsideradas: number }>}
 */
export const agregarLimiteFaturamento = async (userId, anoCivil) => {
  const safeYear = clampAnoCivilLimite(anoCivil);
  if (safeYear === null) {
    throw badRequest('Ano civil inválido para o limite de faturamento');
  }
  const dbClient = getDb();
  const { startIso, endExclusiveIso } = civilYearCreatedAtBoundsUtcIso(safeYear);
  let query = dbClient
    .from(TABLE)
    .select('payload_json, response_json, status, created_at, document_type, archived_at')
    .eq('user_id', userId)
    .gte('created_at', startIso)
    .lt('created_at', endExclusiveIso)
    .order('created_at', { ascending: false })
    .limit(MEI_LIMITE_AGG_QUERY_LIMIT);
  query = query.or(`document_type.eq.${DOCUMENT_TYPE_NFSE},document_type.is.null`);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  const { total, notasConsideradas } = agregarLimiteMeiDasLinhas(data || [], safeYear);
  return {
    anoCivil: safeYear,
    totalUtilizadoReais: total,
    notasConsideradas
  };
};

/**
 * Lista notas fiscais do usuário por userId (uso admin). Usa service role.
 * @param {string} userId - ID do usuário alvo
 * @param {{ limit?: number, documentType?: string, includeArchived?: boolean }} [options]
 * @returns {Promise<Array>}
 */
export const listNotasByUserId = async (userId, options = {}) => {
  const {
    limit = 100,
    documentType,
    includeArchived = true
  } = options;
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const dbClient = getDb();
  let query = dbClient
    .from(TABLE)
    .select('id, user_id, document_type, provider, status, plugnotas_id, id_integracao, protocol, pdf_url, xml_url, created_at, updated_at, archived_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (documentType) {
    query = query.eq('document_type', normalizeDocumentType(documentType));
  }
  if (!includeArchived) {
    query = query.is('archived_at', null);
  }
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return data || [];
};

export const listarRelatorioNfe = async (_userId, filters = {}) => {
  return await relatorioNfe(filters);
};

export const listarCatalogoClientes = async (
  userId,
  { q = '', limit = 20, documentType, includeInactive = false } = {}
) => {
  const safeLimit = toCatalogLimit(limit);
  const dbClient = getDb();
  // Busca um pouco a mais quando filtra soft-hide em memória (sem coluna no schema compartilhado).
  const fetchLimit = includeInactive ? safeLimit : Math.min(100, Math.max(safeLimit * 3, safeLimit));
  let query = dbClient
    .from(CLIENTS_TABLE)
    .select(CLIENT_CATALOG_SELECT)
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false })
    .limit(fetchLimit);

  if (documentType) {
    query = query.eq('document_type', normalizeDocumentType(documentType));
  }

  query = applyCatalogSearch(query, q, ['documento', 'nome', 'email']);

  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  const rows = (data || []).map(withDerivedCatalogActive);
  if (includeInactive) {
    return rows.slice(0, safeLimit);
  }
  return rows.filter((row) => row.active !== false).slice(0, safeLimit);
};

const normalizeCatalogProdutoCnae = (value) => String(value || '').replace(/\D/g, '').slice(0, 7);

/**
 * Evita duplicar serviço com o mesmo código + CNAE (emissão WhatsApp / app).
 * @returns {Promise<Record<string, unknown> | null>}
 */
export const findCatalogoProdutoByCodigoCnae = async (
  userId,
  codigo,
  cnae,
  documentType = DOCUMENT_TYPE_NFSE,
) => {
  const codigoNorm = normalizeNfseServicoCodigoForLength(String(codigo || '').trim());
  const cnaeNorm = normalizeCatalogProdutoCnae(cnae);
  if (!codigoNorm || cnaeNorm.length !== 7) return null;

  const rows = await listarCatalogoProdutos(userId, {
    limit: 100,
    documentType: normalizeDocumentType(documentType),
  });

  return rows.find((row) => (
    normalizeNfseServicoCodigoForLength(String(row?.codigo || '').trim()) === codigoNorm
    && normalizeCatalogProdutoCnae(row?.cnae) === cnaeNorm
  )) || null;
};

export const listarCatalogoProdutos = async (
  userId,
  { q = '', limit = 20, documentType } = {}
) => {
  const safeLimit = toCatalogLimit(limit);
  const dbClient = getDb();
  let query = dbClient
    .from(PRODUCTS_TABLE)
    .select('id, document_type, codigo, cnae, discriminacao, aliquota, valor_sugerido, metadata_json, last_used_at, created_at, updated_at')
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false })
    .limit(safeLimit);

  if (documentType) {
    query = query.eq('document_type', normalizeDocumentType(documentType));
  }

  query = applyCatalogSearch(query, q, ['codigo', 'cnae', 'discriminacao']);

  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return data || [];
};

/** Catálogo nacional de códigos de serviço (referência NFS-e); sem `user_id`. */
export const listarCodigosServicosReferencia = async ({ q = '', limit = 20 } = {}) => {
  const safeLimit = toCatalogLimit(limit);
  const dbClient = getDb();
  let query = dbClient
    .from(CODIGOS_SERVICOS_TABLE)
    .select('codigo, descricao')
    .order('codigo', { ascending: true })
    .limit(safeLimit);

  query = applyCatalogSearch(query, q, ['codigo', 'descricao']);

  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return enrichCodigosServicosComNbs(data || []);
};

const CODALOGO_SERVICO_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'a', 'o', 'as', 'os', 'em', 'na', 'no', 'nas', 'nos',
  'para', 'por', 'com', 'sem', 'ao', 'aos', 'um', 'uma', 'uns', 'umas', 'que', 'seu', 'sua',
  'seus', 'suas', 'atividade', 'atividades', 'servico', 'servicos', 'serviço', 'serviços',
  'outros', 'outras', 'nao', 'não', 'especificados', 'especificadas', 'inclusive',
]);

/**
 * Tokens ambíguos: aparecem em muitos códigos LC 116 sem distinguir o ramo
 * (ex.: "desenvolvimento" casa TI e treinamento gerencial).
 */
const CODALOGO_SERVICO_WEAK_TOKENS = new Set([
  'desenvolvimento', 'profissional', 'gerencial', 'natureza', 'qualquer',
  'geral', 'gerais', 'customizavel', 'customizaveis', 'inclusive',
  'pesquisas', 'pesquisa', 'especializado', 'especializados', 'especializada',
]);

const isStrongCodigoServicoToken = (token) => !CODALOGO_SERVICO_WEAK_TOKENS.has(token);

/**
 * Extrai tokens úteis da descrição do CNAE para buscar na LC 116.
 * Prioriza tokens fortes (não ambíguos) no início da lista.
 * @param {unknown} text
 * @param {{ max?: number }} [opts]
 * @returns {string[]}
 */
export const extractCodigosServicoSearchTokens = (text, { max = 4 } = {}) => {
  const raw = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const words = raw.split(/[^a-z0-9]+/).filter((w) => (
    w.length >= 4 && !CODALOGO_SERVICO_STOPWORDS.has(w)
  ));
  const unique = [];
  for (const w of words) {
    if (!unique.includes(w)) unique.push(w);
  }
  unique.sort((a, b) => {
    const sa = isStrongCodigoServicoToken(a) ? 1 : 0;
    const sb = isStrongCodigoServicoToken(b) ? 1 : 0;
    if (sb !== sa) return sb - sa;
    return b.length - a.length;
  });
  return unique.slice(0, max);
};

/**
 * Sugere códigos LC 116 / lista nacional a partir do texto do CNAE (não é mapa oficial).
 * Evita “falso positivo” por palavras genéricas (ex.: desenvolvimento → sistemas).
 * @param {{ texto?: string, limit?: number }} [opts]
 */
export const sugerirCodigosServicosPorTexto = async ({ texto = '', limit = 8 } = {}) => {
  const safeLimit = toCatalogLimit(limit, { defaultValue: 8, max: 20 });
  const tokens = extractCodigosServicoSearchTokens(texto);
  if (tokens.length === 0) {
    return listarCodigosServicosReferencia({ q: String(texto || '').trim().slice(0, 40), limit: safeLimit });
  }

  const strongTokens = tokens.filter(isStrongCodigoServicoToken);
  // Com token forte (ex.: treinamento), busca só por ele — não espalha por "desenvolvimento".
  const queryTokens = strongTokens.length > 0 ? strongTokens : tokens;

  const dbClient = getDb();
  const likeFilters = queryTokens.flatMap((token) => {
    const safe = sanitizeSearchTerm(token);
    if (!safe) return [];
    const like = `%${safe}%`;
    return [`descricao.ilike.${like}`, `codigo.ilike.${like}`];
  });
  if (likeFilters.length === 0) {
    return listarCodigosServicosReferencia({ q: '', limit: safeLimit });
  }

  const { data, error } = await dbClient
    .from(CODIGOS_SERVICOS_TABLE)
    .select('codigo, descricao')
    .or(likeFilters.join(','))
    .limit(80);
  if (error) throw badRequest(error.message);

  const scored = (data || []).map((row) => {
    const desc = normalizeText(row?.descricao)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const codigo = String(row?.codigo || '').toLowerCase();
    let score = 0;
    let strongHits = 0;
    for (const token of tokens) {
      if (!(desc.includes(token) || codigo.includes(token))) continue;
      if (isStrongCodigoServicoToken(token)) {
        score += 4;
        strongHits += 1;
      } else {
        score += 1;
      }
    }
    return { row, score, strongHits };
  });

  // Se o CNAE tem termos fortes, descarta matches só em palavra fraca.
  const ranked = (strongTokens.length > 0
    ? scored.filter((s) => s.strongHits > 0)
    : scored
  ).filter((s) => s.score > 0);

  ranked.sort((a, b) => {
    if (b.strongHits !== a.strongHits) return b.strongHits - a.strongHits;
    if (b.score !== a.score) return b.score - a.score;
    return String(a.row.codigo || '').localeCompare(String(b.row.codigo || ''), 'pt-BR');
  });

  const top = ranked.slice(0, safeLimit).map((s) => s.row);
  if (top.length > 0) return enrichCodigosServicosComNbs(top);
  return listarCodigosServicosReferencia({
    q: queryTokens[0] || tokens[0],
    limit: safeLimit,
  });
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ensureCatalogRecordId = (id) => {
  const raw = id != null ? String(id).trim() : '';
  if (!raw) throw badRequest('ID do registo do catálogo é obrigatório');
  if (!UUID_RE.test(raw)) throw badRequest('ID do registo do catálogo inválido');
  return raw;
};

const findCatalogCliente = async (userId, id) => {
  const dbClient = getDb();
  const { data, error } = await dbClient
    .from(CLIENTS_TABLE)
    .select('id, user_id, document_type, documento, nome, email, metadata_json, dedupe_key, last_used_at, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound('Cliente do catálogo não encontrado');
  return withDerivedCatalogActive(data);
};

const findCatalogProduto = async (userId, id) => {
  const dbClient = getDb();
  const { data, error } = await dbClient
    .from(PRODUCTS_TABLE)
    .select('id, user_id, document_type, codigo, cnae, discriminacao, aliquota, valor_sugerido, metadata_json, dedupe_key, last_used_at, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound('Item do catálogo não encontrado');
  return data;
};

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const assertEmailFormat = (email) => {
  if (!EMAIL_LIKE.test(email)) {
    throw badRequest('e-mail inválido');
  }
};

/**
 * POST catálogo cliente — upsert por dedupe_key (mesma lógica que emissão).
 * @param {string} userId
 * @param {{ documentType?: string, documento: string, nome: string, email?: string|null, metadata_json?: object|null }} body
 */
export const criarCatalogoCliente = async (userId, body = {}) => {
  const documentType = normalizeDocumentType(
    body.documentType || body.document_type || DOCUMENT_TYPE_NFSE
  );
  const nome = String(body.nome || '').trim();
  if (!nome) {
    throw badRequest('nome é obrigatório');
  }
  const documentoDigits = normalizeDoc(body.documento || '');
  if (!documentoDigits || (documentoDigits.length !== 11 && documentoDigits.length !== 14)) {
    throw badRequest('documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)');
  }
  const emailRaw = body.email;
  if (emailRaw !== undefined && emailRaw !== null && String(emailRaw).trim()) {
    assertEmailFormat(String(emailRaw).trim());
  }

  const party = {
    cpfCnpj: documentoDigits,
    razaoSocial: nome
  };
  if (emailRaw !== undefined && emailRaw !== null && String(emailRaw).trim()) {
    party.email = String(emailRaw).trim();
  }
  const catalogPayload =
    documentType === DOCUMENT_TYPE_NFSE
      ? { tomador: party }
      : { destinatario: party };
  const entry = buildClienteCatalogEntry(catalogPayload, { documentType });
  if (!entry) {
    throw badRequest('Não foi possível montar registo de cliente');
  }

  const now = new Date().toISOString();
  const row = {
    ...entry,
    user_id: userId,
    document_type: documentType,
    last_used_at: now,
    updated_at: now
  };

  const dbClient = getDb();
  const { data: existingRow } = await dbClient
    .from(CLIENTS_TABLE)
    .select('metadata_json')
    .eq('user_id', userId)
    .eq('document_type', documentType)
    .eq('dedupe_key', entry.dedupe_key)
    .maybeSingle();

  if (body.metadata_json !== undefined) {
    if (body.metadata_json === null) {
      row.metadata_json = null;
    } else {
      let meta = sanitizeMetadata(body.metadata_json);
      meta = await enrichCatalogClienteMetadataFromCep(meta);
      const merged = mergeClienteCatalogMetadata(existingRow?.metadata_json, meta);
      row.metadata_json = setCatalogActiveInMetadata(merged, true);
    }
  } else if (existingRow && !isCatalogClienteRowActive(existingRow)) {
    row.metadata_json = setCatalogActiveInMetadata(existingRow.metadata_json, true);
  }

  const { data, error } = await dbClient
    .from(CLIENTS_TABLE)
    .upsert(row, { onConflict: 'user_id,document_type,dedupe_key' })
    .select(CLIENT_CATALOG_SELECT)
    .single();
  if (error) throw badRequest(error.message);
  return withDerivedCatalogActive(data);
};

/**
 * Sincroniza tipos fiscais de um cliente (mesmo CPF/CNPJ).
 * Tipos em `documentTypes` ficam ativos; tipos existentes omitidos soft-hide via metadata_json.catalogActive=false.
 */
export const syncCatalogoClienteDocumentTypes = async (userId, body = {}) => {
  const rawTypes = Array.isArray(body.documentTypes)
    ? body.documentTypes
    : Array.isArray(body.document_types)
      ? body.document_types
      : [];
  const wanted = [...new Set(
    rawTypes
      .map((t) => normalizeDocumentType(t))
      .filter((t) =>
        t === DOCUMENT_TYPE_NFSE || t === DOCUMENT_TYPE_NFE || t === DOCUMENT_TYPE_NFCE
      ),
  )];
  if (wanted.length === 0) {
    throw badRequest('Selecione ao menos um tipo: NFSE, NFE ou NFCE.');
  }

  const nome = String(body.nome || '').trim();
  if (!nome) throw badRequest('nome é obrigatório');
  const documentoDigits = normalizeDoc(body.documento || '');
  if (!documentoDigits || (documentoDigits.length !== 11 && documentoDigits.length !== 14)) {
    throw badRequest('documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)');
  }

  const emailRaw = body.email;
  if (emailRaw !== undefined && emailRaw !== null && String(emailRaw).trim()) {
    assertEmailFormat(String(emailRaw).trim());
  }

  let metadataJson = undefined;
  if (body.metadata_json !== undefined) {
    if (body.metadata_json === null) {
      metadataJson = null;
    } else {
      let meta = sanitizeMetadata(body.metadata_json);
      meta = await enrichCatalogClienteMetadataFromCep(meta);
      metadataJson = Object.keys(meta).length ? meta : null;
    }
  }

  const dbClient = getDb();
  const { data: existing, error: listErr } = await dbClient
    .from(CLIENTS_TABLE)
    .select(CLIENT_CATALOG_SELECT)
    .eq('user_id', userId)
    .eq('documento', documentoDigits);
  if (listErr) throw badRequest(listErr.message);

  const synced = [];
  for (const documentType of wanted) {
    const created = await criarCatalogoCliente(userId, {
      documento: documentoDigits,
      nome,
      email: emailRaw,
      documentType,
      ...(metadataJson !== undefined ? { metadata_json: metadataJson } : {}),
    });
    synced.push(created);
  }

  const toDisable = (existing || []).filter((row) => {
    const dt = normalizeDocumentType(row.document_type);
    return isCatalogClienteRowActive(row) && !wanted.includes(dt);
  });
  for (const row of toDisable) {
    const { error: updErr } = await dbClient
      .from(CLIENTS_TABLE)
      .update({
        metadata_json: setCatalogActiveInMetadata(row.metadata_json, false),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('user_id', userId);
    if (updErr) throw badRequest(updErr.message);
  }

  const { data: allRows, error: reloadErr } = await dbClient
    .from(CLIENTS_TABLE)
    .select(CLIENT_CATALOG_SELECT)
    .eq('user_id', userId)
    .eq('documento', documentoDigits)
    .order('document_type', { ascending: true });
  if (reloadErr) throw badRequest(reloadErr.message);

  const rows = (allRows || []).map(withDerivedCatalogActive);
  return {
    documento: documentoDigits,
    nome,
    rows,
    activeTypes: wanted,
    synced,
  };
};

/**
 * PATCH catálogo cliente — nome, email, metadata_json; body.active mapeia para metadata_json.catalogActive.
 */
export const atualizarCatalogoCliente = async (userId, id, body = {}) => {
  const recordId = ensureCatalogRecordId(id);
  if (body.documento !== undefined || body.document_type !== undefined || body.documentType !== undefined) {
    throw badRequest(
      'Não é permitido alterar documento ou tipo de documento via PATCH; use POST /catalogo/clientes/sync para tipos.'
    );
  }
  if (body.dedupe_key !== undefined) {
    throw badRequest('Não é permitido alterar dedupe_key');
  }

  const existing = await findCatalogCliente(userId, recordId);

  const updates = {};
  if (body.nome !== undefined) {
    const nome = String(body.nome || '').trim();
    if (!nome) throw badRequest('nome não pode ser vazio');
    updates.nome = nome;
  }
  if (body.email !== undefined) {
    if (body.email === null || body.email === '') {
      updates.email = null;
    } else {
      const e = String(body.email).trim();
      assertEmailFormat(e);
      updates.email = normalizeEmail(e);
    }
  }

  let nextMeta = existing.metadata_json;
  let metaTouched = false;
  if (body.metadata_json !== undefined) {
    metaTouched = true;
    if (body.metadata_json === null) {
      nextMeta = null;
    } else {
      let meta = sanitizeMetadata(body.metadata_json);
      meta = await enrichCatalogClienteMetadataFromCep(meta);
      nextMeta = Object.keys(meta).length ? meta : null;
    }
  }
  if (body.active !== undefined) {
    metaTouched = true;
    nextMeta = setCatalogActiveInMetadata(nextMeta, Boolean(body.active));
  }
  if (metaTouched) {
    updates.metadata_json = nextMeta;
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest('Informe ao menos um campo editável para atualizar (nome, email, metadata_json ou active)');
  }

  const now = new Date().toISOString();
  updates.updated_at = now;
  updates.last_used_at = now;

  const dbClient = getDb();
  const { data, error } = await dbClient
    .from(CLIENTS_TABLE)
    .update(updates)
    .eq('id', recordId)
    .eq('user_id', userId)
    .select(CLIENT_CATALOG_SELECT)
    .single();
  if (error) throw badRequest(error.message);
  return withDerivedCatalogActive(data);
};

/**
 * Soft-hide de todos os tipos fiscais do mesmo CPF/CNPJ (some da listagem ativa).
 * Usa metadata_json.catalogActive=false — sem migration de schema.
 */
export const softHideCatalogoClientePorDocumento = async (userId, documento) => {
  const digits = normalizeDoc(documento || '');
  if (!digits || (digits.length !== 11 && digits.length !== 14)) {
    throw badRequest('documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)');
  }
  const now = new Date().toISOString();
  const dbClient = getDb();
  const { data: rows, error: listErr } = await dbClient
    .from(CLIENTS_TABLE)
    .select(CLIENT_CATALOG_SELECT)
    .eq('user_id', userId)
    .eq('documento', digits);
  if (listErr) throw badRequest(listErr.message);

  const deactivated = [];
  for (const row of rows || []) {
    if (!isCatalogClienteRowActive(row)) continue;
    const { data, error } = await dbClient
      .from(CLIENTS_TABLE)
      .update({
        metadata_json: setCatalogActiveInMetadata(row.metadata_json, false),
        updated_at: now,
      })
      .eq('id', row.id)
      .eq('user_id', userId)
      .select(CLIENT_CATALOG_SELECT)
      .single();
    if (error) throw badRequest(error.message);
    deactivated.push(withDerivedCatalogActive(data));
  }
  return { documento: digits, deactivated };
};

/**
 * Encontra serviço no catálogo pelo CNAE (7 dígitos), independente do código LC 116.
 */
export const findCatalogoProdutoByCnae = async (
  userId,
  cnae,
  documentType = DOCUMENT_TYPE_NFSE,
) => {
  const cnaeNorm = normalizeCatalogProdutoCnae(cnae);
  if (cnaeNorm.length !== 7) return null;
  const rows = await listarCatalogoProdutos(userId, {
    limit: 100,
    documentType: normalizeDocumentType(documentType),
  });
  return rows.find((row) => normalizeCatalogProdutoCnae(row?.cnae) === cnaeNorm) || null;
};

/**
 * Cria rascunhos de serviço NFSe a partir de CNAEs da Receita (após import de certificado).
 * `codigoServico` (LC 116) é opcional — se omitido, fica para completar depois.
 * Não cria duplicata do mesmo CNAE.
 */
export const criarCatalogoProdutosFromCnaes = async (userId, body = {}) => {
  const documentType = normalizeDocumentType(
    body.documentType || body.document_type || DOCUMENT_TYPE_NFSE,
  );
  const rawItems = Array.isArray(body.items) ? body.items : Array.isArray(body.cnaes) ? body.cnaes : [];
  if (rawItems.length === 0) {
    throw badRequest('Informe ao menos um CNAE em items.');
  }

  const created = [];
  const skipped = [];

  for (const item of rawItems) {
    const cnae = normalizeCatalogProdutoCnae(item?.codigo || item?.cnae || item?.codigoCnae);
    if (cnae.length !== 7) {
      skipped.push({ codigo: String(item?.codigo || item?.cnae || ''), reason: 'cnae_invalido' });
      continue;
    }
    const descricao = String(item?.descricao || item?.discriminacao || '').trim()
      || `Serviço CNAE ${cnae}`;
    const codigoServico = String(
      item?.codigoServico ?? item?.servicoCodigo ?? item?.codigo_servico ?? '',
    ).trim();
    const existing = await findCatalogoProdutoByCnae(userId, cnae, documentType);
    if (existing) {
      skipped.push({
        codigo: cnae,
        reason: 'ja_existe',
        existingId: existing.id,
        discriminacao: existing.discriminacao,
      });
      continue;
    }
    const row = await criarCatalogoProduto(userId, {
      documentType,
      codigo: codigoServico,
      cnae,
      discriminacao: descricao.slice(0, 500),
      aliquota: 0,
      metadata_json: {
        cnaeDraft: true,
        needsServicoCodigo: !codigoServico,
        cnaeDescricao: descricao.slice(0, 500),
        ...(item?.principal === true ? { cnaePrincipal: true } : {}),
      },
    });
    created.push(row);
  }

  return { created, skipped, documentType };
};

/**
 * POST catálogo produto/serviço — dedupe_key gerado como manual:{uuid}.
 */
export const criarCatalogoProduto = async (userId, body = {}) => {
  const documentType = normalizeDocumentType(
    body.documentType || body.document_type || DOCUMENT_TYPE_NFSE
  );
  const discriminacao = String(body.discriminacao || '').trim();
  if (!discriminacao) {
    throw badRequest('discriminacao é obrigatória');
  }
  const codigo = String(body.codigo ?? '').trim();
  const cnae = String(body.cnae ?? '').trim();
  const existing = await findCatalogoProdutoByCodigoCnae(userId, codigo, cnae, documentType);
  if (existing) {
    throw badRequest(
      `Já existe serviço com código ${existing.codigo} e CNAE ${existing.cnae}. Edite o cadastro existente ou use-o na emissão.`,
      {
        code: 'CATALOGO_PRODUTO_DUPLICATE',
        existingId: existing.id,
        existingDiscriminacao: existing.discriminacao,
      },
    );
  }
  const aliquota = toNumber(body.aliquota);
  const valor_sugerido = toNumber(body.valor_sugerido);
  const dedupe_key = `manual:${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const row = {
    user_id: userId,
    document_type: documentType,
    dedupe_key,
    codigo,
    cnae,
    discriminacao,
    aliquota,
    valor_sugerido,
    last_used_at: now,
    updated_at: now
  };
  if (body.metadata_json !== undefined) {
    if (body.metadata_json === null) {
      row.metadata_json = null;
    } else {
      const meta = sanitizeMetadata(body.metadata_json);
      row.metadata_json = Object.keys(meta).length ? meta : null;
    }
  }

  const dbClient = getDb();
  const { data, error } = await dbClient
    .from(PRODUCTS_TABLE)
    .insert(row)
    .select(
      'id, document_type, codigo, cnae, discriminacao, aliquota, valor_sugerido, metadata_json, dedupe_key, last_used_at, created_at, updated_at'
    )
    .single();
  if (error) throw badRequest(error.message);
  return data;
};

/**
 * PATCH catálogo produto — não altera dedupe_key nem document_type.
 */
export const atualizarCatalogoProduto = async (userId, id, body = {}) => {
  const recordId = ensureCatalogRecordId(id);
  if (body.dedupe_key !== undefined || body.document_type !== undefined || body.documentType !== undefined) {
    throw badRequest('Não é permitido alterar dedupe_key ou document_type');
  }

  await findCatalogProduto(userId, recordId);

  const updates = {};
  if (body.codigo !== undefined) {
    updates.codigo = String(body.codigo ?? '').trim();
  }
  if (body.cnae !== undefined) {
    updates.cnae = String(body.cnae ?? '').trim();
  }
  if (body.discriminacao !== undefined) {
    const d = String(body.discriminacao || '').trim();
    if (!d) throw badRequest('discriminacao não pode ser vazia');
    updates.discriminacao = d;
  }
  if (body.aliquota !== undefined) {
    updates.aliquota = toNumber(body.aliquota);
  }
  if (body.valor_sugerido !== undefined) {
    updates.valor_sugerido = toNumber(body.valor_sugerido);
  }
  if (body.metadata_json !== undefined) {
    if (body.metadata_json === null) {
      updates.metadata_json = null;
    } else {
      const meta = sanitizeMetadata(body.metadata_json);
      updates.metadata_json = Object.keys(meta).length ? meta : null;
    }
  }
  if (Object.keys(updates).length === 0) {
    throw badRequest('Informe ao menos um campo para atualizar');
  }

  const now = new Date().toISOString();
  updates.updated_at = now;
  updates.last_used_at = now;

  const dbClient = getDb();
  const { data, error } = await dbClient
    .from(PRODUCTS_TABLE)
    .update(updates)
    .eq('id', recordId)
    .eq('user_id', userId)
    .select(
      'id, document_type, codigo, cnae, discriminacao, aliquota, valor_sugerido, metadata_json, dedupe_key, last_used_at, created_at, updated_at'
    )
    .single();
  if (error) throw badRequest(error.message);
  return data;
};

/**
 * DELETE catálogo cliente — 204 sempre que o estado final for “ausente para este utilizador”;
 * 404 apenas se existir linha com o id mas pertencente a outro utilizador.
 * Segundo DELETE (idempotente): 204.
 */
export const eliminarCatalogoCliente = async (userId, id) => {
  const recordId = ensureCatalogRecordId(id);
  const dbClient = getDb();
  const { data: removed, error } = await dbClient
    .from(CLIENTS_TABLE)
    .delete()
    .eq('id', recordId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw badRequest(error.message);
  if (removed && removed.length > 0) return;

  const { data: anyRow, error: errLookup } = await dbClient
    .from(CLIENTS_TABLE)
    .select('id, user_id')
    .eq('id', recordId)
    .maybeSingle();
  if (errLookup) throw badRequest(errLookup.message);
  if (anyRow && anyRow.user_id !== userId) {
    throw notFound('Cliente do catálogo não encontrado');
  }
};

/**
 * DELETE catálogo produto — mesma semântica que {@link eliminarCatalogoCliente}.
 */
export const eliminarCatalogoProduto = async (userId, id) => {
  const recordId = ensureCatalogRecordId(id);
  const dbClient = getDb();
  const { data: removed, error } = await dbClient
    .from(PRODUCTS_TABLE)
    .delete()
    .eq('id', recordId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw badRequest(error.message);
  if (removed && removed.length > 0) return;

  const { data: anyRow, error: errLookup } = await dbClient
    .from(PRODUCTS_TABLE)
    .select('id, user_id')
    .eq('id', recordId)
    .maybeSingle();
  if (errLookup) throw badRequest(errLookup.message);
  if (anyRow && anyRow.user_id !== userId) {
    throw notFound('Item do catálogo não encontrado');
  }
};

export const obterNota = async (userId, id, { sync = false, skipWhatsappDelivery = false } = {}) => {
  const record = await findRecord(userId, id);
  if (!sync) return record;

  const response = await refreshWithPlugNotas(record);
  if (!response) return record;

  const plugnotasId = extractPlugNotasId(response) || record.plugnotas_id;
  const idIntegracao = extractIntegracaoId(response) || record.id_integracao;
  const providerStatus = extractPlugNotasStatus(response);
  const status = resolveStatusAfterPlugnotasSync(record, providerStatus);
  const protocol = extractProtocol(response) || record.protocol;

  const updated = await updateRecord(userId, record.id, {
    plugnotas_id: plugnotasId,
    id_integracao: idIntegracao,
    protocol,
    status,
    response_json: response
  });

  const archivedOrUpdated = await healNfseRpsAfterE0014RecordIfNeeded(
    userId,
    updated,
    response,
    status,
  );

  if (
    archivedOrUpdated.document_type === DOCUMENT_TYPE_NFSE
    && normalizeStatus(status) === 'rejeitado'
    && archivedOrUpdated.id === updated.id
  ) {
    const cnpjPrestador = normalizeDoc(updated.cnpj_prestador)
      || normalizeDoc(updated.payload_json?.prestador?.cpfCnpj);
    const usedRps = resolveUsedNfseRpsFromEmit(updated.payload_json, response);
    if (isNfseE0014FromPlugnotasResponse(response) && usedRps) {
      await syncNfseRpsAfterE0014(cnpjPrestador, updated.payload_json, response);
    } else {
      maybeAdvanceNfseRpsAfterPlugnotas(
        cnpjPrestador,
        updated.payload_json,
        response,
      );
    }
  }

  if (!skipWhatsappDelivery) {
    void import('./nfse-whatsapp-delivery.service.js')
      .then(({ tryDeliverPendingOpenclawNfseIfReady }) =>
        tryDeliverPendingOpenclawNfseIfReady(userId, archivedOrUpdated))
      .catch((err) => {
        console.warn('[mei-notas] entrega WhatsApp pós-sync falhou', {
          notaId: updated.id,
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }

  return archivedOrUpdated;
};

export const atualizarNota = async (userId, id, input) => {
  ensureRecordId(id);
  const updateInput = parseUpdateInput(input);
  const record = await findRecord(userId, id);
  if (record?.archived_at) {
    throw badRequest('Nota fiscal arquivada não permite edição');
  }

  const status = normalizeStatus(record?.status);
  if (!EDITABLE_STATUSES.has(status)) {
    throw badRequest('Nota fiscal no status atual não permite edição');
  }
  const metadata = prune({
    ...toObject(record?.metadata_json),
    ...updateInput.metadata,
    ...(updateInput.descricaoInterna !== undefined ? { descricaoInterna: updateInput.descricaoInterna } : {}),
    ...(updateInput.tags !== undefined ? { tags: updateInput.tags } : {}),
    updatedAt: new Date().toISOString()
  }) || {};

  const metadataWithAudit = appendAuditEvent({ metadata_json: metadata }, {
    type: 'update',
    at: new Date().toISOString()
  });

  return await updateRecord(userId, id, {
    metadata_json: metadataWithAudit
  });
};

export const cancelarNota = async (userId, id, input) => {
  ensureRecordId(id);
  const record = await findRecord(userId, id);
  const documentType = normalizeDocumentType(record?.document_type || DOCUMENT_TYPE_NFSE);
  const adapter = getAdapterByDocumentType(documentType);
  const statusAtual = normalizeStatus(record?.status);
  if (statusAtual === 'cancelado') {
    return record;
  }

  const reason =
    sanitizeReason(input?.reason)
    || 'Cancelamento solicitado pelo contribuinte via Meu Financeiro';

  let providerResponse = null;
  let providerError = null;
  let nextStatus = 'cancelamento_pendente';
  const providerId = await resolvePlugnotasProviderIdForRecord(record, adapter);

  if (providerId) {
    try {
      providerResponse = await adapter.cancelar(providerId, { reason });
      const statusCancelamento = extractPlugNotasStatus(providerResponse);
      if (statusCancelamento === 'cancelado' || statusCancelamento === 'cancelamento_pendente') {
        nextStatus = statusCancelamento;
      } else {
        nextStatus = 'cancelamento_pendente';
      }
    } catch (error) {
      providerError = error;
      nextStatus = 'cancelamento_pendente';
    }
  } else {
    providerError = new Error(
      'Não foi possível identificar esta nota no emissor (falta ID Plugnotas ou integração com CNPJ do prestador).',
    );
    nextStatus = 'cancelamento_pendente';
  }

  const metadata = prune({
    ...toObject(record?.metadata_json),
    cancelamento: prune({
      requestedAt: new Date().toISOString(),
      reason,
      mode: providerId ? 'provider' : 'local',
      ...(providerError ? { providerError: String(providerError?.message || providerError) } : {})
    })
  }) || {};
  const metadataWithAudit = appendAuditEvent({ metadata_json: metadata }, {
    type: 'cancel',
    at: new Date().toISOString(),
    ...(reason ? { reason } : {})
  });

  const updates = {
    status: nextStatus,
    metadata_json: metadataWithAudit
  };

  if (providerResponse) {
    updates.response_json = mergeResponsePayload(record, { cancelamento: providerResponse });
  } else if (providerError) {
    updates.response_json = mergeResponsePayload(record, {
      cancelamento: {
        status: 'erro',
        message: String(providerError?.message || providerError)
      }
    });
  }

  return await updateRecord(userId, id, updates);
};

export const arquivarNota = async (userId, id, input = {}) => {
  ensureRecordId(id);
  const record = await findRecord(userId, id);
  const archived = parseArchivedInput(input?.archived);
  const reason = sanitizeReason(input?.reason);

  if (Boolean(record?.archived_at) === archived) {
    return record;
  }

  const archivedAt = archived ? new Date().toISOString() : null;
  const metadata = prune({
    ...toObject(record?.metadata_json),
    arquivamento: prune({
      updatedAt: new Date().toISOString(),
      archived,
      reason
    })
  }) || {};
  const metadataWithAudit = appendAuditEvent({ metadata_json: metadata }, {
    type: archived ? 'archive' : 'unarchive',
    at: new Date().toISOString(),
    ...(reason ? { reason } : {})
  });

  return await updateRecord(userId, id, {
    archived_at: archivedAt,
    metadata_json: metadataWithAudit
  });
};

export const baixarPdf = async (userId, id) => {
  const record = await findRecord(userId, id);
  const documentType = normalizeDocumentType(record?.document_type || DOCUMENT_TYPE_NFSE);
  const adapter = getAdapterByDocumentType(documentType);
  if (record?.plugnotas_id) {
    const file = await adapter.downloadPdf(record.plugnotas_id);
    return { ...file, documentType };
  }
  if (record?.id_integracao && record?.cnpj_prestador && adapter.downloadPdfPorIntegracao) {
    const file = await adapter.downloadPdfPorIntegracao(record.id_integracao, record.cnpj_prestador);
    return { ...file, documentType };
  }
  throw notFound('PDF da nota fiscal não disponível');
};

export const baixarXml = async (userId, id) => {
  const record = await findRecord(userId, id);
  const documentType = normalizeDocumentType(record?.document_type || DOCUMENT_TYPE_NFSE);
  const adapter = getAdapterByDocumentType(documentType);
  if (record?.plugnotas_id) {
    const file = await adapter.downloadXml(record.plugnotas_id);
    return { ...file, documentType };
  }
  if (record?.id_integracao && record?.cnpj_prestador && adapter.downloadXmlPorIntegracao) {
    const file = await adapter.downloadXmlPorIntegracao(record.id_integracao, record.cnpj_prestador);
    return { ...file, documentType };
  }
  throw notFound('XML da nota fiscal não disponível');
};

export const processarWebhook = async (payload) => {
  const plugnotasId = payload?.id
    || payload?.documento?.id
    || payload?.documents?.[0]?.id
    || payload?.documentos?.[0]?.id
    || null;
  const idIntegracao = payload?.idIntegracao
    || payload?.documento?.idIntegracao
    || payload?.documents?.[0]?.idIntegracao
    || payload?.documentos?.[0]?.idIntegracao
    || null;
  const documentType = normalizeWebhookDocumentType(
    payload?.documento
      || payload?.document
      || payload?.tipoDocumento
      || payload?.documentoTipo
      || payload?.documents?.[0]?.documento
      || payload?.documentos?.[0]?.documento
  );
  const status = extractPlugNotasStatus(payload);
  const protocol = extractProtocol(payload);

  if (!plugnotasId && !idIntegracao) {
    throw badRequest('Webhook sem identificadores da nota fiscal');
  }

  const dbClient = getDb();
  const updates = {
    status,
    response_json: payload,
    updated_at: new Date().toISOString()
  };
  if (protocol) {
    updates.protocol = protocol;
  }
  if (plugnotasId) {
    updates.plugnotas_id = plugnotasId;
  }
  if (idIntegracao) {
    updates.id_integracao = idIntegracao;
  }
  if (documentType) {
    updates.document_type = documentType;
  }

  // FR-01: Processamento determinístico — no máximo um registro atualizado por evento.
  // Em caso de duplicidade de identificador, falha explícita e auditável.
  const resolveSingleRecordByField = async (field, value) => {
    if (!value) return null;
    let query = dbClient
      .from(TABLE)
      .select('id')
      .eq(field, value)
      .limit(2);
    if (documentType) {
      query = query.eq('document_type', documentType);
    }
    const { data, error } = await query;
    if (error) throw badRequest(error.message);
    if (!data?.length) return null;
    if (data.length > 1) {
      throw badRequest(`Identificador duplicado para ${field}`);
    }
    return data[0];
  };

  const updateById = async (recordId) => {
    if (!recordId) return null;
    const { data, error } = await dbClient
      .from(TABLE)
      .update(updates)
      .eq('id', recordId)
      .select()
      .single();
    if (error) throw badRequest(error.message);
    return data || null;
  };

  let data = null;
  if (plugnotasId) {
    const record = await resolveSingleRecordByField('plugnotas_id', plugnotasId);
    data = await updateById(record?.id);
  }
  if (!data && idIntegracao) {
    const record = await resolveSingleRecordByField('id_integracao', idIntegracao);
    data = await updateById(record?.id);
  }

  // Compatibilidade com webhooks legados sem campo "documento"
  if (!data && !documentType && plugnotasId) {
    const record = await resolveSingleRecordByField('plugnotas_id', plugnotasId);
    data = await updateById(record?.id);
  }
  if (!data && !documentType && idIntegracao) {
    const record = await resolveSingleRecordByField('id_integracao', idIntegracao);
    data = await updateById(record?.id);
  }

  if (!data) {
    throw notFound('Nota fiscal referente ao webhook não encontrada');
  }

  if (
    normalizeDocumentType(data.document_type || DOCUMENT_TYPE_NFSE) === DOCUMENT_TYPE_NFSE
    && (isNfseDuplicateRpsRejectedEmit(payload, status) || isNfseE0014FromPlugnotasResponse(payload))
    && data.user_id
  ) {
    return await healNfseRpsAfterE0014RecordIfNeeded(data.user_id, data, payload, status);
  }

  return data;
};
