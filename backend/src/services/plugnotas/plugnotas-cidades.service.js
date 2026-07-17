import { env } from '../../config/env.js';
import { HttpError } from '../../utils/errors.js';
import { isPlugnotasDebugExplicitlyEnabled } from './plugnotas-debug-env.js';
import {
  PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE
} from './empresa-cadastro-runtime-decision.js';
import {
  resolvePlugnotasGatewayUpstreamForClient,
  summarizePlugnotasErrorLogBody
} from './plugnotas-gateway-upstream-error.js';
import { maskPlugnotasPathOrUrlForLog } from './plugnotas-request-log-path.js';
import { getPlugnotasRootUrl } from './root-url.js';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const toNullableBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'sim'].includes(text)) return true;
  if (['0', 'false', 'no', 'nao', 'não'].includes(text)) return false;
  return null;
};

const resolveEnvironmentBoolean = (value, environment, fallback = null) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (hasOwn(value, environment)) return toNullableBoolean(value[environment]) ?? fallback;
    if (hasOwn(value, 'enabled')) return toNullableBoolean(value.enabled) ?? fallback;
    if (hasOwn(value, 'ativo')) return toNullableBoolean(value.ativo) ?? fallback;
    if (hasOwn(value, 'value')) return toNullableBoolean(value.value) ?? fallback;
    return fallback;
  }
  return toNullableBoolean(value) ?? fallback;
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

const toMessage = (payload, fallback = '') => {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload || fallback;
  if (typeof payload !== 'object') return fallback;
  return payload?.error?.message || payload?.message || payload?.error || fallback;
};

const plugnotasRequestErrors = (method, path, httpStatus = null) => ({
  plugnotasRequest: { method, path },
  ...(Number.isFinite(httpStatus) ? { httpStatus } : {})
});

const withTimeout = (ms) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
};

const ensureConfigured = () => {
  if (!env.PLUGNOTAS_API_BASE_URL || !env.PLUGNOTAS_API_KEY) {
    throw new HttpError(
      503,
      'Serviço de emissão fiscal não configurado para consultar a disponibilidade do município.',
      {
        plugnotasCode: PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE
      }
    );
  }
};

const normalizeCidadePreflightPayload = (payload, { codigoIbge, environment }) => {
  const root = toObject(payload);
  const candidates = [
    root,
    toObject(root.data),
    toObject(root.cidade),
    toObject(toObject(root.data).cidade)
  ].filter((entry) => Object.keys(entry).length > 0);

  for (const candidate of candidates) {
    const hasRelevantShape =
      hasOwn(candidate, 'padraoNacional')
      || hasOwn(candidate, 'login')
      || hasOwn(candidate, 'senha')
      || hasOwn(candidate, 'padraoNacionalEnabled')
      || hasOwn(candidate, 'requiresLogin')
      || hasOwn(candidate, 'requiresSenha');
    if (!hasRelevantShape) continue;

    return {
      consulted: true,
      codigoIbge,
      environment,
      padraoNacionalEnabled: resolveEnvironmentBoolean(
        candidate.padraoNacional ?? candidate.padraoNacionalEnabled,
        environment,
        null
      ),
      requiresLogin: resolveEnvironmentBoolean(
        candidate.login ?? candidate.requiresLogin,
        environment,
        false
      ) === true,
      requiresSenha: resolveEnvironmentBoolean(
        candidate.senha ?? candidate.requiresSenha,
        environment,
        false
      ) === true
    };
  }

  throw new HttpError(
    502,
    'Não foi possível interpretar a disponibilidade do município devolvida pelo emissor fiscal.',
    {
      ...plugnotasRequestErrors('GET', `/nfse/cidades/${encodeURIComponent(codigoIbge)}`, 502),
      plugnotasCode: PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE
    }
  );
};

export const consultarCidadePlugNotas = async ({ codigoIbge, environment }) => {
  ensureConfigured();

  const path = `/nfse/cidades/${encodeURIComponent(codigoIbge)}`;
  const timeoutMs = Number(env.PLUGNOTAS_TIMEOUT_MS || 15000);
  const { controller, timeout } = withTimeout(timeoutMs);
  const baseUrl = getPlugnotasRootUrl();
  const fullUrl = `${baseUrl}${path}`;

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': env.PLUGNOTAS_API_KEY
      },
      signal: controller.signal
    });

    const payload = await parseResponsePayload(response);
    if (!response.ok) {
      const gateway = resolvePlugnotasGatewayUpstreamForClient(response.status);
      const message = gateway
        ? gateway.publicMessage
        : toMessage(payload, 'Não foi possível consultar a disponibilidade do município no emissor fiscal.');
      const errors = {
        ...plugnotasRequestErrors('GET', path, response.status),
        plugnotasCode: gateway?.plugnotasCode || PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE
      };

      if (process.env.NODE_ENV !== 'production' || isPlugnotasDebugExplicitlyEnabled()) {
        const ct = response.headers.get('content-type') || '';
        const logBody = gateway
          ? `[gateway_upstream HTTP ${response.status}]`
          : summarizePlugnotasErrorLogBody(toMessage(payload, response.statusText), ct);
        // eslint-disable-next-line no-console
        console.error(
          '[plugnotas]',
          'GET',
          maskPlugnotasPathOrUrlForLog(path),
          response.status,
          logBody,
          maskPlugnotasPathOrUrlForLog(fullUrl)
        );
      }

      throw new HttpError(response.status || 502, message, errors);
    }

    return normalizeCidadePreflightPayload(payload, { codigoIbge, environment });
  } catch (error) {
    if (error instanceof HttpError) throw error;

    if (error?.name === 'AbortError') {
      const gateway = resolvePlugnotasGatewayUpstreamForClient(504);
      throw new HttpError(
        504,
        gateway?.publicMessage || 'A consulta de disponibilidade do município expirou no emissor fiscal.',
        {
          ...plugnotasRequestErrors('GET', path, 504),
          plugnotasCode: gateway?.plugnotasCode || PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE
        }
      );
    }

    throw new HttpError(
      503,
      'Não foi possível consultar a disponibilidade do município no emissor fiscal.',
      {
        ...plugnotasRequestErrors('GET', path, 503),
        plugnotasCode: PLUGNOTAS_EMPRESA_AMBIENTE_CONFIGURACAO_CODE
      }
    );
  } finally {
    clearTimeout(timeout);
  }
};

export { normalizeCidadePreflightPayload };
