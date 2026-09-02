/**
 * Logs de diagnóstico: em produção, debug/info/warn não escrevem no console.
 * Use `error` para falhas que ainda devem aparecer ou integrar com Sentry depois.
 */
export const logger = {
  debug: (...args: unknown[]) => {
    if (__DEV__) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (__DEV__) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (__DEV__) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
