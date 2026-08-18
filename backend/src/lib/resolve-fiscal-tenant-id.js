/**
 * Resolve tenantId (empresa UUID) para regras fiscais do contador.
 * Regras são salvas com tenantId = empresas.id — não confundir com auth userId.
 */
import { resolveUserEmpresaContext } from '../services/certificate-repository.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isEmpresaUuid = (value) => UUID_RE.test(String(value ?? '').trim());

/**
 * @param {string} userId
 * @param {string | null | undefined} metadataEmpresaId
 * @returns {Promise<string>}
 */
export const resolveFiscalTenantId = async (userId, metadataEmpresaId) => {
  const hinted = String(metadataEmpresaId ?? '').trim();
  if (isEmpresaUuid(hinted)) return hinted;

  const { empresaId } = await resolveUserEmpresaContext(userId);
  if (isEmpresaUuid(empresaId)) return empresaId;

  return String(userId ?? '').trim();
};
