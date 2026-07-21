import { env } from '../../config/env.js';
import { HttpError, badRequest } from '../../utils/errors.js';
import { buildErrorMessageFromBody } from './plugnotas-error-message.js';
import { isPlugnotasDebugExplicitlyEnabled } from './plugnotas-debug-env.js';
import {
  isEmpresaCadastroPlugnotasPath,
  logPlugnotasEmpresaCadastro400Request
} from './plugnotas-empresa-cadastro-debug.js';
import { logPlugnotasEmpresaIbgeTable400 } from './plugnotas-empresa-ibge-table-400-log.js';
import {
  logPlugnotasCertificado409Resolve,
  PLUGNOTAS_CERT_409_RESOLVE_STEPS
} from './plugnotas-certificado-409-resolve-log.js';
import { maskPlugnotasPathOrUrlForLog } from './plugnotas-request-log-path.js';
import {
  extrairCertificadoIdDeListagem,
  normalizeCertificadoIdCandidate,
  normalizeCertificadoListItems
} from './plugnotas-certificado-listagem-parse.js';
import { getPlugnotasRootUrl } from './root-url.js';
import {
  applyNfseNationalContractPolicy,
  buildMeiRegimePatchPayload,
  inspectNfseContractInput,
  normalizeMeiEmpresaPayload,
  PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA,
  PLUGNOTAS_REGIME_ESPECIAL_MEI,
} from './plugnotas-mei-empresa-policy.js';
import { unwrapPlugnotasEmpresaRecord } from '../mei-emitente-empresa-sync.js';
import { assertMeiCertificateEligible } from '../mei-certificate-eligibility.service.js';
import { consultarCidadePlugNotas } from './plugnotas-cidades.service.js';
import {
  applyEmpresaPlugnotasDocumentSelectionForPatch,
  applyEmpresaPlugnotasDocumentSelectionForPost,
  resolveDocumentosAtivosForPatch,
  resolveDocumentosAtivosForPost,
  stripDocumentosAtivos
} from './plugnotas-empresa-documentos-ativos.js';
import { normalizeIbgeMunicipioCodigo } from '../../utils/ibge-municipio-codigo.js';
import { isPlugnotasIbgeTableRejectMessage } from '../../utils/plugnotasIbgeTableRejectMessage.js';
import {
  applyEmpresaPlugnotasNfseConfigRps,
  applyEmpresaPlugnotasRpsInicialForPost,
  cloneEmpresaPlugnotasRpsInicialPost,
  hasClientRpsShape,
  hasNfseConfigRpsShape,
  sanitizeEmpresaPlugnotasRpsPayload,
  stripRpsFromEmpresaPayload
} from './plugnotas-empresa-rps-inicial.js';
import { applyNfseConfigPrefeituraDeriveIbge } from './nfsePrefeituraPayload.js';
import {
  attachRuntimeDecisionToError,
  buildEmpresaCadastroRuntimeDecision,
  createEmpresaCadastroBlockedErrorFromDecision,
  PREFEITURA_LOGIN_REQUIRED_FALLBACK_AVAILABLE_CODE,
  PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE,
  PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE,
  PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE,
  resolveEmpresaCadastroMunicipioPreflightInput,
  resolveEmpresaCadastroMunicipioRuntimeDecision
} from './empresa-cadastro-runtime-decision.js';
import {
  applyPrefeituraPortalCredentialsPolicy,
  assertNoAmbiguousNationalWithPrefeituraCredentials,
  extractPrefeituraPortalCredentialState,
  isPrefeituraLoginRequiredUpstreamMessage,
  PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE,
  PREFEITURA_LOGIN_REQUIRED_BLOCKED_MESSAGE,
  resolveAttemptNfseModeFromPayload,
  sanitizePlugnotasEmpresaJsonForClientResponse
} from './prefeituraPortalCredentials.js';
import {
  applyPrefeituraIbgeOnlyBlockPolicy,
  PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_CODE
} from './prefeituraIbgeOnlyBlock.js';
import {
  resolvePlugnotasGatewayUpstreamForClient,
  summarizePlugnotasErrorLogBody
} from './plugnotas-gateway-upstream-error.js';
const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

/** Blocos mínimos inativos — sem `config`, para não disparar validação SEFAZ / `versaoQrCode` no Plugnotas (produto apenas NFS-e). Ver `docs/adr/ADR-plugnotas-empresa-payload-apenas-nfse.md`. */
const PLUGNOTAS_EMPRESA_APENAS_NFSE_NFE = Object.freeze({ ativo: false, tipoContrato: 0 });
const PLUGNOTAS_EMPRESA_APENAS_NFSE_NFCE = Object.freeze({ ativo: false, tipoContrato: 0 });

const hasOwn = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Garante `endereco.codigoCidade` como string só com dígitos antes do Plugnotas (FR-CID-BE-01).
 * Não cria `endereco` se ausente.
 * @param {Record<string, unknown>} payload
 */
const normalizePayloadEnderecoCodigoCidade = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  const endereco = payload.endereco;
  if (!endereco || typeof endereco !== 'object' || Array.isArray(endereco)) return;
  if (!hasOwn(endereco, 'codigoCidade')) return;
  endereco.codigoCidade = normalizeIbgeMunicipioCodigo(endereco.codigoCidade);
};

/**
 * Legado controlado / rollback: só deriva `nfse.config.prefeitura.codigoIbge`
 * quando um cliente brownfield ainda chega com shape legado (`nfse.nacional`).
 * Usa `process.env` em tempo de chamada (não só o snapshot de `env.js`) para testes e workers.
 */
const applyNfsePrefeituraIbgeIfEnabled = (payload) => {
  if (process.env.PLUGNOTAS_NFSE_PREFEITURA_DERIVE_IBGE !== 'true') return;
  applyNfseConfigPrefeituraDeriveIbge(payload, { derivePrefeituraIbge: true });
};

/**
 * IE ausente ou em branco → `ISENTO` (MEI sem IE coletada na UI).
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
 * PATCH: não inclui `nfe`/`nfce` se o cliente não os enviou (evita reativar NFC-e legada).
 * Se enviados, substitui por blocos inativos sem `config`. IE só se a chave vier no corpo.
 * @param {Record<string, unknown>} payload
 */
const applyEmpresaPlugnotasApenasNfseForPatch = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  if (hasOwn(payload, 'nfe')) {
    payload.nfe = { ...PLUGNOTAS_EMPRESA_APENAS_NFSE_NFE };
  }
  if (hasOwn(payload, 'nfce')) {
    payload.nfce = { ...PLUGNOTAS_EMPRESA_APENAS_NFSE_NFCE };
  }
  normalizeInscricaoEstadualApenasNfse(payload);
  applyNfseNationalContractPolicy(payload);
};

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const toMessage = (payload, fallback = '') => {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload || fallback;
  if (typeof payload !== 'object') return fallback;
  return payload?.error?.message || payload?.message || payload?.error || fallback;
};

/** Mensagem de erro Plugnotas incluindo `errors` / detalhes quando o corpo for JSON. */
const messageFromPlugnotasPayload = (payload, statusText) => {
  if (payload === null || payload === undefined) return statusText;
  if (typeof payload === 'string') return payload || statusText;
  if (typeof payload === 'object' && !Array.isArray(payload)) {
    return buildErrorMessageFromBody(payload, statusText);
  }
  return toMessage(payload, statusText);
};

/** Metadados para o cliente (Network / apiClient) identificar qual chamada ao Plugnotas falhou. */
const plugnotasRequestErrors = (method, path, httpStatus = null) => ({
  plugnotasRequest: { method, path },
  ...(Number.isFinite(httpStatus) ? { httpStatus } : {})
});

const isGatewayLikePlugnotasCode = (code) => /^plugnotas_gateway_\d+$/.test(String(code || ''));

const isEmpresaPayloadContratoRequest = (method, path, status, gateway) => (
  String(method || '').toUpperCase() === 'POST'
  && isEmpresaCadastroPlugnotasPath(path)
  && Number(status) === 400
  && !gateway
);

const isEmpresaNaoLocalizadaMessage = (message = '') => {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('não localizamos')
    || normalized.includes('nao localizamos')
    || normalized.includes('não encontramos')
    || normalized.includes('nao encontramos')
    || normalized.includes('empresa não encontrada')
    || normalized.includes('empresa nao encontrada')
  );
};

const resolveEmpresaPlugnotasErrorCode = ({ method, path, status, gateway, rawMessage }) => {
  if (Number(status) === 400 && isPrefeituraLoginRequiredUpstreamMessage(rawMessage)) {
    return PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE;
  }
  if (gateway) return gateway.plugnotasCode;
  if (Number(status) === 401 || Number(status) === 403) {
    return PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE;
  }
  if (String(method || '').toUpperCase() === 'GET' && String(path || '').startsWith('/empresa/') && Number(status) === 404) {
    return isEmpresaNaoLocalizadaMessage(rawMessage)
      ? PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE
      : PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE;
  }
  if (isEmpresaPayloadContratoRequest(method, path, status, gateway)) {
    return PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE;
  }
  return null;
};

const inferEmpresaCadastroScenario = ({
  operation = '',
  status = null,
  method = '',
  path = '',
  plugnotasCode = ''
} = {}) => {
  const operationNorm = String(operation || '').trim().toLowerCase();
  const code = String(plugnotasCode || '').trim();
  const methodNorm = String(method || '').trim().toUpperCase();
  const pathNorm = String(path || '').trim();
  const statusNum = Number.isFinite(Number(status)) ? Number(status) : null;

  if (code === PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE) return 'prefeitura_login_required_blocked';
  if (code === PREFEITURA_LOGIN_REQUIRED_FALLBACK_AVAILABLE_CODE) {
    return 'prefeitura_login_required_fallback_available';
  }
  if (code === PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_CODE) {
    return 'prefeitura_ibge_apenas_insuficiente_dp02';
  }
  if (code === PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE || isGatewayLikePlugnotasCode(code)) {
    return 'ambiente_configuracao';
  }
  if (operationNorm === 'updated' || operationNorm === 'existing') return 'fallback_sync';
  if (code === PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE) return 'payload_contrato';
  if (code === PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE) return 'empresa_nao_cadastrada';
  if (statusNum === 401 || statusNum === 403 || statusNum === 502 || statusNum === 503 || statusNum === 504) {
    return 'ambiente_configuracao';
  }
  if (isEmpresaPayloadContratoRequest(methodNorm, pathNorm, statusNum, null)) {
    return 'payload_contrato';
  }
  if (operationNorm === 'created') return 'success_nacional';
  return null;
};

const enrichEmpresaCadastroPreflightError = (error, preflightInput) => {
  const plugnotasCode = String(error?.errors?.plugnotasCode || '').trim();
  if (!plugnotasCode || error?.errors?.runtimeDecision) return error;

  if (
    plugnotasCode !== PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE
    && !isGatewayLikePlugnotasCode(plugnotasCode)
  ) {
    return error;
  }

  attachRuntimeDecisionToError(
    error,
    buildEmpresaCadastroRuntimeDecision({
      scenario: 'ambiente_configuracao',
      consultedMunicipio: true,
      codigoIbge: preflightInput.codigoIbge,
      environment: preflightInput.environment,
      upstreamCallSkipped: true
    })
  );

  return error;
};

/** Prioriza `process.env` em runtime (testes podem activar a flag sem recarregar `env.js`). */
const isPrefeituraCredenciaisEnabled = () => {
  const raw = process.env.PLUGNOTAS_NFSE_PREFEITURA_CREDENCIAIS_ENABLED
    ?? env.PLUGNOTAS_NFSE_PREFEITURA_CREDENCIAIS_ENABLED
    ?? '';
  return String(raw).trim().toLowerCase() === 'true';
};

/**
 * @param {string} operation
 * @param {'nacional' | 'municipal'} attemptNfseMode
 * @param {Record<string, unknown>|null|undefined} preflightRuntimeDecision
 */
const buildEmpresaCadastroSuccessRuntimeDecision = (operation, attemptNfseMode, preflightRuntimeDecision) => {
  const op = String(operation || '').trim().toLowerCase();
  const municipal = attemptNfseMode === 'municipal';
  let scenario = 'success_nacional';
  if (municipal) {
    scenario = op === 'created' ? 'success_municipal' : 'fallback_sync';
  } else if (op === 'updated' || op === 'existing') {
    scenario = 'fallback_sync';
  } else if (op === 'created') {
    scenario = 'success_nacional';
  }
  const base = preflightRuntimeDecision && typeof preflightRuntimeDecision === 'object'
    ? { ...preflightRuntimeDecision }
    : {};
  return buildEmpresaCadastroRuntimeDecision({
    ...base,
    scenario,
    attemptMode: attemptNfseMode,
    upstreamCallSkipped: false
  });
};

const runEmpresaCadastroMunicipioPreflight = async (
  payload,
  {
    operation = 'create',
    credState,
    attemptNfseMode = 'nacional'
  } = {}
) => {
  const preflightInput = resolveEmpresaCadastroMunicipioPreflightInput(payload, { operation });
  if (!preflightInput) return null;

  try {
    const preflight = await consultarCidadePlugNotas(preflightInput);
    const { allowUpstream, runtimeDecision } = resolveEmpresaCadastroMunicipioRuntimeDecision(
      preflight,
      {
        prefeituraCredentialsEnabled: isPrefeituraCredenciaisEnabled(),
        attemptNfseMode,
        credState
      }
    );

    if (!allowUpstream) {
      throw createEmpresaCadastroBlockedErrorFromDecision(runtimeDecision);
    }

    const municipalAuthRequired = Boolean(preflight.requiresLogin || preflight.requiresSenha);
    return { preflight, runtimeDecision, municipalAuthRequired };
  } catch (error) {
    throw enrichEmpresaCadastroPreflightError(error, preflightInput);
  }
};

const ensureConfigured = () => {
  if (!env.PLUGNOTAS_API_BASE_URL || !env.PLUGNOTAS_API_KEY) {
    throw badRequest(
      'PlugNotas não configurado. Defina PLUGNOTAS_API_BASE_URL e PLUGNOTAS_API_KEY no .env do backend, reinicie o servidor e reenvie o certificado .pfx.',
      { plugnotasCode: 'plugnotas_nao_configurado' },
    );
  }
};

const withTimeout = (ms) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
};

const parseResponsePayload = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    const text = await response.text();
    return text || null;
  } catch {
    return null;
  }
};

const requestJson = async (method, path, body) => {
  ensureConfigured();
  const timeoutMs = Number(env.PLUGNOTAS_TIMEOUT_MS || 15000);
  const { controller, timeout } = withTimeout(timeoutMs);
  const baseUrl = getPlugnotasRootUrl();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': env.PLUGNOTAS_API_KEY
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });

    const payload = await parseResponsePayload(response);
    if (!response.ok) {
      const rawMessage = messageFromPlugnotasPayload(payload, response.statusText);
      const gateway = resolvePlugnotasGatewayUpstreamForClient(response.status);
      const resolvedPlugnotasCode = resolveEmpresaPlugnotasErrorCode({
        method,
        path,
        status: response.status,
        gateway,
        rawMessage
      });
      const prefeituraLoginBlocked = resolvedPlugnotasCode === PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE;
      const message = prefeituraLoginBlocked
        ? PREFEITURA_LOGIN_REQUIRED_BLOCKED_MESSAGE
        : gateway
          ? gateway.publicMessage
          : rawMessage;
      const errors = {
        ...plugnotasRequestErrors(method, path, response.status),
        ...(resolvedPlugnotasCode ? { plugnotasCode: resolvedPlugnotasCode } : {})
      };
      const fullUrl = `${baseUrl}${path}`;
      if (
        response.status === 400
        && body
        && typeof body === 'object'
        && !Array.isArray(body)
        && isEmpresaCadastroPlugnotasPath(path)
      ) {
        logPlugnotasEmpresaCadastro400Request({ method, path, body });
        if (isPlugnotasIbgeTableRejectMessage(rawMessage)) {
          logPlugnotasEmpresaIbgeTable400({ method, path, body });
        }
      }
      if (process.env.NODE_ENV !== 'production' || isPlugnotasDebugExplicitlyEnabled()) {
        const pathLog = maskPlugnotasPathOrUrlForLog(path);
        const fullUrlLog = maskPlugnotasPathOrUrlForLog(fullUrl);
        const ct = response.headers.get('content-type') || '';
        const logBody = gateway
          ? `[gateway_upstream HTTP ${response.status}]`
          : summarizePlugnotasErrorLogBody(rawMessage, ct);
        // eslint-disable-next-line no-console
        console.error('[plugnotas]', method, pathLog, response.status, logBody, fullUrlLog);
      }
      if (response.status === 401) {
        throw new HttpError(
          401,
          message || 'Token do serviço de emissão fiscal inválido',
          errors
        );
      }
      if (response.status === 403) {
        throw new HttpError(
          403,
          message || 'Acesso negado pelo serviço de emissão fiscal',
          errors
        );
      }
      if (response.status === 404) {
        throw new HttpError(404, message || 'Empresa não encontrada', errors);
      }
      if (response.status === 409) {
        throw new HttpError(409, message || 'Empresa já cadastrada', errors);
      }
      throw new HttpError(
        response.status || 400,
        message || 'Erro no serviço de emissão fiscal',
        errors
      );
    }

    // Arrays (ex.: listagem GET /certificado) devem passar direto; só colapsamos
    // respostas que não são objeto (string/null) em { message }. Antes, o
    // Array.isArray descartava a listagem de certificados, quebrando a
    // recuperação do ID após 409 (cert duplicado entre usuários).
    if (!payload || typeof payload !== 'object') {
      return { message: toMessage(payload, null) };
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

const requestFormData = async (method, path, body) => {
  ensureConfigured();
  const timeoutMs = Number(env.PLUGNOTAS_TIMEOUT_MS || 15000);
  const { controller, timeout } = withTimeout(timeoutMs);
  const baseUrl = getPlugnotasRootUrl();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'x-api-key': env.PLUGNOTAS_API_KEY
      },
      body,
      signal: controller.signal
    });

    const payload = await parseResponsePayload(response);
    if (!response.ok) {
      const rawMessage = messageFromPlugnotasPayload(payload, response.statusText);
      const gateway = resolvePlugnotasGatewayUpstreamForClient(response.status);
      const message = gateway ? gateway.publicMessage : rawMessage;
      const errors = gateway
        ? { ...plugnotasRequestErrors(method, path, response.status), plugnotasCode: gateway.plugnotasCode }
        : plugnotasRequestErrors(method, path, response.status);
      const fullUrl = `${baseUrl}${path}`;
      if (process.env.NODE_ENV !== 'production' || isPlugnotasDebugExplicitlyEnabled()) {
        const pathLog = maskPlugnotasPathOrUrlForLog(path);
        const fullUrlLog = maskPlugnotasPathOrUrlForLog(fullUrl);
        const ct = response.headers.get('content-type') || '';
        const logBody = gateway
          ? `[gateway_upstream HTTP ${response.status}]`
          : summarizePlugnotasErrorLogBody(rawMessage, ct);
        // eslint-disable-next-line no-console
        console.error('[plugnotas]', method, pathLog, response.status, logBody, fullUrlLog);
      }
      if (response.status === 401) {
        throw new HttpError(
          401,
          message || 'Token do serviço de emissão fiscal inválido',
          errors
        );
      }
      if (response.status === 403) {
        throw new HttpError(
          403,
          message || 'Acesso negado pelo serviço de emissão fiscal',
          errors
        );
      }
      throw new HttpError(
        response.status || 400,
        message || 'Erro no serviço de emissão fiscal',
        errors
      );
    }

    // Arrays (ex.: listagem GET /certificado) devem passar direto; só colapsamos
    // respostas que não são objeto (string/null) em { message }. Antes, o
    // Array.isArray descartava a listagem de certificados, quebrando a
    // recuperação do ID após 409 (cert duplicado entre usuários).
    if (!payload || typeof payload !== 'object') {
      return { message: toMessage(payload, null) };
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

const isConflictLikeError = (error) => {
  const status = Number(error?.status || 0);
  if (status === 409) return true;
  const message = String(error?.message || '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('já cadastrada')
    || message.includes('ja cadastrada')
    || message.includes('already exists')
    || message.includes('empresa existente')
    || message.includes('empresa já existe')
    || message.includes('duplicate')
    || message.includes('duplicado')
    || message.includes('conflito')
  );
};

/** PATCH /empresa/:cnpj retorna 404 quando não há empresa para o token (mensagem típica do Plugnotas). */
const isEmpresaNaoLocalizadaPlugnotas404 = (error) => {
  const status = Number(error?.status ?? 0);
  if (status !== 404) return false;
  return isEmpresaNaoLocalizadaMessage(error?.message);
};

const MSG_EMPRESA_NAO_CADASTRADA_EMISSOR =
  'Não há cadastro desta empresa no emissor fiscal para o token e ambiente configurados. '
  + 'Cadastre primeiro na guia MEI: envie o certificado (.pfx) e os dados para gravar a empresa no emissor; '
  + 'só depois use "Atualizar cadastro (sem novo certificado)". '
  + 'Confira no painel do emissor se o CNPJ está na mesma conta e se a URL base da API e a chave '
  + 'configuradas no servidor são do mesmo ambiente (sandbox ou produção).';

/**
 * Plugnotas API pública: atualização de empresa é PATCH em /empresa/:cnpj.
 * PUT em /empresa ou /empresa/:cnpj retorna 404 "Esta rota não existe no serviço".
 */
const buildUpdateAttempts = (cnpj, payload) => {
  const safeCnpj = encodeURIComponent(cnpj);
  return [{ method: 'PATCH', path: `/empresa/${safeCnpj}`, body: payload }];
};

const tryUpdateEmpresa = async (cnpj, payload) => {
  const attempts = buildUpdateAttempts(cnpj, payload);
  let lastError = null;
  /** @type {{ method: string, path: string, status: number|null, message: string }[]} */
  const failures = [];

  for (const attempt of attempts) {
    try {
      const response = await requestJson(attempt.method, attempt.path, attempt.body);
      return { response, attempt, lastError: null, failures: [] };
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        throw error;
      }
      lastError = error;
      const status = typeof error?.status === 'number' ? error.status : null;
      const message = error instanceof Error ? error.message : String(error || '');
      failures.push({
        method: attempt.method,
        path: attempt.path,
        status,
        message
      });
    }
  }

  return { response: null, attempt: null, lastError, failures };
};

/** POST /certificado retorna 409 quando o .pfx já foi cadastrado na conta. */
const isCertificadoDuplicado409 = (error) => {
  if (Number(error?.status) !== 409) return false;
  const m = String(error?.message || '').toLowerCase();
  return m.includes('certificado') && (m.includes('já existe') || m.includes('ja existe') || m.includes('parâmetros'));
};

const extractCertificadoIdFromEmpresaPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const root = toObject(payload);
  const data = toObject(payload?.data);
  const nestedCert = typeof data.certificado === 'object' && data.certificado !== null
    ? data.certificado
    : null;
  const nestedIdCert = typeof data.idCertificado === 'object' && data.idCertificado !== null
    ? data.idCertificado
    : null;

  const candidates = [
    typeof data.certificado === 'string' ? normalizeCertificadoIdCandidate(data.certificado) : null,
    nestedCert ? normalizeCertificadoIdCandidate(nestedCert.id) : null,
    nestedCert ? normalizeCertificadoIdCandidate(nestedCert._id) : null,
    normalizeCertificadoIdCandidate(data.idCertificado),
    normalizeCertificadoIdCandidate(data.certificadoId),
    nestedIdCert ? normalizeCertificadoIdCandidate(nestedIdCert.id) : null,
    nestedIdCert ? normalizeCertificadoIdCandidate(nestedIdCert._id) : null,
    typeof root.certificado === 'string' ? normalizeCertificadoIdCandidate(root.certificado) : null
  ];
  for (const c of candidates) {
    if (c) return c;
  }
  return null;
};

/**
 * Resolve o ID do certificado existente no PlugNotas por CNPJ.
 * Tenta GET /empresa/{cnpj} e GET /certificado?cpfCnpj=... + GET /certificado.
 * Usado após 409 no POST /certificado E como fallback quando o ID não está salvo localmente.
 * Logs estruturados por etapa: US-MEI-FISC-04 (`PLUGNOTAS_CERT_409_RESOLVE_LOG_LEVEL`).
 * @param {string|undefined} cpfCnpjInput
 * @returns {Promise<string|null>}
 */
export const resolverCertificadoIdPorCnpj = async (cpfCnpjInput) => {
  const cnpj = normalizeDoc(cpfCnpjInput || '');
  if (cnpj.length !== 14) return null;

  try {
    const emp = await requestJson('GET', `/empresa/${encodeURIComponent(cnpj)}`);
    const fromEmp = extractCertificadoIdFromEmpresaPayload(emp);
    if (fromEmp) return fromEmp;
    logPlugnotasCertificado409Resolve({
      step: PLUGNOTAS_CERT_409_RESOLVE_STEPS.EMPRESA_GET,
      cpfCnpj14: cnpj,
      outcome: 'no_certificado_id_in_payload'
    });
  } catch (err) {
    if (err?.status !== 404 && err?.status !== 400) throw err;
    logPlugnotasCertificado409Resolve({
      step: PLUGNOTAS_CERT_409_RESOLVE_STEPS.EMPRESA_GET,
      cpfCnpj14: cnpj,
      outcome: 'http_error',
      httpStatus: err.status
    });
  }

  try {
    const filtered = await requestJson(
      'GET',
      `/certificado?cpfCnpj=${encodeURIComponent(cnpj)}`
    );
    const fromFiltered = extrairCertificadoIdDeListagem(filtered, cnpj);
    if (fromFiltered) return fromFiltered;
    const itemsFiltered = normalizeCertificadoListItems(filtered);
    logPlugnotasCertificado409Resolve({
      step: PLUGNOTAS_CERT_409_RESOLVE_STEPS.CERTIFICADO_FILTRO,
      cpfCnpj14: cnpj,
      outcome: 'no_id_resolved',
      listItemCount: itemsFiltered.length
    });
  } catch (err) {
    if (err?.status !== 404 && err?.status !== 400) throw err;
    logPlugnotasCertificado409Resolve({
      step: PLUGNOTAS_CERT_409_RESOLVE_STEPS.CERTIFICADO_FILTRO,
      cpfCnpj14: cnpj,
      outcome: 'http_error',
      httpStatus: err.status
    });
  }

  try {
    const list = await requestJson('GET', '/certificado');
    const fromList = extrairCertificadoIdDeListagem(list, cnpj);
    if (fromList) return fromList;
    const items = normalizeCertificadoListItems(list);
    const first = items[0] && typeof items[0] === 'object' ? items[0] : null;
    logPlugnotasCertificado409Resolve({
      step: PLUGNOTAS_CERT_409_RESOLVE_STEPS.PARSE_LISTAGEM,
      cpfCnpj14: cnpj,
      outcome: 'no_id_resolved',
      listItemCount: items.length,
      ...(first ? { firstItemKeysCount: Object.keys(first).length } : {})
    });
  } catch (err) {
    if (err?.status === 404) {
      logPlugnotasCertificado409Resolve({
        step: PLUGNOTAS_CERT_409_RESOLVE_STEPS.CERTIFICADO_LISTA,
        cpfCnpj14: cnpj,
        outcome: 'http_error',
        httpStatus: 404
      });
      return null;
    }
    throw err;
  }

  return null;
};

/**
 * Exclui um certificado no PlugNotas por ID (DELETE /certificado/:id).
 * Best-effort do ponto de vista do chamador — aqui propaga erro (404/5xx) para
 * quem chamar decidir tratar como não-fatal.
 * @param {string} certId
 */
export const excluirCertificadoPlugNotas = async (certId) => {
  const id = String(certId || '').trim();
  if (!id) {
    throw badRequest('ID do certificado é obrigatório para exclusão');
  }
  return requestJson('DELETE', `/certificado/${encodeURIComponent(id)}`);
};

/**
 * Após POST /certificado, a Plugnotas pode criar/vincular a empresa só com Simples Nacional,
 * deixando `regimeTributarioEspecial` vazio. Garante MEI (especial 5) via PATCH best-effort.
 * @param {string|undefined} cpfCnpjInput
 * @param {string|null|undefined} certificadoId
 */
export const ensureMeiRegimeEspecialPlugnotasEmpresa = async (cpfCnpjInput, certificadoId) => {
  const cnpj = normalizeDoc(cpfCnpjInput || '');
  if (cnpj.length !== 14) {
    return { ok: false, patched: false, reason: 'invalid_cnpj' };
  }

  let empresaRaw;
  try {
    empresaRaw = await requestJson('GET', `/empresa/${encodeURIComponent(cnpj)}`);
  } catch (err) {
    if (err?.status === 404) {
      return { ok: false, patched: false, reason: 'empresa_not_found' };
    }
    throw err;
  }

  const empresa = unwrapPlugnotasEmpresaRecord(empresaRaw) || {};
  const especial = Number(empresa.regimeTributarioEspecial);
  if (especial === PLUGNOTAS_REGIME_ESPECIAL_MEI) {
    return { ok: true, patched: false, reason: 'already_mei' };
  }

  const payload = buildMeiRegimePatchPayload(cnpj, certificadoId);
  const updateResult = await tryUpdateEmpresa(cnpj, payload);
  if (updateResult.response) {
    return { ok: true, patched: true, reason: 'patched' };
  }

  const errorMessage = updateResult.lastError instanceof Error
    ? updateResult.lastError.message
    : String(updateResult.lastError || '');
  return { ok: false, patched: false, reason: 'patch_failed', error: errorMessage };
};

const attachMeiRegimeAfterCertificado = async (result, cpfCnpj) => {
  const cnpj = normalizeDoc(cpfCnpj || '');
  const id = result?.id;
  if (!id || cnpj.length !== 14) return result;

  try {
    const regimeResult = await ensureMeiRegimeEspecialPlugnotasEmpresa(cnpj, id);
    if (!regimeResult.ok && regimeResult.reason !== 'empresa_not_found') {
      console.warn('[plugnotas] regime MEI não aplicado após certificado', {
        cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
        reason: regimeResult.reason,
        error: regimeResult.error
      });
    }
  } catch (err) {
    console.warn('[plugnotas] falha ao garantir regime MEI após certificado', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      error: err instanceof Error ? err.message : String(err)
    });
  }

  return result;
};

export const cadastrarCertificadoPlugNotas = async ({
  fileBuffer,
  fileName,
  mimeType,
  password,
  email,
  cpfCnpj
}) => {
  if (!fileBuffer) {
    throw badRequest('Arquivo do certificado é obrigatório');
  }
  if (!password) {
    throw badRequest('Senha do certificado é obrigatória');
  }

  if (cpfCnpj) {
    await assertMeiCertificateEligible(normalizeDoc(cpfCnpj));
  }

  const formData = new FormData();
  const blob = new Blob([fileBuffer], {
    type: mimeType || 'application/x-pkcs12'
  });
  formData.append('arquivo', blob, fileName || 'certificado.pfx');
  formData.append('senha', String(password));
  if (email) {
    formData.append('email', String(email));
  }

  try {
    const response = await requestFormData('POST', '/certificado', formData);
    const data = toObject(response?.data);

    return attachMeiRegimeAfterCertificado({
      id: typeof data.id === 'string' ? data.id : null,
      message: typeof response?.message === 'string' ? response.message : null,
      raw: response
    }, cpfCnpj);
  } catch (error) {
    if (!isCertificadoDuplicado409(error)) {
      throw error;
    }
    const resolved = await resolverCertificadoIdPorCnpj(cpfCnpj);
    if (resolved) {
      return attachMeiRegimeAfterCertificado({
        id: resolved,
        message: 'Certificado já existente no emissor fiscal; ID recuperado para continuar o cadastro da empresa.',
        raw: {
          recoveredFrom409: true,
          conflictMessage: error instanceof Error ? error.message : String(error)
        }
      }, cpfCnpj);
    }
    throw badRequest(
      'O certificado já está cadastrado no emissor fiscal, mas não foi possível obter o ID automaticamente. '
      + 'Confirme o CNPJ no formulário, verifique no painel do emissor se o certificado aparece nesta conta '
      + 'e se a URL base da API e a chave configuradas no servidor são do mesmo ambiente.',
      { plugnotasCode: 'certificado_409_sem_id' }
    );
  }
};

/**
 * Consulta cadastro da empresa no provedor de emissão pelo CNPJ (somente dígitos após normalização).
 * @param {string} cnpjInput
 * @returns {Promise<Record<string, unknown>>}
 */
export const consultarEmpresaPlugNotas = async (cnpjInput) => {
  const cnpj = normalizeDoc(cnpjInput || '');
  if (cnpj.length !== 14) {
    throw badRequest('CNPJ da empresa deve ter 14 dígitos');
  }
  try {
    return await requestJson('GET', `/empresa/${encodeURIComponent(cnpj)}`);
  } catch (err) {
    if (
      err instanceof HttpError
      && err.status === 404
      && inferEmpresaCadastroScenario({
        status: err.status,
        method: err.errors?.plugnotasRequest?.method,
        path: err.errors?.plugnotasRequest?.path,
        plugnotasCode: err.errors?.plugnotasCode
      }) === 'empresa_nao_cadastrada'
    ) {
      throw new HttpError(
        404,
        MSG_EMPRESA_NAO_CADASTRADA_EMISSOR,
        {
          ...err.errors,
          plugnotasCode: PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE
        }
      );
    }
    throw err;
  }
};

/**
 * Atualiza cadastro da empresa no provedor via PATCH /empresa/:cnpj, sem exigir reenvio de certificado.
 * Útil quando a empresa e o certificado já existem no provedor e só os dados cadastrais mudam.
 * @param {Record<string, unknown>} input
 */
export const atualizarEmpresaPlugNotas = async (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('Payload da empresa é obrigatório e deve ser um objeto');
  }

  const payload = { ...input };
  const cnpj = normalizeDoc(payload?.cpfCnpj || payload?.cnpj || '');
  if (cnpj.length !== 14) {
    throw badRequest('CNPJ da empresa deve ter 14 dígitos');
  }

  payload.cpfCnpj = cnpj;
  delete payload.cnpj;

  normalizeMeiEmpresaPayload(payload);

  const nfseBlock = payload.nfse;
  const nfseAtivo = nfseBlock && typeof nfseBlock === 'object' && !Array.isArray(nfseBlock)
    && nfseBlock.ativo !== false;

  if (!hasClientRpsShape(payload.rps) && nfseAtivo) {
    payload.rps = cloneEmpresaPlugnotasRpsInicialPost();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'rps')) {
    sanitizeEmpresaPlugnotasRpsPayload(payload);
  }

  if (nfseAtivo && !hasNfseConfigRpsShape({ nfse: payload.nfse })) {
    applyEmpresaPlugnotasNfseConfigRps(payload);
  }

  const credState = extractPrefeituraPortalCredentialState(payload);
  const attemptNfseMode = resolveAttemptNfseModeFromPayload(payload);
  assertNoAmbiguousNationalWithPrefeituraCredentials(payload, credState);

  if (credState.hasPartialKeys) {
    throw badRequest('Informe login e senha do portal da prefeitura em conjunto (paridade obrigatória).', {
      plugnotasCode: PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE,
      runtimeDecision: buildEmpresaCadastroRuntimeDecision({
        scenario: 'payload_contrato',
        consultedMunicipio: false,
        upstreamCallSkipped: true,
        attemptMode: attemptNfseMode
      })
    });
  }

  const nfseContractInput = inspectNfseContractInput(input?.nfse);

  const cert = payload.certificado;
  if (cert === undefined || cert === null || String(cert).trim() === '') {
    delete payload.certificado;
  }

  const docPatch = resolveDocumentosAtivosForPatch(payload);
  stripDocumentosAtivos(payload);
  if (docPatch.present && docPatch.selection) {
    applyEmpresaPlugnotasDocumentSelectionForPatch(
      payload,
      docPatch.selection,
      { nfseMode: attemptNfseMode }
    );
  } else {
    applyEmpresaPlugnotasApenasNfseForPatch(payload);
  }
  // Sempre garante IE (ISENTO) — NF-e/NFC-e ativos rejeitam omissão do campo
  normalizeInscricaoEstadualApenasNfse(payload);

  normalizePayloadEnderecoCodigoCidade(payload);
  if (!(docPatch.present && docPatch.selection)) {
    applyNfseNationalContractPolicy(payload);
  }

  const preflightContext = await runEmpresaCadastroMunicipioPreflight(payload, {
    operation: 'update',
    credState,
    attemptNfseMode
  });
  if (!preflightContext && nfseContractInput.usesLegacyOnlyNationalInput) {
    applyNfsePrefeituraIbgeIfEnabled(payload);
    applyPrefeituraIbgeOnlyBlockPolicy(payload);
  }

  applyPrefeituraPortalCredentialsPolicy(payload, {
    prefeituraCredentialsEnabled: isPrefeituraCredenciaisEnabled(),
    municipalAuthRequired: preflightContext?.municipalAuthRequired ?? false,
    attemptNfseMode,
    credState
  });

  const updateResult = await tryUpdateEmpresa(cnpj, payload);
  if (updateResult.response) {
    const data = toObject(updateResult.response?.data);
    const fallbackMessage = `Empresa atualizada no serviço de emissão (${updateResult.attempt.method} ${updateResult.attempt.path}).`;
    return {
      cnpj: typeof data.cnpj === 'string' ? data.cnpj : cnpj,
      message: typeof updateResult.response?.message === 'string'
        ? updateResult.response.message
        : fallbackMessage,
      operation: 'updated',
      raw: sanitizePlugnotasEmpresaJsonForClientResponse(updateResult.response),
      runtimeDecision: buildEmpresaCadastroSuccessRuntimeDecision(
        'updated',
        attemptNfseMode,
        preflightContext?.runtimeDecision
      )
    };
  }

  const err = updateResult.lastError;
  if (err && typeof err === 'object' && err.status === 401) throw err;
  if (err && typeof err === 'object' && err.status === 403) throw err;
  const failures = Array.isArray(updateResult.failures) ? updateResult.failures : [];
  if (isEmpresaNaoLocalizadaPlugnotas404(err)) {
    throw badRequest(MSG_EMPRESA_NAO_CADASTRADA_EMISSOR, {
      plugnotasUpdateAttempts: failures,
      plugnotasCode: PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE
    });
  }
  const msg = err instanceof Error
    ? err.message
    : String(err || 'Não foi possível atualizar a empresa no serviço de emissão fiscal');
  throw badRequest(msg, { plugnotasUpdateAttempts: failures });
};

export const cadastrarEmpresaPlugNotas = async (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('Payload da empresa é obrigatório e deve ser um objeto');
  }

  const payload = { ...input };
  const cnpj = normalizeDoc(payload?.cpfCnpj || payload?.cnpj || '');
  if (cnpj.length !== 14) {
    throw badRequest('CNPJ da empresa deve ter 14 dígitos');
  }
  if (!payload?.certificado) {
    throw badRequest(
      'Certificado digital não localizado no PlugNotas. Envie o arquivo .pfx em "Certificado fiscal" antes de cadastrar a empresa.',
      { plugnotasCode: 'certificado_nao_configurado' }
    );
  }

  payload.cpfCnpj = cnpj;
  delete payload.cnpj;

  normalizeMeiEmpresaPayload(payload);

  const credState = extractPrefeituraPortalCredentialState(payload);
  const attemptNfseMode = resolveAttemptNfseModeFromPayload(payload);
  assertNoAmbiguousNationalWithPrefeituraCredentials(payload, credState);

  if (credState.hasPartialKeys) {
    throw badRequest('Informe login e senha do portal da prefeitura em conjunto (paridade obrigatória).', {
      plugnotasCode: PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE,
      runtimeDecision: buildEmpresaCadastroRuntimeDecision({
        scenario: 'payload_contrato',
        consultedMunicipio: false,
        upstreamCallSkipped: true,
        attemptMode: attemptNfseMode
      })
    });
  }

  const nfseContractInput = inspectNfseContractInput(input?.nfse);

  const docPost = resolveDocumentosAtivosForPost(payload);
  stripDocumentosAtivos(payload);
  applyEmpresaPlugnotasDocumentSelectionForPost(payload, docPost.selection, { nfseMode: attemptNfseMode });

  normalizePayloadEnderecoCodigoCidade(payload);

  const preflightContext = await runEmpresaCadastroMunicipioPreflight(payload, {
    operation: 'create',
    credState,
    attemptNfseMode
  });
  if (!preflightContext && nfseContractInput.usesLegacyOnlyNationalInput) {
    applyNfsePrefeituraIbgeIfEnabled(payload);
    applyPrefeituraIbgeOnlyBlockPolicy(payload);
  }

  applyPrefeituraPortalCredentialsPolicy(payload, {
    prefeituraCredentialsEnabled: isPrefeituraCredenciaisEnabled(),
    municipalAuthRequired: preflightContext?.municipalAuthRequired ?? false,
    attemptNfseMode,
    credState
  });

  applyEmpresaPlugnotasRpsInicialForPost(payload);

  try {
    const response = await requestJson('POST', '/empresa', payload);
    const data = toObject(response?.data);
    return {
      cnpj: typeof data.cnpj === 'string' ? data.cnpj : cnpj,
      message: typeof response?.message === 'string' ? response.message : 'Empresa cadastrada no serviço de emissão fiscal.',
      operation: 'created',
      raw: sanitizePlugnotasEmpresaJsonForClientResponse(response),
      runtimeDecision: buildEmpresaCadastroSuccessRuntimeDecision(
        'created',
        attemptNfseMode,
        preflightContext?.runtimeDecision
      )
    };
  } catch (createError) {
    if (!isConflictLikeError(createError)) {
      throw createError;
    }

    stripRpsFromEmpresaPayload(payload);
    const updateResult = await tryUpdateEmpresa(cnpj, payload);
    if (updateResult.response) {
      const data = toObject(updateResult.response?.data);
      const fallbackMessage = `Empresa atualizada no serviço de emissão (${updateResult.attempt.method} ${updateResult.attempt.path}).`;
      return {
        cnpj: typeof data.cnpj === 'string' ? data.cnpj : cnpj,
        message: typeof updateResult.response?.message === 'string'
          ? updateResult.response.message
          : fallbackMessage,
        operation: 'updated',
        raw: sanitizePlugnotasEmpresaJsonForClientResponse(updateResult.response),
        runtimeDecision: buildEmpresaCadastroSuccessRuntimeDecision(
          'updated',
          attemptNfseMode,
          preflightContext?.runtimeDecision
        )
      };
    }

    return {
      cnpj,
      message: 'Empresa já cadastrada no serviço de emissão. Atualização automática não confirmada, mas o fluxo seguirá como sucesso operacional.',
      operation: 'existing',
      raw: {
        status: 'existing_without_update',
        conflictMessage: createError instanceof Error ? createError.message : String(createError || ''),
        updateMessage: updateResult.lastError instanceof Error
          ? updateResult.lastError.message
          : String(updateResult.lastError || ''),
        attemptedEndpoints: buildUpdateAttempts(cnpj, payload)
          .map((attempt) => `${attempt.method} ${attempt.path}`)
      },
      runtimeDecision: buildEmpresaCadastroSuccessRuntimeDecision(
        'existing',
        attemptNfseMode,
        preflightContext?.runtimeDecision
      )
    };
  }
};

export {
  inferEmpresaCadastroScenario,
  PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE,
  PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE,
  PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE
};
