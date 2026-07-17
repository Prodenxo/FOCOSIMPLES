import { badRequest } from '../../utils/errors.js';
import { normalizeIbgeMunicipioCodigo } from '../../utils/ibge-municipio-codigo.js';
import {
  PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE,
  PREFEITURA_LOGIN_REQUIRED_BLOCKED_MESSAGE
} from './prefeituraPortalCredentials.js';
import {
  PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_CODE,
  PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_MESSAGE
} from './prefeituraIbgeOnlyBlock.js';

export const PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE = 'payload_contrato';
export const PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE = 'ambiente_configuracao';
export const PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE = 'empresa_nao_cadastrada';

/** DP-ALNFB — segundo passo municipal disponível (UI abre credenciais). */
export const PREFEITURA_LOGIN_REQUIRED_FALLBACK_AVAILABLE_CODE =
  'prefeitura_login_required_fallback_available';
export const PREFEITURA_LOGIN_REQUIRED_FALLBACK_AVAILABLE_MESSAGE =
  'Este município exige autenticação no portal da prefeitura para emissão. '
  + 'Informe login e senha do portal para continuar com o cadastro municipal.';

export const EMPRESA_CADASTRO_RUNTIME_PAYLOAD_CONTRATO_MESSAGE =
  'Informe um código IBGE válido do município em `endereco.codigoCidade` antes de enviar o cadastro da empresa ao emissor fiscal.';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const isNfseActive = (payload) => {
  const nfse = toObject(payload?.nfse);
  if (!Object.keys(nfse).length) return false;
  return nfse.ativo !== false;
};

const buildRuntimeDecisionFromPreflight = (
  scenario,
  preflight,
  upstreamCallSkipped = false,
  extra = {}
) => ({
  scenario,
  consultedMunicipio: true,
  codigoIbge: preflight.codigoIbge,
  environment: preflight.environment,
  padraoNacionalEnabled: preflight.padraoNacionalEnabled,
  requiresLogin: preflight.requiresLogin,
  requiresSenha: preflight.requiresSenha,
  upstreamCallSkipped,
  ...extra
});

export const buildEmpresaCadastroRuntimeDecision = ({
  scenario,
  consultedMunicipio = false,
  codigoIbge,
  environment,
  padraoNacionalEnabled,
  requiresLogin,
  requiresSenha,
  upstreamCallSkipped = false,
  attemptMode
}) => ({
  scenario,
  consultedMunicipio,
  ...(codigoIbge ? { codigoIbge } : {}),
  ...(environment ? { environment } : {}),
  ...(padraoNacionalEnabled !== undefined ? { padraoNacionalEnabled } : {}),
  ...(requiresLogin !== undefined ? { requiresLogin } : {}),
  ...(requiresSenha !== undefined ? { requiresSenha } : {}),
  upstreamCallSkipped,
  ...(attemptMode ? { attemptMode } : {})
});

export const attachRuntimeDecisionToError = (error, runtimeDecision) => {
  if (!error || typeof error !== 'object' || !runtimeDecision) return error;
  const baseErrors =
    error.errors && typeof error.errors === 'object' && !Array.isArray(error.errors)
      ? error.errors
      : {};
  error.errors = { ...baseErrors, runtimeDecision };
  return error;
};

export const resolveEmpresaCadastroTargetEnvironment = (payload) => {
  const nfse = toObject(payload?.nfse);
  const config = toObject(nfse.config);
  return config.producao === false ? 'homologacao' : 'producao';
};

/**
 * POST sempre exige triagem municipal quando `nfse` está ativo.
 * PATCH só exige quando o payload traz o bloco `endereco`, preservando updates parciais legados.
 */
export const resolveEmpresaCadastroMunicipioPreflightInput = (
  payload,
  { operation = 'create' } = {}
) => {
  if (!isNfseActive(payload)) return null;

  const operationNorm = String(operation || '').trim().toLowerCase();
  if (operationNorm === 'update' && !hasOwn(payload || {}, 'endereco')) {
    return null;
  }

  const endereco = toObject(payload?.endereco);
  const codigoIbge = normalizeIbgeMunicipioCodigo(endereco.codigoCidade);
  if (codigoIbge.length !== 7) {
    throw badRequest(EMPRESA_CADASTRO_RUNTIME_PAYLOAD_CONTRATO_MESSAGE, {
      plugnotasCode: PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE,
      runtimeDecision: buildEmpresaCadastroRuntimeDecision({
        scenario: 'payload_contrato',
        consultedMunicipio: false,
        upstreamCallSkipped: true
      })
    });
  }

  return {
    codigoIbge,
    environment: resolveEmpresaCadastroTargetEnvironment(payload)
  };
};

/**
 * Matriz arquitetura §7.2 — pré-upstream (sem chamada PlugNotas).
 * @param {Record<string, unknown>} preflight
 * @param {{
 *   prefeituraCredentialsEnabled?: boolean,
 *   attemptNfseMode?: 'nacional' | 'municipal',
 *   credState?: { hasPartialKeys: boolean, hasNonEmptyCredentialPair: boolean, hasAnyPrefeituraCredentialKey: boolean }
 * }} [governance]
 * @returns {{ allowUpstream: boolean, runtimeDecision: Record<string, unknown> }}
 */
export const resolveEmpresaCadastroMunicipioRuntimeDecision = (preflight, governance = {}) => {
  if (!preflight || typeof preflight !== 'object') {
    return {
      allowUpstream: false,
      runtimeDecision: buildEmpresaCadastroRuntimeDecision({
        scenario: 'ambiente_configuracao',
        consultedMunicipio: false,
        upstreamCallSkipped: true
      })
    };
  }

  const {
    prefeituraCredentialsEnabled = false,
    attemptNfseMode = 'nacional',
    credState = null
  } = governance;

  const hasPartial = Boolean(credState?.hasPartialKeys);
  const hasValidPair = Boolean(credState?.hasNonEmptyCredentialPair);
  const hasAnyPrefeituraKey = Boolean(credState?.hasAnyPrefeituraCredentialKey);

  const authRequired = Boolean(preflight.requiresLogin || preflight.requiresSenha);
  const natOk = preflight.padraoNacionalEnabled === true;

  if (hasPartial) {
    return {
      allowUpstream: false,
      runtimeDecision: buildEmpresaCadastroRuntimeDecision({
        scenario: 'payload_contrato',
        consultedMunicipio: true,
        codigoIbge: preflight.codigoIbge,
        environment: preflight.environment,
        padraoNacionalEnabled: preflight.padraoNacionalEnabled,
        requiresLogin: preflight.requiresLogin,
        requiresSenha: preflight.requiresSenha,
        upstreamCallSkipped: true,
        attemptMode: attemptNfseMode
      })
    };
  }

  if (!authRequired && hasAnyPrefeituraKey) {
    return {
      allowUpstream: false,
      runtimeDecision: buildEmpresaCadastroRuntimeDecision({
        scenario: 'payload_contrato',
        consultedMunicipio: true,
        codigoIbge: preflight.codigoIbge,
        environment: preflight.environment,
        padraoNacionalEnabled: preflight.padraoNacionalEnabled,
        requiresLogin: preflight.requiresLogin,
        requiresSenha: preflight.requiresSenha,
        upstreamCallSkipped: true,
        attemptMode: attemptNfseMode
      })
    };
  }

  /**
   * DP-PFLNAT-01 / AD-PFLNAT-01: com NFS-e Nacional disponível no preflight, o percurso
   * `attemptNfseMode === 'nacional'` deve permitir upstream antes de bloquear só com base em
   * `requiresLogin` / `requiresSenha` (município híbrido). Exceção explícita §4 arquitetura:
   * par credencial presente com política municipal desligada.
   */
  if (natOk && attemptNfseMode === 'nacional') {
    if (authRequired && hasValidPair && !prefeituraCredentialsEnabled) {
      return {
        allowUpstream: false,
        runtimeDecision: buildRuntimeDecisionFromPreflight(
          'prefeitura_login_required_blocked',
          preflight,
          true,
          { attemptMode: attemptNfseMode }
        )
      };
    }
    return {
      allowUpstream: true,
      runtimeDecision: buildRuntimeDecisionFromPreflight(
        'success_nacional',
        preflight,
        false,
        { attemptMode: 'nacional' }
      )
    };
  }

  if (!authRequired && natOk) {
    return {
      allowUpstream: true,
      runtimeDecision: buildRuntimeDecisionFromPreflight(
        'success_nacional',
        preflight,
        false,
        { attemptMode: 'nacional' }
      )
    };
  }

  if (!authRequired && !natOk) {
    return {
      allowUpstream: false,
      runtimeDecision: buildRuntimeDecisionFromPreflight(
        'prefeitura_ibge_apenas_insuficiente_dp02',
        preflight,
        true,
        { attemptMode: 'nacional' }
      )
    };
  }

  if (authRequired && !hasValidPair) {
    if (!prefeituraCredentialsEnabled) {
      return {
        allowUpstream: false,
        runtimeDecision: buildRuntimeDecisionFromPreflight(
          'prefeitura_login_required_blocked',
          preflight,
          true,
          { attemptMode: 'nacional' }
        )
      };
    }
    return {
      allowUpstream: false,
      runtimeDecision: buildRuntimeDecisionFromPreflight(
        'prefeitura_login_required_fallback_available',
        preflight,
        true,
        { attemptMode: 'nacional' }
      )
    };
  }

  if (authRequired && hasValidPair && !prefeituraCredentialsEnabled) {
    return {
      allowUpstream: false,
      runtimeDecision: buildRuntimeDecisionFromPreflight(
        'prefeitura_login_required_blocked',
        preflight,
        true,
        { attemptMode: attemptNfseMode }
      )
    };
  }

  if (authRequired && hasValidPair && prefeituraCredentialsEnabled) {
    if (attemptNfseMode !== 'municipal') {
      return {
        allowUpstream: false,
        runtimeDecision: buildEmpresaCadastroRuntimeDecision({
          scenario: 'payload_contrato',
          consultedMunicipio: true,
          codigoIbge: preflight.codigoIbge,
          environment: preflight.environment,
          padraoNacionalEnabled: preflight.padraoNacionalEnabled,
          requiresLogin: preflight.requiresLogin,
          requiresSenha: preflight.requiresSenha,
          upstreamCallSkipped: true,
          attemptMode: 'nacional'
        })
      };
    }
    return {
      allowUpstream: true,
      runtimeDecision: buildRuntimeDecisionFromPreflight(
        'success_municipal',
        preflight,
        false,
        { attemptMode: 'municipal' }
      )
    };
  }

  return {
    allowUpstream: false,
    runtimeDecision: buildEmpresaCadastroRuntimeDecision({
      scenario: 'ambiente_configuracao',
      consultedMunicipio: true,
      codigoIbge: preflight.codigoIbge,
      upstreamCallSkipped: true
    })
  };
};

/**
 * Compatível com testes brownfield / REC500: flag off e sem credenciais no payload.
 * @param {Record<string, unknown>} preflight
 */
export const evaluateEmpresaCadastroMunicipioPreflight = (preflight) => {
  const { runtimeDecision } = resolveEmpresaCadastroMunicipioRuntimeDecision(
    preflight,
    {
      prefeituraCredentialsEnabled: false,
      attemptNfseMode: 'nacional',
      credState: {
        hasPartialKeys: false,
        hasNonEmptyCredentialPair: false,
        hasAnyPrefeituraCredentialKey: false
      }
    }
  );
  return runtimeDecision;
};

export const createEmpresaCadastroBlockedErrorFromDecision = (runtimeDecision) => {
  const scenario = String(runtimeDecision?.scenario || '').trim();
  if (scenario === 'prefeitura_login_required_blocked') {
    return badRequest(PREFEITURA_LOGIN_REQUIRED_BLOCKED_MESSAGE, {
      plugnotasCode: PREFEITURA_LOGIN_REQUIRED_BLOCKED_CODE,
      runtimeDecision
    });
  }
  if (scenario === 'prefeitura_login_required_fallback_available') {
    return badRequest(PREFEITURA_LOGIN_REQUIRED_FALLBACK_AVAILABLE_MESSAGE, {
      plugnotasCode: PREFEITURA_LOGIN_REQUIRED_FALLBACK_AVAILABLE_CODE,
      runtimeDecision
    });
  }
  if (scenario === 'prefeitura_ibge_apenas_insuficiente_dp02') {
    return badRequest(PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_MESSAGE, {
      plugnotasCode: PREFEITURA_IBGE_APENAS_INSUFICIENTE_DP02_CODE,
      runtimeDecision
    });
  }
  return badRequest(EMPRESA_CADASTRO_RUNTIME_PAYLOAD_CONTRATO_MESSAGE, {
    plugnotasCode: PLUGNOTAS_EMPRESA_PAYLOAD_CONTRATO_CODE,
    runtimeDecision
  });
};
