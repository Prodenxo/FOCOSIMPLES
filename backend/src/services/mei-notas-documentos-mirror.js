import { saveDocumentosAtivosMirror } from './mei-certificate-store.js';
import { reconcileEmitenteMirrorFromEmpresaJson } from './mei-emitente-empresa-sync.js';
import { consultarEmpresaPlugNotas } from './plugnotas/empresa.service.js';
import {
  assertAtLeastOneDocumentoAtivo,
  extractDocumentosAtivosFromEmpresaResponse,
  normalizeDocumentosAtivosShape
} from './plugnotas/plugnotas-empresa-documentos-ativos.js';

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
