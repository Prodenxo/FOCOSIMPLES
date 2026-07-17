const trimSlashEnd = (value) => String(value || '').replace(/\/$/, '');

/**
 * Monta a URL raiz das chamadas ao Plugnotas: `PLUGNOTAS_API_BASE_URL` + `PLUGNOTAS_API_PATH_PREFIX` (opcional).
 * Lê `process.env` para refletir dotenv e testes que ajustam variáveis antes do import dinâmico.
 *
 * Ex.: base `https://api.plugnotas.com.br` e prefixo `/api` → `https://api.plugnotas.com.br/api`
 */
export const getPlugnotasRootUrl = () => {
  const base = trimSlashEnd(process.env.PLUGNOTAS_API_BASE_URL || '');
  const raw = String(process.env.PLUGNOTAS_API_PATH_PREFIX || '').trim();
  if (!raw) return base;
  const prefix = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base}${trimSlashEnd(prefix)}`;
};
