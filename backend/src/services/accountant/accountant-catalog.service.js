/**
 * Catálogo comercial scoped por cliente — contador BPO Phase 9B/9B.1.
 */
import { badRequest } from '../../utils/errors.js';
import {
  criarCatalogoProduto,
  atualizarCatalogoProduto,
  listarCatalogoProdutos,
} from '../mei-notas.service.js';
import { assertUserCanAccessEmpresa, resolveEmitterCatalogUserId } from './accountant-access.service.js';
import {
  assertProductBelongsToEmpresa,
  listCanonicalEstablishmentsForTenant,
} from './accountant-fiscal-boundary.service.js';

const stripEmpresaFromBody = (body = {}) => {
  if (body.empresaId !== undefined || body.empresa_id !== undefined) {
    throw badRequest('empresaId no body não é permitido — ownership vem da rota');
  }
  const { empresaId: _a, empresa_id: _b, ...safe } = body;
  return safe;
};

/**
 * @param {string} actorUserId
 * @param {string} empresaId
 * @param {{ q?: string, limit?: number, documentType?: string, emitterUserId?: string }} [query]
 */
export const listClientProducts = async (actorUserId, empresaId, query = {}) => {
  await assertUserCanAccessEmpresa(actorUserId, empresaId);
  if (!query.emitterUserId) {
    throw badRequest('emitterUserId obrigatório — selecione o emissor (CNPJ)');
  }
  const catalogUserId = await resolveEmitterCatalogUserId(empresaId, query.emitterUserId);
  return listarCatalogoProdutos(null, {
    empresaId,
    catalogUserId,
    q: query.q ?? '',
    limit: query.limit ?? 200,
    documentType: query.documentType ?? 'NFE',
    includeLegacyUnscoped: false,
  });
};

/**
 * @param {string} actorUserId
 * @param {string} empresaId
 * @param {object} body
 * @param {{ emitterUserId?: string }} [options]
 */
export const createClientProduct = async (actorUserId, empresaId, body = {}, options = {}) => {
  await assertUserCanAccessEmpresa(actorUserId, empresaId);
  if (!options.emitterUserId) {
    throw badRequest('emitterUserId obrigatório — selecione o emissor (CNPJ)');
  }
  const safeBody = stripEmpresaFromBody(body);
  const catalogUserId = await resolveEmitterCatalogUserId(empresaId, options.emitterUserId);
  return criarCatalogoProduto(actorUserId, safeBody, {
    empresaId,
    catalogUserId,
    requireEmpresaId: true,
  });
};

/**
 * @param {string} actorUserId
 * @param {string} empresaId
 * @param {string} productId
 * @param {object} body
 */
export const updateClientProduct = async (actorUserId, empresaId, productId, body = {}) => {
  await assertUserCanAccessEmpresa(actorUserId, empresaId);
  await assertProductBelongsToEmpresa(empresaId, productId);
  const safeBody = stripEmpresaFromBody(body);
  return atualizarCatalogoProduto(actorUserId, productId, safeBody, { empresaId });
};

/**
 * Estabelecimentos fiscais canônicos — somente company_fiscal_profiles.
 * @param {string} actorUserId
 * @param {string} empresaId
 */
export const listClientEstablishments = async (actorUserId, empresaId) => {
  await assertUserCanAccessEmpresa(actorUserId, empresaId);
  const establishments = await listCanonicalEstablishmentsForTenant(empresaId);
  if (establishments.length === 0) {
    return { establishments: [], status: 'NO_FISCAL_ESTABLISHMENT' };
  }
  return { establishments, status: 'OK' };
};
