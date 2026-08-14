/**
 * Modo central de persistência authoritative — fiscal config, rollout, emission attempts.
 *
 * Produção: bootstrap no server.js ativa Postgres quando DATABASE_URL disponível.
 * Testes: default memory; __setFiscalRepositoryModeForTests ou helpers legados.
 */
import { env } from '../../config/env.js';
import { getPgPool } from '../../config/pg.js';

export const FISCAL_REPOSITORY_MODE = Object.freeze({
  MEMORY: 'memory',
  POSTGRES: 'postgres',
});

/** @type {'memory' | 'postgres' | null} */
let bootstrappedMode = null;

/** @type {'memory' | 'postgres' | null} */
let testOverride = null;

const parseEnvMode = () => {
  const raw = String(process.env.FISCAL_ENGINE_REPOSITORY_MODE ?? '').trim().toLowerCase();
  if (raw === FISCAL_REPOSITORY_MODE.MEMORY) return FISCAL_REPOSITORY_MODE.MEMORY;
  if (raw === FISCAL_REPOSITORY_MODE.POSTGRES) return FISCAL_REPOSITORY_MODE.POSTGRES;
  return null;
};

const hasDatabaseUrl = () => Boolean(
  String(env.DATABASE_URL || env.SUPABASE_DB_URL || '').trim(),
);

/**
 * Bootstrap de produção — invocado em server.js após db-bootstrap.
 * @returns {'memory' | 'postgres'}
 */
export const bootstrapFiscalEngineRepositoryMode = () => {
  const envMode = parseEnvMode();
  if (envMode) {
    bootstrappedMode = envMode;
    return bootstrappedMode;
  }
  bootstrappedMode = hasDatabaseUrl()
    ? FISCAL_REPOSITORY_MODE.POSTGRES
    : FISCAL_REPOSITORY_MODE.MEMORY;
  return bootstrappedMode;
};

/** @internal testes */
export const __setFiscalRepositoryModeForTests = (mode) => {
  testOverride = mode === FISCAL_REPOSITORY_MODE.POSTGRES
    ? FISCAL_REPOSITORY_MODE.POSTGRES
    : FISCAL_REPOSITORY_MODE.MEMORY;
};

/** @internal testes */
export const __resetFiscalRepositoryModeForTests = () => {
  testOverride = null;
};

/** @internal testes */
export const __resetFiscalEngineRepositoryBootstrapForTests = () => {
  bootstrappedMode = null;
  testOverride = null;
};

/**
 * @returns {'memory' | 'postgres'}
 */
export const resolveFiscalRepositoryMode = () => {
  if (testOverride !== null) return testOverride;
  if (bootstrappedMode !== null) return bootstrappedMode;
  const envMode = parseEnvMode();
  if (envMode) return envMode;
  return FISCAL_REPOSITORY_MODE.MEMORY;
};

export const isFiscalEnginePostgresEnabled = () => (
  resolveFiscalRepositoryMode() === FISCAL_REPOSITORY_MODE.POSTGRES
);

/**
 * Runtime bootstrapped em memory (produção sem PG) — authoritative fail-closed.
 * Testes unitários sem bootstrap continuam memory permitido.
 */
export const isAuthoritativePersistenceBlockedInRuntime = () => {
  if (testOverride !== null) return false;
  return bootstrappedMode === FISCAL_REPOSITORY_MODE.MEMORY;
};

/** @internal testes — simula bootstrap produção em memory */
export const __forceProductionBootstrapMemoryModeForTests = () => {
  bootstrappedMode = FISCAL_REPOSITORY_MODE.MEMORY;
  testOverride = null;
};

/**
 * Fail-closed — authoritative state exige Postgres disponível.
 */
export const assertAuthoritativePersistenceAvailable = () => {
  if (!isFiscalEnginePostgresEnabled()) {
    throw new Error('FISCAL_ENGINE_POSTGRES_REQUIRED: authoritative persistence requires Postgres repository');
  }
  getPgPool();
};
