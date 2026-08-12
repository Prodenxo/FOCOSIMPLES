/**
 * Registro de estado terminal por execução shadow — evita resultado tardio contraditório.
 */

/** @type {Map<string, { status: string, comparisonId: string, at: string }>} */
const terminalByExecutionKey = new Map();

/**
 * @param {string} executionKey
 */
export const getShadowTerminalState = (executionKey) => (
  terminalByExecutionKey.get(executionKey) ?? null
);

/**
 * @param {string} executionKey
 * @param {{ status: string, comparisonId: string }} state
 * @returns {boolean} true se registrado (primeiro terminal vence)
 */
export const tryMarkShadowTerminalState = (executionKey, state) => {
  if (terminalByExecutionKey.has(executionKey)) return false;
  terminalByExecutionKey.set(executionKey, {
    status: state.status,
    comparisonId: state.comparisonId,
    at: new Date().toISOString(),
  });
  return true;
};

/** @internal */
export const __resetShadowExecutionRegistryForTests = () => {
  terminalByExecutionKey.clear();
};
