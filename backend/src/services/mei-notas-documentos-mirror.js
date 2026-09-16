import {
  clearEmitenteInscricaoMunicipalMirror,
  patchEmitenteNfseFields,
  saveDocumentosAtivosMirror,
} from './mei-certificate-store.js';
import { shouldSuppressInscricaoMunicipalForNfseNacional } from './plugnotas/plugnotas-mei-empresa-policy.js';
import { reconcileEmitenteMirrorFromEmpresaJson } from './mei-emitente-empresa-sync.js';
import { consultarEmpresaPlugNotas } from './plugnotas/empresa.service.js';
import {
  assertAtLeastOneDocumentoAtivo,
  extractDocumentosAtivosFromEmpresaResponse,
  normalizeDocumentosAtivosShape
} from './plugnotas/plugnotas-empresa-documentos-ativos.js';

/**
 * Série/número do RPS escolhidos pelo utilizador no payload de escrita.
 * Só do payload — a PlugNotas devolve `numeracao` com uma entrada por série, e ler de lá
 * traria a série errada de volta para o espelho.
 * @param {Record<string, unknown>} payload
 * @returns {{ rpsSerie?: string, rpsNumero?: number, rpsLote?: number }|null}
 */
export function readRpsMirrorFromEmpresaPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const configRps = payload?.nfse?.config?.rps;
  const rootRps = payload?.rps;
  const numeracaoFirst = Array.isArray(rootRps?.numeracao) ? rootRps.numeracao[0] : null;

  const serie = String(configRps?.serie ?? numeracaoFirst?.serie ?? '').trim();
  const numero = Number.parseInt(String(configRps?.numero ?? numeracaoFirst?.numero ?? ''), 10);
  const lote = Number.parseInt(String(configRps?.lote ?? rootRps?.lote ?? ''), 10);

  const out = {};
  if (serie) out.rpsSerie = serie;
  if (Number.isFinite(numero) && numero >= 1) out.rpsNumero = numero;
  if (Number.isFinite(lote) && lote >= 1) out.rpsLote = lote;
  return Object.keys(out).length ? out : null;
}

/**
 * Espelho Supabase após sucesso Plugnotas (FR-CAD-DOC P1); não falha a resposta HTTP.
 * @param {string|undefined} userId
 * @param {Record<string, unknown>} payload
 * @param {object} [deps] — injeção para testes
 * @param {object} [deps.mirrorSaveDeps] — repassado a `saveDocumentosAtivosMirror` (ex.: `logWarn`, `getSupabase` em testes)
 */
export async function persistDocumentosAtivosMirrorAfterEmpresa(userId, payload, deps = {}) {
  const save = deps.saveDocumentosAtivosMirror ?? saveDocumentosAtivosMirror;
  const normalize = deps.normalizeDocumentosAtivosShape ?? normalizeDocumentosAtivosShape;
  const assertOne = deps.assertAtLeastOneDocumentoAtivo ?? assertAtLeastOneDocumentoAtivo;
  const syncEmitente = deps.reconcileEmitenteMirrorFromEmpresaJson ?? reconcileEmitenteMirrorFromEmpresaJson;
  if (!userId || !payload || typeof payload !== 'object') return;

  await syncEmitente(userId, payload).catch(() => {});

  // Guarda qual série o utilizador escolheu — é ela que identifica a entrada certa em `numeracao`.
  const rpsMirror = readRpsMirrorFromEmpresaPayload(payload);
  if (rpsMirror) {
    const patchEmitente = deps.patchEmitenteNfseFields ?? patchEmitenteNfseFields;
    await patchEmitente(userId, rpsMirror).catch(() => {});
  }

  const im = String(payload.inscricaoMunicipal ?? '').trim();
  if (shouldSuppressInscricaoMunicipalForNfseNacional(payload) && !im) {
    await clearEmitenteInscricaoMunicipalMirror(userId).catch(() => {});
  }

  if (!Object.prototype.hasOwnProperty.call(payload, 'documentosAtivos')) return;
  try {
    const selection = normalize(payload.documentosAtivos);
    assertOne(selection);
    await save(userId, selection, deps.mirrorSaveDeps ?? {});
  } catch {
    // deploy parcial ou payload inesperado — não bloquear cadastro fiscal
  }
}

/**
 * Após GET empresa bem-sucedido: extrair documentos ativos e gravar espelho Supabase (FR-UPD-DOC P0).
 * Falhas engolidas — não afectam a resposta HTTP da consulta.
 *
 * @param {string|undefined} userId
 * @param {unknown} empresaJson — resposta Plugnotas de GET /empresa
 * @param {object} [deps] — injeção para testes
 * @param {object} [deps.mirrorSaveDeps] — repassado a `saveDocumentosAtivosMirror`
 */
export async function reconcileMirrorFromEmpresaJson(userId, empresaJson, deps = {}) {
  const save = deps.saveDocumentosAtivosMirror ?? saveDocumentosAtivosMirror;
  const extract = deps.extractDocumentosAtivosFromEmpresaResponse
    ?? extractDocumentosAtivosFromEmpresaResponse;
  const syncEmitente = deps.reconcileEmitenteMirrorFromEmpresaJson ?? reconcileEmitenteMirrorFromEmpresaJson;
  if (!userId) return;

  await syncEmitente(userId, empresaJson).catch(() => {});

  try {
    const selection = extract(empresaJson);
    if (!selection) return;
    await save(userId, selection, deps.mirrorSaveDeps ?? {});
  } catch {
    // rede / coluna ausente / sem linha UMC — não bloquear consulta
  }
}

/**
 * GET empresa Plugnotas + reconciliar espelho Supabase (fluxo usado por `consultarPlugNotasEmpresa`).
 * Injeção opcional para testes (`consultarEmpresaPlugNotas`, `reconcileMirrorFromEmpresaJson`).
 *
 * @param {string|undefined} userId
 * @param {string} cpfCnpj
 * @param {object} [deps]
 * @returns {Promise<unknown>} mesmo payload devolvido por `consultarEmpresaPlugNotas`
 */
export async function consultarEmpresaAndReconcileMirror(userId, cpfCnpj, deps = {}) {
  const consult = deps.consultarEmpresaPlugNotas ?? consultarEmpresaPlugNotas;
  const reconcile = deps.reconcileMirrorFromEmpresaJson ?? reconcileMirrorFromEmpresaJson;
  const data = await consult(cpfCnpj);
  await reconcile(userId, data, deps);
  return data;
}
