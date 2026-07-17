/**
 * Extrai código estável de negócio Plugnotas de `errors` no JSON de erro da API (`success: false`).
 * Uso defensivo para clientes e US-MEI-FISC-03 — não assume formato além de objeto simples.
 * @param {unknown} errors
 * @returns {string | null}
 */
export const getPlugnotasCodeFromApiErrors = (errors) => {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return null;
  const raw = /** @type {Record<string, unknown>} */ (errors).plugnotasCode;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
};
