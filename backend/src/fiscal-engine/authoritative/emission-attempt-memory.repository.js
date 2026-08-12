/**
 * Repositório in-memory — fiscal_v3_emission_attempts.
 */
/** @type {Map<string, object>} */
const attemptsById = new Map();

export const insertEmissionAttemptMemory = (row) => {
  attemptsById.set(String(row.attemptId), { ...row, createdAt: row.createdAt ?? new Date().toISOString() });
  return row;
};

export const updateEmissionAttemptMemory = (attemptId, patch) => {
  const existing = attemptsById.get(String(attemptId));
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  attemptsById.set(String(attemptId), updated);
  return updated;
};

export const findEmissionAttemptMemory = (attemptId) => (
  attemptsById.get(String(attemptId)) ?? null
);

export const findEmissionAttemptsByMeiNotaMemory = (empresaId, meiNotaRecordId) => (
  [...attemptsById.values()].filter((a) => (
    String(a.empresaId) === String(empresaId)
    && String(a.meiNotaRecordId) === String(meiNotaRecordId)
  ))
);

export const listEmissionAttemptsByEmpresaMemory = (empresaId) => (
  [...attemptsById.values()].filter((a) => String(a.empresaId) === String(empresaId))
);

/** @internal */
export const __resetEmissionAttemptsMemoryForTests = () => {
  attemptsById.clear();
};
