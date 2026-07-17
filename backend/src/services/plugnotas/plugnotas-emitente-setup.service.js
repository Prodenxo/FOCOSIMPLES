import path from 'node:path';
import { HttpError, badRequest } from '../../utils/errors.js';
import {
  cadastrarCertificadoPlugNotas,
  cadastrarEmpresaPlugNotas
} from './empresa.service.js';

export const ORCHESTRATION_PHASE = Object.freeze({
  CERTIFICADO: 'certificado',
  EMPRESA: 'empresa'
});

/**
 * Acrescenta `orchestrationPhase` ao objecto `errors` de `HttpError` (NFR-ORQ-CERT-02 / P1).
 * Erros que não são `HttpError` são normalizados para `HttpError` com a mesma fase (evita respostas sem metadado).
 * @param {unknown} err
 * @param {string} phase
 */
export const withOrchestrationPhase = (err, phase) => {
  if (err instanceof HttpError) {
    const prev = err.errors && typeof err.errors === 'object' && !Array.isArray(err.errors) ? err.errors : {};
    return new HttpError(err.status, err.message, { ...prev, orchestrationPhase: phase });
  }
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : typeof err === 'object' && err !== null && typeof err.message === 'string'
          ? err.message
          : 'Erro inesperado na orquestração do emitente fiscal';
  const rawStatus =
    typeof err === 'object' && err !== null ? Number(err.status) : Number.NaN;
  const status =
    Number.isFinite(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  return new HttpError(status, message, { orchestrationPhase: phase });
};

/**
 * Campo multipart `payload`: JSON com corpo da empresa (mesma forma que `POST …/empresa`, sem `certificado` obrigatório — injetado após sucesso do certificado).
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
export const parseEmpresaJsonPayloadField = (raw) => {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw badRequest('Campo "payload" (JSON da empresa) é obrigatório');
  }
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw badRequest('Campo "payload" deve ser JSON válido');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw badRequest('Campo "payload" deve ser um objeto JSON');
  }
  return /** @type {Record<string, unknown>} */ (parsed);
};

/**
 * Orquestra certificado Plugnotas → empresa Plugnotas num único passo servidor (FR-ORQ-CERT P1).
 * Reutiliza `cadastrarCertificadoPlugNotas` e `cadastrarEmpresaPlugNotas` sem duplicar 409/empresa.
 *
 * @param {object} input
 * @param {Buffer|undefined} input.fileBuffer
 * @param {string|undefined} input.fileName
 * @param {string|undefined} input.mimeType
 * @param {string} input.password
 * @param {string} [input.email]
 * @param {string} [input.cpfCnpj]
 * @param {Record<string, unknown>} input.empresaPayload
 */
export async function runPlugnotasEmitenteCompositeSetup(input) {
  const {
    fileBuffer,
    fileName,
    mimeType,
    password,
    email,
    cpfCnpj,
    empresaPayload
  } = input;

  const safeName = path.basename(String(fileName || '')) || 'certificado.pfx';

  let certificado;
  try {
    certificado = await cadastrarCertificadoPlugNotas({
      fileBuffer,
      fileName: safeName,
      mimeType,
      password,
      ...(email ? { email } : {}),
      ...(cpfCnpj ? { cpfCnpj } : {})
    });
  } catch (err) {
    throw withOrchestrationPhase(err, ORCHESTRATION_PHASE.CERTIFICADO);
  }

  const certificadoId = certificado?.id != null ? String(certificado.id).trim() : '';
  if (!certificadoId) {
    throw badRequest(
      'Cadastro do certificado no emissor não devolveu um ID utilizável para concluir o registo da empresa.',
      { orchestrationPhase: ORCHESTRATION_PHASE.CERTIFICADO }
    );
  }

  const empresaInput = {
    ...empresaPayload,
    certificado: certificadoId
  };

  let empresa;
  try {
    empresa = await cadastrarEmpresaPlugNotas(empresaInput);
  } catch (err) {
    throw withOrchestrationPhase(err, ORCHESTRATION_PHASE.EMPRESA);
  }

  return {
    certificado: { id: certificadoId },
    empresa: {
      cnpj: empresa.cnpj,
      operation: empresa.operation,
      message: empresa.message
    }
  };
}
