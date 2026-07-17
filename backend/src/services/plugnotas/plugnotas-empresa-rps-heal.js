import { unwrapPlugnotasEmpresaRecord } from '../mei-emitente-empresa-sync.js';
import {
  atualizarEmpresaPlugNotas,
  consultarEmpresaPlugNotas,
  resolverCertificadoIdPorCnpj,
} from './empresa.service.js';
import { consultarNfsePorPeriodo } from './nfse.service.js';
import {
  cloneEmpresaPlugnotasRpsInicialPost,
  EMPRESA_PLUGNOTAS_NFSE_CONFIG_RPS_CANONICAL,
  hasClientRpsShape,
  hasNfseConfigRpsShape
} from './plugnotas-empresa-rps-inicial.js';

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const parsePositiveInt = (value, fallback = NaN) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(n) && n >= 1) return n;
  return fallback;
};

/**
 * Extrai série/número/lote de um payload de emissão NFS-e (corpo enviado ao PlugNotas).
 * @param {unknown} payload
 * @returns {{ serie: string, numero: number, lote: number }|null}
 */
export function readRpsFromNfseEmitPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const rps = payload.rps;
  if (!rps || typeof rps !== 'object' || Array.isArray(rps)) return null;

  const numeracao = Array.isArray(rps.numeracao) ? rps.numeracao[0] : null;
  const serie = String(numeracao?.serie ?? rps.serie ?? '1').trim() || '1';
  const numero = parsePositiveInt(numeracao?.numero ?? rps.numero);
  const lote = parsePositiveInt(rps.lote, 1);
  if (!Number.isFinite(numero)) return null;
  return { serie, numero, lote };
}

const collectPlugnotasNfseBodies = (response) => {
  if (Array.isArray(response)) return response.filter((item) => item && typeof item === 'object');
  if (!response || typeof response !== 'object') return [];
  const list = [response];
  if (Array.isArray(response.documents)) list.push(...response.documents);
  if (Array.isArray(response.documentos)) list.push(...response.documentos);
  if (response.data !== undefined && response.data !== null) {
    if (Array.isArray(response.data)) list.push(...response.data);
    else if (typeof response.data === 'object') list.push(response.data);
  }
  if (response.nfse && typeof response.nfse === 'object') list.push(response.nfse);
  if (response.documento && typeof response.documento === 'object') list.push(response.documento);
  return list;
};

const parseDpsIdNumero = (dpsId) => {
  const id = String(dpsId || '').trim();
  if (!id) return NaN;
  const match = id.match(/(\d{1,15})$/);
  if (!match) return NaN;
  return parsePositiveInt(match[1]);
};

/**
 * Lê o maior número RPS/DPS numa resposta PlugNotas (array ou objeto, `rps` flat ou `dps`).
 * @param {unknown} body
 * @returns {number|null}
 */
export function readRpsNumeroFromNfsePlugnotasBody(body) {
  const candidates = collectPlugnotasNfseBodies(body);
  if (!candidates.length && body && typeof body === 'object') candidates.push(body);

  let max = 0;
  for (const candidate of candidates) {
    const fromRps = readRpsFromNfseEmitPayload(candidate)?.numero;
    const fromDps = parsePositiveInt(candidate?.dps?.numero);
    const fromDpsId = parseDpsIdNumero(candidate?.dps?.id);
    for (const n of [fromRps, fromDps, fromDpsId]) {
      if (Number.isFinite(n) && n >= 1 && n > max) max = n;
    }
  }
  return max > 0 ? max : null;
}

export const isNfseE0014DuplicateRpsMessage = (text) => {
  const lower = String(text || '').toLowerCase();
  return /e0014/.test(lower)
    || lower.includes('dps já existe')
    || lower.includes('dps ja existe')
    || lower.includes('numeração repetida')
    || lower.includes('numeracao repetida')
    || (lower.includes('conjunto de série') && lower.includes('já existe'))
    || (lower.includes('conjunto de serie') && lower.includes('ja existe'))
    || (
      (lower.includes('série') || lower.includes('serie'))
      && (lower.includes('número') || lower.includes('numero'))
      && (
        lower.includes('já foi usada')
        || lower.includes('ja foi usada')
        || lower.includes('já utiliz')
        || lower.includes('ja utiliz')
      )
    );
};

/**
 * Mensagem de rejeição da prefeitura em resposta PlugNotas (array ou objeto).
 * @param {unknown} response
 * @returns {string}
 */
export function extractNfseRejectionMessage(response) {
  const candidates = collectPlugnotasNfseBodies(response);
  for (const candidate of candidates) {
    const retorno = candidate?.retorno;
    const messages = [
      retorno?.mensagemRetorno,
      retorno?.mensagem,
      candidate?.mensagem,
      candidate?.message,
      candidate?.motivo,
      candidate?.descricao,
    ];
    if (Array.isArray(candidate?.erros)) {
      for (const err of candidate.erros) {
        messages.push(err?.mensagem, err?.message, err?.descricao);
      }
    }
    for (const msg of messages) {
      if (msg) return String(msg);
    }
  }
  return '';
}

/** @param {unknown} response */
export function isNfseE0014FromPlugnotasResponse(response) {
  if (isNfseE0014DuplicateRpsMessage(extractNfseRejectionMessage(response))) return true;
  return isNfseRpsDuplicateRejectionLoose(response);
}

/**
 * Detecção ampla de E0014 / numeração repetida (resposta parcial, array, webhook).
 * @param {unknown} response
 */
export function isNfseRpsDuplicateRejectionLoose(response) {
  try {
    const text = JSON.stringify(response).toLowerCase();
    return /e0014/.test(text)
      || text.includes('numeracao repetida')
      || text.includes('numeração repetida')
      || (text.includes('conjunto de serie') && text.includes('ja existe'))
      || (text.includes('conjunto de série') && text.includes('já existe'));
  } catch {
    return false;
  }
}

/**
 * Erro ao PATCH do contador RPS na empresa (antes da emissão) quando o nº já foi consumido.
 * @param {unknown} error
 */
export function isPlugnotasNfseRpsNumeroJaUtilizadoError(error) {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  if (!message) return false;
  const mentionsRps = message.includes('rps') || message.includes('numeracao') || message.includes('numeração');
  if (!mentionsRps) return false;
  return message.includes('já utiliz')
    || message.includes('ja utiliz')
    || message.includes('já utilizada')
    || message.includes('ja utilizada')
    || message.includes('em uso')
    || message.includes('duplic');
}

/**
 * @param {unknown} response
 * @param {string} [normalizedStatus]
 */
export function isNfseRejectedPlugnotasResponse(response, normalizedStatus = '') {
  if (normalizeRejectedStatusToken(normalizedStatus)) return true;
  const bodies = collectPlugnotasNfseBodies(response);
  for (const body of bodies) {
    if (normalizeRejectedStatusToken(body?.status)) return true;
    if (normalizeRejectedStatusToken(body?.retorno?.situacao)) return true;
    if (normalizeRejectedStatusToken(body?.situacao)) return true;
  }
  return false;
}

const normalizeRejectedStatusToken = (value) => {
  const ascii = String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  return ascii.includes('REJEIT');
};

const PLUGNOTAS_NFSE_PERIODO_MAX_PAGES = 40;
const PLUGNOTAS_NFSE_PERIODO_FAST_PAGES = 5;

/**
 * Maior número RPS/DPS já enviado ao PlugNotas para o CNPJ (todas as situações).
 * Fonte autoritativa quando o contador da empresa está desatualizado.
 * @param {string} cnpjInput
 * @param {{ maxPages?: number }} [opts]
 * @returns {Promise<number|null>}
 */
export async function queryMaxRpsNumeroFromPlugnotasPeriodo(cnpjInput, opts = {}) {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return null;

  const maxPages = Number.isFinite(opts.maxPages)
    ? Math.max(1, Math.trunc(opts.maxPages))
    : PLUGNOTAS_NFSE_PERIODO_MAX_PAGES;

  let hashProximaPagina;
  let maxKnown = 0;
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 365);
  const dataInicial = start.toISOString().slice(0, 10);
  const dataFinal = end.toISOString().slice(0, 10);

  for (let page = 0; page < maxPages; page += 1) {
    let body;
    try {
      body = await consultarNfsePorPeriodo({
        cpfCnpj: cnpj,
        dataInicial,
        dataFinal,
        ...(hashProximaPagina ? { hashProximaPagina } : {})
      });
    } catch (error) {
      console.warn(
        '[plugnotas-rps] falha ao consultar histórico NFS-e por período',
        error instanceof Error ? error.message : error
      );
      break;
    }

    const notas = collectPeriodoNotas(body);
    for (const nota of notas) {
      const numero = readRpsNumeroFromNfsePlugnotasBody(nota)
        ?? parsePositiveInt(nota?.numero)
        ?? parseDpsIdNumero(nota?.dps?.id)
        ?? parseDpsIdNumero(nota?.id);
      if (numero > maxKnown) maxKnown = numero;
    }

    const nextHash = body?.hashProximaPagina;
    if (!nextHash || typeof nextHash !== 'string') break;
    hashProximaPagina = nextHash;
  }

  return maxKnown > 0 ? maxKnown : null;
}

/**
 * Maior número RPS já usado numa linha do histórico (payload de emissão ou resposta PlugNotas).
 * @param {{ payload_json?: unknown, response_json?: unknown }|null|undefined} row
 * @returns {number|null}
 */
export function readRpsNumeroFromNfseHistoryRow(row) {
  if (!row || typeof row !== 'object') return null;
  const fromPayload = readRpsNumeroFromNfsePlugnotasBody(row.payload_json);
  const fromResponse = readRpsNumeroFromNfsePlugnotasBody(row.response_json);
  const max = Math.max(fromPayload ?? 0, fromResponse ?? 0);
  return max > 0 ? max : null;
}

/**
 * Próximo número RPS seguro para emissões consecutivas (PlugNotas pode atrasar o contador).
 * @param {number} plugnotasNumero
 * @param {number|null|undefined} localMaxNumero
 * @returns {number}
 */
export function resolveNextNfseRpsNumero(plugnotasNumero, localMaxNumero) {
  const localMax = parsePositiveInt(localMaxNumero, 0);
  if (localMax >= 1) return localMax + 1;
  const plug = parsePositiveInt(plugnotasNumero, 1);
  return plug >= 1 ? plug : 1;
}

/**
 * Próximo número após E0014 — sempre avança em relação ao número que falhou.
 * Não usar {@link resolveNextNfseRpsNumero} com o número rejeitado como 1º arg (fica no mesmo: 34+33→34).
 * @param {number|null|undefined} failedNumero
 * @param {number|null|undefined} localMaxNumero
 * @param {number|null|undefined} periodoMaxNumero
 * @returns {number}
 */
export function resolveNextNfseRpsAfterFailure(failedNumero, localMaxNumero, periodoMaxNumero) {
  const failed = parsePositiveInt(failedNumero, 0);
  const fromFailed = failed >= 1 ? failed + 1 : 1;
  const localMax = parsePositiveInt(localMaxNumero, 0);
  const fromLocal = localMax >= 1 ? localMax + 1 : 1;
  const periodoMax = parsePositiveInt(periodoMaxNumero, 0);
  const fromPeriodo = periodoMax >= 1 ? periodoMax + 1 : 1;
  return Math.max(fromFailed, fromLocal, fromPeriodo);
}

/**
 * Próximo número antes da 1ª emissão.
 * `empresaNumero` = próximo sugerido no GET empresa; `localMax`/`periodoMax` = maior já usado.
 * @param {{ empresaNumero?: number|null, localMaxNumero?: number|null, periodoMaxNumero?: number|null }} sources
 * @returns {number}
 */
export function resolveNextNfseRpsFromSources(sources = {}) {
  const localMax = parsePositiveInt(sources.localMaxNumero, 0);
  const periodoMax = parsePositiveInt(sources.periodoMaxNumero, 0);
  const empresaNext = parsePositiveInt(sources.empresaNumero, 0);
  const maxUsed = Math.max(localMax, periodoMax);
  // Histórico real (local + período) é autoritativo — contador PlugNotas à frente não pode pular DPS.
  if (maxUsed >= 1) return maxUsed + 1;
  if (empresaNext >= 1) return empresaNext;
  return 1;
}

/**
 * Maior DPS/RPS já enviado (histórico local + PlugNotas período completo).
 * @param {string} cnpjInput
 * @param {number|null|undefined} localMaxNumero
 * @returns {Promise<number>}
 */
export async function queryAuthoritativeNfseRpsMaxUsed(cnpjInput, localMaxNumero = 0) {
  const localMax = parsePositiveInt(localMaxNumero, 0);
  const periodoMax = parsePositiveInt(await queryMaxRpsNumeroFromPlugnotasPeriodo(cnpjInput), 0);
  return Math.max(localMax, periodoMax);
}

const collectPeriodoNotas = (body) => {
  if (!body || typeof body !== 'object') return [];
  const candidates = [body.notas, body.documentos, body.data, body.nfses];
  for (const list of candidates) {
    if (Array.isArray(list) && list.length) return list;
  }
  return [];
};

/**
 * @deprecated Preferir max conhecido via {@link readRpsNumeroFromNfseHistoryRow}.
 * Mantido só para testes de regressão — contagem de linhas ≠ número RPS na prefeitura.
 */
export function resolveNfseRpsLocalMaxFromHistory(input = {}) {
  const maxKnown = parsePositiveInt(input.maxKnownNumero, 0);
  return maxKnown > 0 ? maxKnown : null;
}

const buildPlugnotasEmpresaRpsBlocks = ({ serie, lote, numero }) => ({
  rootRps: {
    lote,
    numeracao: [{ serie, numero }]
  },
  // PATCH empresa: numeracao só na raiz `rps`; config.rps é flat (contrato PlugNotas).
  configRps: {
    serie,
    numero,
    lote
  }
});

/** PATCH só de RPS — sem `prefeitura.login/senha` (evita bloqueio NFS-e Nacional). */
const buildMinimalNfseConfigForRpsPatch = (existingConfig, configRps) => {
  const base = existingConfig && typeof existingConfig === 'object' && !Array.isArray(existingConfig)
    ? existingConfig
    : {};
  return {
    producao: base.producao !== false,
    rps: configRps,
  };
};

/**
 * ID do certificado na ficha da empresa (GET) — formatos string ou objeto `{ id }`.
 * @param {unknown} empresaJson
 * @returns {string|null}
 */
const readCertificadoIdFromEmpresaJson = (empresaJson) => {
  const empresa = unwrapPlugnotasEmpresaRecord(empresaJson);
  if (!empresa || typeof empresa !== 'object') return null;
  const candidates = [
    empresa.certificado,
    empresa.certificadoId,
    empresa.idCertificado,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const nested = candidate.id ?? candidate._id ?? candidate.uuid;
      if (nested != null && String(nested).trim()) return String(nested).trim();
    }
  }
  return null;
};

/**
 * Resolve `certificado` obrigatório no PATCH /empresa (PlugNotas).
 * @param {string} cnpj
 * @param {unknown} empresaJson
 * @returns {Promise<string|null>}
 */
const resolveCertificadoIdForEmpresaRpsPatch = async (cnpj, empresaJson) => {
  const fromEmpresa = readCertificadoIdFromEmpresaJson(empresaJson);
  if (fromEmpresa) return fromEmpresa;
  try {
    const resolved = await resolverCertificadoIdPorCnpj(cnpj);
    const id = resolved != null ? String(resolved).trim() : '';
    return id || null;
  } catch (error) {
    console.warn(
      '[plugnotas-rps] não foi possível resolver certificado para PATCH RPS',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
};

const patchPlugnotasEmpresaRpsNextNumero = async (cnpj, empresaJson, { serie, lote, numero }) => {
  const empresa = unwrapPlugnotasEmpresaRecord(empresaJson);
  const nfseAtivo = empresa?.nfse?.ativo !== false;
  const existingConfig = empresa?.nfse?.config && typeof empresa.nfse.config === 'object'
    ? empresa.nfse.config
    : { producao: true };
  const { rootRps, configRps } = buildPlugnotasEmpresaRpsBlocks({ serie, lote, numero });
  const certificado = await resolveCertificadoIdForEmpresaRpsPatch(cnpj, empresaJson);
  if (!certificado) {
    throw new Error(
      'Certificado digital não encontrado no emissor para alinhar a numeração. '
      + 'Em Certificado, confirme o .pfx activo ou grave de novo a empresa.',
    );
  }

  await atualizarEmpresaPlugNotas({
    cpfCnpj: cnpj,
    certificado,
    rps: rootRps,
    nfse: {
      ativo: nfseAtivo,
      config: buildMinimalNfseConfigForRpsPatch(existingConfig, configRps),
    }
  });
};

/**
 * Alinha o contador RPS no PlugNotas ao número que será emitido (config pode estar atrasada).
 * @param {string} cnpjInput
 * @param {{ serie: string, lote: number, numero: number }} targetRps
 * @param {unknown} [empresaJson]
 * @param {{ strict?: boolean }} [opts]
 */
export async function syncPlugnotasNfseRpsBeforeEmit(cnpjInput, targetRps, empresaJson = null, opts = {}) {
  const cnpj = normalizeDoc(cnpjInput);
  const targetNumero = parsePositiveInt(targetRps?.numero);
  if (cnpj.length !== 14 || !Number.isFinite(targetNumero)) return;

  const usedSerie = String(targetRps?.serie ?? '1').trim() || '1';
  const usedLote = parsePositiveInt(targetRps?.lote, 1);

  let empresa = empresaJson;
  if (!empresa) {
    try {
      empresa = await consultarEmpresaPlugNotas(cnpj);
    } catch {
      return;
    }
  }

  try {
    await patchPlugnotasEmpresaRpsNextNumero(cnpj, empresa, {
      serie: usedSerie,
      lote: usedLote,
      numero: targetNumero
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[plugnotas-rps] falha ao sincronizar contador RPS antes da emissão', message);
    if (opts.strict === true) {
      throw new Error(`Não foi possível alinhar a numeração na PlugNotas: ${message}`);
    }
  }
}

/**
 * Lê série/número/lote configurados em `nfse.config.rps` (GET empresa PlugNotas).
 * @param {unknown} empresaJson
 * @returns {{ serie: string, numero: number, lote: number }|null}
 */
export function readPlugnotasNfseNextRpsFromEmpresa(empresaJson) {
  const empresa = unwrapPlugnotasEmpresaRecord(empresaJson);
  const rps = empresa?.nfse?.config?.rps;
  if (!rps || typeof rps !== 'object' || Array.isArray(rps)) return null;

  const numeracao = Array.isArray(rps.numeracao) ? rps.numeracao[0] : null;
  const serie = String(numeracao?.serie ?? rps.serie ?? '1').trim() || '1';
  const numero = parsePositiveInt(numeracao?.numero ?? rps.numero);
  if (!Number.isFinite(numero)) return null;
  const lote = parsePositiveInt(rps.lote, 1);
  return { serie, numero, lote };
}

/**
 * Calcula e aplica o próximo RPS seguro (empresa + histórico local + PlugNotas período).
 * @param {Record<string, unknown>} payload
 * @param {string} cnpjInput
 * @param {{ localMaxRpsNumero?: number|null, plugnotasApiMaxRpsNumero?: number|null, skipPlugnotasPeriodoQuery?: boolean, empresaJson?: unknown }} [opts]
 * @returns {Promise<{ safeNext: number, localMax: number|null, periodoMax: number|null, empresaNumero: number|null, serie: string, lote: number }|null>}
 */
export async function resolveAndApplySafeNfseRpsBeforeEmit(payload, cnpjInput, opts = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return null;

  const localMax = parsePositiveInt(opts.localMaxRpsNumero, 0);
  let periodoMax = parsePositiveInt(opts.plugnotasApiMaxRpsNumero, 0);
  if (!periodoMax && opts.skipPlugnotasPeriodoQuery !== true) {
    periodoMax = parsePositiveInt(
      await queryMaxRpsNumeroFromPlugnotasPeriodo(cnpj, { maxPages: PLUGNOTAS_NFSE_PERIODO_FAST_PAGES }),
      0,
    );
  }

  let empresaJson = opts.empresaJson ?? null;
  let empresaNumero = null;
  let serie = '1';
  let lote = 1;
  if (!empresaJson) {
    try {
      empresaJson = await consultarEmpresaPlugNotas(cnpj);
    } catch {
      empresaJson = null;
    }
  }
  if (empresaJson) {
    const next = readPlugnotasNfseNextRpsFromEmpresa(empresaJson);
    if (next) {
      empresaNumero = next.numero;
      serie = next.serie;
      lote = next.lote;
    }
  }

  const safeNext = resolveNextNfseRpsFromSources({
    empresaNumero,
    localMaxNumero: localMax,
    periodoMaxNumero: periodoMax,
  });

  payload.rps = {
    lote,
    numeracao: [{ serie, numero: safeNext }],
  };

  await syncPlugnotasNfseRpsBeforeEmit(cnpj, { serie, lote, numero: safeNext }, empresaJson);

  return {
    safeNext,
    localMax: localMax > 0 ? localMax : null,
    periodoMax: periodoMax > 0 ? periodoMax : null,
    empresaNumero,
    serie,
    lote,
  };
}

/**
 * NFS-e Nacional: sempre injeta série/número explícitos antes do POST — mesmo que o payload
 * já traga `rps` (reemissão, payload antigo ou contador PlugNotas desatualizado).
 * @param {Record<string, unknown>} payload
 * @param {string} cnpjInput
 * @param {{ localMaxRpsNumero?: number|null }} [opts]
 */
export async function applyPlugnotasNfseEmitRpsFromEmpresaConfig(payload, cnpjInput, opts = {}) {
  await resolveAndApplySafeNfseRpsBeforeEmit(payload, cnpjInput, opts);
}

const DEFAULT_NFSE_E0014_EMIT_RETRIES = 6;
const NFSE_HEAL_PROCESSING_POLL_MAX_MS = 15000;
const NFSE_HEAL_PROCESSING_POLL_INTERVAL_MS = 700;

const extractResponseStatusToken = (response) => {
  const bodies = collectPlugnotasNfseBodies(response);
  for (const body of bodies) {
    const token = body?.status ?? body?.retorno?.situacao ?? body?.situacao;
    if (token) return String(token).normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  }
  return '';
};

const isProcessingNfseResponse = (response) => {
  const token = extractResponseStatusToken(response);
  return token.includes('PROCESS');
};

const extractIntegracaoIdFromResponse = (response) => {
  const bodies = collectPlugnotasNfseBodies(response);
  for (const body of bodies) {
    const id = body?.idIntegracao ?? body?.id_integracao;
    if (id) return String(id);
  }
  return null;
};

const sleepMs = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * Poll curto após POST PROCESSANDO para capturar E0014 antes de persistir.
 */
async function pollNfseHealResponseForTerminalDuplicate(
  adapter,
  response,
  payload,
  cnpjInput,
) {
  if (isNfseE0014FromPlugnotasResponse(response)) return response;
  if (!isProcessingNfseResponse(response)) return response;

  const consultar = adapter?.consultarPorIntegracao;
  const cnpj = normalizeDoc(cnpjInput);
  const integracao = extractIntegracaoIdFromResponse(response)
    || String(payload?.idIntegracao ?? '');
  if (typeof consultar !== 'function' || cnpj.length !== 14 || !integracao) {
    return response;
  }

  const started = Date.now();
  let current = response;
  while (Date.now() - started < NFSE_HEAL_PROCESSING_POLL_MAX_MS) {
    await sleepMs(NFSE_HEAL_PROCESSING_POLL_INTERVAL_MS);
    try {
      const polled = await consultar(integracao, cnpj);
      if (!polled) continue;
      current = polled;
      if (isNfseE0014FromPlugnotasResponse(current)) return current;
      if (!isProcessingNfseResponse(current)) return current;
    } catch {
      // continua até timeout
    }
  }
  return current;
}

const bumpNumeroAboveSet = (numero, usedSet) => {
  let next = parsePositiveInt(numero, 1);
  while (usedSet.has(next)) next += 1;
  return next;
};

/**
 * Emite NFS-e com realinhamento do contador PlugNotas e reenvio automático em E0014.
 * @param {{ emitir: (payload: Record<string, unknown>) => Promise<unknown> }} adapter
 * @param {Record<string, unknown>} emitPayload
 * @param {string} cnpjInput
 * @param {() => string} buildFreshIdIntegracao
 * @param {{ maxRetries?: number, localMaxRpsNumero?: number|null }} [opts]
 * @returns {Promise<{ response: unknown, emitPayload: Record<string, unknown>, attemptedNumeros: number[] }>}
 */
export async function emitNfseWithPlugnotasRpsHeal(
  adapter,
  emitPayload,
  cnpjInput,
  buildFreshIdIntegracao,
  opts = {}
) {
  const cnpj = normalizeDoc(cnpjInput);
  const maxRetries = Number.isFinite(opts.maxRetries)
    ? Math.max(0, Math.trunc(opts.maxRetries))
    : DEFAULT_NFSE_E0014_EMIT_RETRIES;
  const localMaxHint = parsePositiveInt(opts.localMaxRpsNumero, 0);
  const attemptedNumeros = new Set();

  let payload = emitPayload;
  let response;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const plannedNumero = readRpsFromNfseEmitPayload(payload)?.numero;
    if (Number.isFinite(plannedNumero)) attemptedNumeros.add(plannedNumero);

    response = await adapter.emitir(payload);
    response = await pollNfseHealResponseForTerminalDuplicate(adapter, response, payload, cnpj);

    if (!isNfseE0014FromPlugnotasResponse(response)) {
      return {
        response,
        emitPayload: payload,
        attemptedNumeros: [...attemptedNumeros],
      };
    }

    let usedNumero = readRpsNumeroFromNfsePlugnotasBody(response)
      ?? readRpsFromNfseEmitPayload(payload)?.numero;
    if (Number.isFinite(usedNumero)) attemptedNumeros.add(usedNumero);

    if (!Number.isFinite(usedNumero) && cnpj.length === 14) {
      const periodoMax = parsePositiveInt(
        await queryMaxRpsNumeroFromPlugnotasPeriodo(cnpj, { maxPages: PLUGNOTAS_NFSE_PERIODO_MAX_PAGES }),
        0,
      );
      if (periodoMax > 0) usedNumero = periodoMax;
    }

    if (!Number.isFinite(usedNumero)) {
      usedNumero = parsePositiveInt(readRpsFromNfseEmitPayload(payload)?.numero, 1);
    }

    const currentRps = readRpsFromNfseEmitPayload(payload);
    const serie = currentRps?.serie ?? '1';
    const lote = currentRps?.lote ?? 1;
    await advancePlugnotasNfseRpsAfterEmit(cnpj, { serie, lote, numero: usedNumero });

    if (attempt >= maxRetries) {
      await syncPlugnotasNfseRpsBeforeEmit(cnpj, {
        serie,
        lote,
        numero: usedNumero + 1,
      });
      return {
        response,
        emitPayload: payload,
        attemptedNumeros: [...attemptedNumeros],
      };
    }

    let periodoMax = 0;
    if (cnpj.length === 14) {
      periodoMax = parsePositiveInt(
        await queryMaxRpsNumeroFromPlugnotasPeriodo(cnpj, { maxPages: PLUGNOTAS_NFSE_PERIODO_MAX_PAGES }),
        0,
      );
    }
    const nextFromFailure = resolveNextNfseRpsAfterFailure(
      usedNumero,
      Math.max(localMaxHint, usedNumero, ...attemptedNumeros),
      periodoMax,
    );
    const nextNumero = bumpNumeroAboveSet(nextFromFailure, attemptedNumeros);
    attemptedNumeros.add(nextNumero);

    payload = { ...payload };
    payload.rps = { lote, numeracao: [{ serie, numero: nextNumero }] };
    if (typeof buildFreshIdIntegracao === 'function') {
      payload.idIntegracao = buildFreshIdIntegracao();
    }

    await syncPlugnotasNfseRpsBeforeEmit(cnpj, { serie, lote, numero: nextNumero });
  }

  return {
    response,
    emitPayload: payload,
    attemptedNumeros: [...attemptedNumeros],
  };
}

/**
 * Após E0014 ou emissão com número conhecido, garante contador PlugNotas em `numero + 1`.
 * @param {string} cnpjInput
 * @param {{ serie?: string, numero: number, lote?: number }} usedRps
 */
export async function healPlugnotasNfseRpsAfterUsedNumero(cnpjInput, usedRps) {
  await advancePlugnotasNfseRpsAfterEmit(cnpjInput, usedRps);
}

/**
 * Avança o contador RPS no PlugNotas após emissão (aceita ou rejeitada com número consumido).
 * Falhas são ignoradas — a reserva local em `resolveNextNfseRpsNumero` cobre o intervalo.
 * @param {string} cnpjInput
 * @param {{ serie?: string, numero: number, lote?: number }} usedRps
 */
export async function advancePlugnotasNfseRpsAfterEmit(cnpjInput, usedRps) {
  const cnpj = normalizeDoc(cnpjInput);
  const usedNumero = parsePositiveInt(usedRps?.numero);
  if (cnpj.length !== 14 || !Number.isFinite(usedNumero)) return;

  const usedSerie = String(usedRps?.serie ?? '1').trim() || '1';
  const usedLote = parsePositiveInt(usedRps?.lote, 1);
  const targetNext = usedNumero + 1;

  let empresaJson;
  try {
    empresaJson = await consultarEmpresaPlugNotas(cnpj);
  } catch {
    return;
  }

  const current = readPlugnotasNfseNextRpsFromEmpresa(empresaJson);
  if (current && current.numero >= targetNext) return;

  try {
    await patchPlugnotasEmpresaRpsNextNumero(cnpj, empresaJson, {
      serie: usedSerie,
      lote: usedLote,
      numero: targetNext
    });
  } catch (error) {
    console.warn(
      '[plugnotas-rps] falha ao avançar contador RPS após emissão',
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Empresa no emissor já tem bloco `rps` utilizável (lote + numeração com série).
 * @param {unknown} empresaJson
 * @returns {boolean}
 */
export function empresaPlugnotasTemRpsCadastrado(empresaJson) {
  const empresa = unwrapPlugnotasEmpresaRecord(empresaJson);
  if (!empresa) return false;
  return hasNfseConfigRpsShape(empresa) || hasClientRpsShape(empresa.rps);
}

/**
 * Repara cadastros legados (POST conflito → PATCH sem `rps`) antes da emissão NFS-e.
 * Idempotente quando o emissor já possui numeração.
 * @param {string} cnpjInput
 */
export async function ensureEmpresaPlugnotasRpsForNfseEmit(cnpjInput, empresaJsonCached = null) {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return;

  let empresaJson = empresaJsonCached;
  if (!empresaJson) {
    try {
      empresaJson = await consultarEmpresaPlugNotas(cnpj);
    } catch {
      return;
    }
  }

  if (empresaPlugnotasTemRpsCadastrado(empresaJson)) return;

  const empresa = unwrapPlugnotasEmpresaRecord(empresaJson);
  const nfseAtivo = empresa?.nfse?.ativo !== false;

  await atualizarEmpresaPlugNotas({
    cpfCnpj: cnpj,
    rps: cloneEmpresaPlugnotasRpsInicialPost(),
    nfse: {
      ativo: nfseAtivo,
      tipoContrato: 0,
      config: {
        producao: true,
        nfseNacional: true,
        consultaNfseNacional: true,
        rps: { ...EMPRESA_PLUGNOTAS_NFSE_CONFIG_RPS_CANONICAL }
      }
    }
  });
}
