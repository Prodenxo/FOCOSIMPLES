/**
 * Limite coerente para listagens de catálogo MEI (clientes/produtos NFS-e).
 * Usado nas rotas utilizador (`mei-notas`) e admin para evitar divergência.
 */
export const parseCatalogLimit = (value, fallback = 20, max = 50) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return fallback;
  return Math.min(normalized, max);
};
