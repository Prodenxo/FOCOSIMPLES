/**
 * Credenciais do portal da prefeitura em `nfse.config.prefeitura` — validação condicionada
 * (national-first + retry municipal guiado). Ver arquitetura §8.2.
 */

import { badRequest } from '../../utils/errors.js';

export const PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE = 'prefeitura_login_required_blocked';
export const PREFEITURA_LOGIN_REQUIRED_BLOCKED_MESSAGE =
  'Este fluxo usa NFS-e Nacional como padrão e não aceita credenciais do portal da prefeitura. '
  + 'Quando o emissor exigir login municipal, o caso deve ser tratado fora deste percurso.';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export const isPrefeituraLoginRequiredUpstreamMessage = (message) => {
  const text = String(message || '').toLowerCase();
  if (!text) return false;
  const mentionsField = (
    text.includes('fields.nfse.config.prefeitura.login')
    || text.includes('fields.nfse.config.prefeitura.senha')
    || text.includes('nfse.config.prefeitura.login')
    || text.includes('nfse.config.prefeitura.senha')
  );
  const mentionsRequired = (
    text.includes('obrigat')
    || text.includes('required')
    || text.includes('preenchimento obrigatório')
  );
  return mentionsField && mentionsRequired;
};

/**
 * Estado das chaves `login` / `senha` em `nfse.config.prefeitura` (antes da política condicionada).
 * @param {Record<string, unknown>} payload
 */
export const extractPrefeituraPortalCredentialState = (payload) => {
  const empty = {
    hasLoginKey: false,
    hasSenhaKey: false,
    hasPartialKeys: false,
    hasNonEmptyCredentialPair: false,
    hasAnyPrefeituraCredentialKey: false
  };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return empty;

  const nfse = payload.nfse;
  if (!nfse || typeof nfse !== 'object' || Array.isArray(nfse)) return empty;

  const config = nfse.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return empty;

  const prefeitura = config.prefeitura;
  if (prefeitura === undefined || prefeitura === null) return empty;
  if (typeof prefeitura !== 'object' || Array.isArray(prefeitura)) return empty;

  const hasLoginKey = hasOwn(prefeitura, 'login');
  const hasSenhaKey = hasOwn(prefeitura, 'senha');
  const hasAnyPrefeituraCredentialKey = hasLoginKey || hasSenhaKey;

  const loginRaw = hasLoginKey ? prefeitura.login : undefined;
  const senhaRaw = hasSenhaKey ? prefeitura.senha : undefined;
  const loginTrim = loginRaw != null ? String(loginRaw).trim() : '';
  const senhaTrim = senhaRaw != null ? String(senhaRaw).trim() : '';

  const onlyOneKey = (hasLoginKey && !hasSenhaKey) || (!hasLoginKey && hasSenhaKey);
  const bothKeys = hasLoginKey && hasSenhaKey;
  const partialKeys = onlyOneKey
    || (bothKeys && ((loginTrim && !senhaTrim) || (!loginTrim && senhaTrim)));

  const hasNonEmptyCredentialPair = Boolean(bothKeys && loginTrim && senhaTrim);

  return {
    hasLoginKey,
    hasSenhaKey,
    hasPartialKeys: Boolean(partialKeys),
    hasNonEmptyCredentialPair,
    hasAnyPrefeituraCredentialKey
  };
};

/**
 * @param {Record<string, unknown>} payload
 * @returns {'nacional' | 'municipal'}
 */
export const resolveAttemptNfseModeFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'nacional';
  const nfse = payload.nfse;
  if (!nfse || typeof nfse !== 'object' || Array.isArray(nfse)) return 'nacional';
  const config = nfse.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return 'nacional';
  if (config.nfseNacional === false) return 'municipal';
  return 'nacional';
};

/**
 * CR-ALNFB-05 — não combinar `nfseNacional=true` com credenciais municipais no mesmo payload.
 * @param {Record<string, unknown>} payload
 * @param {ReturnType<typeof extractPrefeituraPortalCredentialState>} credState
 */
export const assertNoAmbiguousNationalWithPrefeituraCredentials = (payload, credState) => {
  if (!credState?.hasNonEmptyCredentialPair) return;
  const nfse = payload?.nfse;
  const config = nfse && typeof nfse === 'object' && !Array.isArray(nfse) ? nfse.config : null;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return;
  if (config.nfseNacional === true || config.consultaNfseNacional === true) {
    throw badRequest(
      'Não combine modo NFS-e Nacional com credenciais do portal da prefeitura no mesmo envio.',
      { plugnotasCode: 'payload_contrato' }
    );
  }
};

/**
 * Validação e redaction condicionada (FR-ALNFB-06/07).
 *
 * @param {Record<string, unknown>} payload — mutado in-place (trim login/senha no trilho municipal válido)
 * @param {{
 *   prefeituraCredentialsEnabled: boolean,
 *   municipalAuthRequired: boolean,
 *   attemptNfseMode: 'nacional' | 'municipal',
 *   credState: ReturnType<typeof extractPrefeituraPortalCredentialState>
 * }} [ctxIn] — omitir para comportamento legado (bloqueio credenciais fora do trilho municipal)
 */
export function applyPrefeituraPortalCredentialsPolicy(payload, ctxIn) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;

  const credState = ctxIn?.credState ?? extractPrefeituraPortalCredentialState(payload);
  const prefeituraCredentialsEnabled = ctxIn?.prefeituraCredentialsEnabled ?? false;
  const municipalAuthRequired = ctxIn?.municipalAuthRequired ?? false;
  const attemptNfseMode = ctxIn?.attemptNfseMode ?? 'nacional';

  const nfse = payload.nfse;
  if (!nfse || typeof nfse !== 'object' || Array.isArray(nfse)) return;

  const config = nfse.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return;

  const prefeitura = config.prefeitura;
  if (prefeitura === undefined || prefeitura === null) return;
  if (typeof prefeitura !== 'object' || Array.isArray(prefeitura)) return;

  const hasLoginKey = hasOwn(prefeitura, 'login');
  const hasSenhaKey = hasOwn(prefeitura, 'senha');
  if (!hasLoginKey && !hasSenhaKey) return;

  if (credState?.hasPartialKeys) {
    throw badRequest('Informe login e senha do portal da prefeitura em conjunto (paridade obrigatória).', {
      plugnotasCode: 'payload_contrato'
    });
  }

  const allowMunicipalCreds = Boolean(
    prefeituraCredentialsEnabled
    && municipalAuthRequired
    && attemptNfseMode === 'municipal'
    && credState?.hasNonEmptyCredentialPair
  );

  if (!allowMunicipalCreds) {
    throw badRequest(PREFEITURA_LOGIN_REQUIRED_BLOCKED_MESSAGE, {
      plugnotasCode: PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE
    });
  }

  prefeitura.login = String(prefeitura.login ?? '').trim();
  prefeitura.senha = String(prefeitura.senha ?? '').trim();
  if (!prefeitura.login || !prefeitura.senha) {
    throw badRequest('Login e senha do portal da prefeitura não podem ser vazios.', {
      plugnotasCode: 'payload_contrato'
    });
  }
}

const deepClonePlainJson = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
  } catch {
    /* continua */
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

/**
 * Remove `login` / `senha` de qualquer objeto `prefeitura` na árvore (resposta PlugNotas pode espelhar o envio).
 * NFR-ALNFB-01 — credenciais municipais não regressam ao cliente em `raw`.
 * @param {unknown} payload
 */
const stripPrefeituraSecretsInTree = (payload) => {
  if (payload === null || payload === undefined) return;
  if (Array.isArray(payload)) {
    for (const item of payload) stripPrefeituraSecretsInTree(item);
    return;
  }
  if (typeof payload !== 'object') return;

  if (hasOwn(payload, 'prefeitura') && payload.prefeitura && typeof payload.prefeitura === 'object' && !Array.isArray(payload.prefeitura)) {
    const p = payload.prefeitura;
    if (hasOwn(p, 'login')) delete p.login;
    if (hasOwn(p, 'senha')) delete p.senha;
  }

  for (const key of Object.keys(payload)) {
    if (key === 'prefeitura') continue;
    const child = payload[key];
    if (child && typeof child === 'object') stripPrefeituraSecretsInTree(child);
  }
};

/**
 * @param {unknown} payload — típico corpo JSON de GET/POST/PATCH empresa PlugNotas devolvido ao BFF
 * @returns {unknown}
 */
export const sanitizePlugnotasEmpresaJsonForClientResponse = (payload) => {
  if (payload === null || payload === undefined) return payload;
  const clone = deepClonePlainJson(payload);
  stripPrefeituraSecretsInTree(clone);
  return clone;
};
