/**
 * Porta de validação de produtos comerciais para bulk assign.
 * Autoridade comercial: mei_nfse_produtos (user_id) — catálogo compartilhado pelo user.
 * Boundary fiscal: fiscal_product_group_memberships (tenant_id, product_id).
 */
import { validateCatalogProductForEmpresa } from '../acquisition/purchase-catalog.service.js';
import { listarCatalogoProdutos } from '../../services/mei-notas.service.js';

/** @type {Map<string, Set<string>>} userId → productIds (test-only, catálogo global do user) */
const testCatalogRegistry = new Map();

/** @type {Map<string, Map<string, Set<string>>>} userId → tenantId → productIds (test-only, scope explícito) */
const testCatalogRegistryByTenant = new Map();

/** @type {Map<string, object>} productId → metadata_json (test-only) */
const testCatalogMetadataOverrides = new Map();

/** @internal testes */
export const __resetFiscalProductCatalogPortForTests = () => {
  testCatalogRegistry.clear();
  testCatalogRegistryByTenant.clear();
  testCatalogMetadataOverrides.clear();
  validateProductsOverride = null;
  listCatalogOverride = null;
};

/** @internal testes — catálogo global do user (qualquer tenant autorizado do user) */
export const __registerCatalogProductForTests = (userId, productId) => {
  const key = String(userId);
  if (!testCatalogRegistry.has(key)) testCatalogRegistry.set(key, new Set());
  testCatalogRegistry.get(key).add(String(productId));
};

/** @internal testes — simula scopedEmpresaIds explícito restrito a tenant(s) */
export const __registerCatalogProductForTenantTests = (userId, tenantId, productId) => {
  const userKey = String(userId);
  const tenantKey = String(tenantId);
  if (!testCatalogRegistryByTenant.has(userKey)) {
    testCatalogRegistryByTenant.set(userKey, new Map());
  }
  const byTenant = testCatalogRegistryByTenant.get(userKey);
  if (!byTenant.has(tenantKey)) byTenant.set(tenantKey, new Set());
  byTenant.get(tenantKey).add(String(productId));
};

/** @internal testes — metadata_json autoritativo por produto */
export const __setCatalogProductMetadataForTests = (productId, metadataJson) => {
  testCatalogMetadataOverrides.set(String(productId), metadataJson);
};

const tenantsWithScopedProduct = (userId, productId) => {
  const byTenant = testCatalogRegistryByTenant.get(String(userId));
  if (!byTenant) return [];
  return [...byTenant.entries()]
    .filter(([, set]) => set.has(String(productId)))
    .map(([tenantId]) => tenantId);
};

let validateProductsOverride = null;
let listCatalogOverride = null;

/** @internal testes */
export const __setValidateProductsForTenantForTests = (fn) => {
  validateProductsOverride = typeof fn === 'function' ? fn : null;
};

/** @internal testes */
export const __setListCatalogProductsForTenantForTests = (fn) => {
  listCatalogOverride = typeof fn === 'function' ? fn : null;
};

/**
 * Restringe tenant apenas quando metadata_json declara scope explícito.
 * Ausência de metadata NÃO implica proibição.
 * @param {object} catalogProduct
 * @param {string} tenantId
 */
const assertCatalogProductMetadataAllowsTenant = (catalogProduct, tenantId) => {
  const meta = catalogProduct?.metadata_json;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return;

  const scopedSingle = meta.empresaId ?? meta.scopedEmpresaId ?? null;
  if (scopedSingle && String(scopedSingle) !== String(tenantId)) {
    const err = new Error('Produto não pertence à empresa informada');
    err.code = 'CATALOG_PRODUCT_TENANT_FORBIDDEN';
    throw err;
  }

  const scopedList = meta.scopedEmpresaIds ?? meta.empresaIds ?? null;
  if (Array.isArray(scopedList) && scopedList.length > 0) {
    if (!scopedList.map(String).includes(String(tenantId))) {
      const err = new Error('Produto não pertence à empresa informada');
      err.code = 'CATALOG_PRODUCT_TENANT_FORBIDDEN';
      throw err;
    }
  }
};

/**
 * Valida que todos productIds pertencem ao catálogo do user e podem operar no tenant.
 * @param {object} params
 */
export const validateProductsBelongToTenant = async ({
  userId,
  tenantId,
  productIds,
}) => {
  if (validateProductsOverride) {
    return validateProductsOverride({ userId, tenantId, productIds });
  }

  const unique = [...new Set(productIds.map(String))];
  if (unique.length === 0) {
    throw new Error('PRODUCT_IDS_REQUIRED');
  }

  for (const productId of unique) {
    const scopedTenants = tenantsWithScopedProduct(userId, productId);
    if (scopedTenants.length > 0 && !scopedTenants.includes(String(tenantId))) {
      const err = new Error('Produto não pertence à empresa informada');
      err.code = 'CATALOG_PRODUCT_TENANT_FORBIDDEN';
      throw err;
    }

    if (scopedTenants.includes(String(tenantId))) {
      continue;
    }

    const globalRegistry = testCatalogRegistry.get(String(userId));
    if (globalRegistry?.has(productId)) {
      const metadataOverride = testCatalogMetadataOverrides.get(productId);
      if (metadataOverride) {
        assertCatalogProductMetadataAllowsTenant({ metadata_json: metadataOverride }, tenantId);
      }
      continue;
    }

    const catalogProduct = await validateCatalogProductForEmpresa({
      userId,
      empresaId: tenantId,
      produtoCatalogoId: productId,
    });

    const metadataOverride = testCatalogMetadataOverrides.get(productId);
    const productForScope = metadataOverride
      ? { ...catalogProduct, metadata_json: metadataOverride }
      : catalogProduct;

    assertCatalogProductMetadataAllowsTenant(productForScope, tenantId);
  }

  return unique;
};

/**
 * Lista produtos do catálogo comercial do user (NFE).
 * @param {string} userId
 */
export const listCatalogProductIdsForUser = async (userId) => {
  if (listCatalogOverride) return listCatalogOverride(userId);

  const registry = testCatalogRegistry.get(String(userId));
  const scoped = testCatalogRegistryByTenant.get(String(userId));
  if (registry || scoped) {
    const ids = new Set(registry ? [...registry] : []);
    if (scoped) {
      for (const set of scoped.values()) {
        for (const id of set) ids.add(id);
      }
    }
    return [...ids];
  }
  const products = await listarCatalogoProdutos(userId, { documentType: 'NFE', limit: 5000 });
  return products.map((p) => String(p.id));
};
