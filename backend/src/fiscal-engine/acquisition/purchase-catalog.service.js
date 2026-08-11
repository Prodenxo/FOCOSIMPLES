/**
 * Catálogo para importação de compras — GTIN, fornecedor+cProd, NCM.
 */
import { createSupabaseClient } from '../../config/supabase.js';
import { badRequest, forbidden } from '../../utils/errors.js';
import { listarCatalogoProdutos } from '../../services/mei-notas.service.js';
import { assertUserOwnsEmpresa } from '../../services/certificate-repository.js';

const PRODUCTS_TABLE = 'mei_nfse_produtos';

const defaultGetDb = () => createSupabaseClient({ useServiceRole: true });
/** @type {null | (() => import('@supabase/supabase-js').SupabaseClient)} */
let getDbOverride = null;
/** @type {null | ((userId: string, empresaId: string) => Promise<void>)} */
let assertUserOwnsEmpresaOverride = null;

/** @internal testes */
export const __setCatalogDbForTests = (fn) => {
  getDbOverride = typeof fn === 'function' ? fn : null;
};

/** @internal testes */
export const __resetCatalogDbForTests = () => {
  getDbOverride = null;
  assertUserOwnsEmpresaOverride = null;
  loadCatalogProductsOverride = null;
};

/** @internal testes */
export const __setAssertUserOwnsEmpresaForTests = (fn) => {
  assertUserOwnsEmpresaOverride = typeof fn === 'function' ? fn : null;
};

const getDb = () => (getDbOverride ? getDbOverride() : defaultGetDb());
const assertEmpresa = (userId, empresaId) => (
  assertUserOwnsEmpresaOverride
    ? assertUserOwnsEmpresaOverride(userId, empresaId)
    : assertUserOwnsEmpresa(userId, empresaId)
);

/**
 * Carrega produtos NFE do catálogo do usuário para matching.
 * @param {string} userId
 */
let loadCatalogProductsOverride = null;

/** @internal testes */
export const __setLoadCatalogProductsForTests = (fn) => {
  loadCatalogProductsOverride = typeof fn === 'function' ? fn : null;
};

export const loadCatalogProductsForPurchase = async (userId) => {
  if (loadCatalogProductsOverride) {
    return loadCatalogProductsOverride(userId);
  }
  if (!userId) return [];
  return listarCatalogoProdutos(userId, { documentType: 'NFE', limit: 200 });
};

/**
 * Valida produto de catálogo pertencente ao usuário/empresa.
 * @param {object} params
 */
export const validateCatalogProductForEmpresa = async ({
  userId,
  empresaId,
  produtoCatalogoId,
}) => {
  if (!produtoCatalogoId) {
    throw badRequest('produtoCatalogoId obrigatório para confirmação manual');
  }
  await assertEmpresa(userId, empresaId);

  const db = getDb();
  const { data, error } = await db
    .from(PRODUCTS_TABLE)
    .select('id, user_id, codigo, metadata_json, document_type')
    .eq('id', produtoCatalogoId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!data) {
    throw forbidden('Produto de catálogo não pertence ao usuário autenticado', {
      code: 'CATALOG_PRODUCT_TENANT_FORBIDDEN',
    });
  }

  return data;
};

/**
 * @param {object} catalogProduct
 */
export const extractCatalogUnitConversion = (catalogProduct) => {
  const meta = catalogProduct?.metadata_json && typeof catalogProduct.metadata_json === 'object'
    ? catalogProduct.metadata_json
    : {};
  if (!meta.stockUnit && !meta.baseUnit) return null;
  return {
    baseUnit: String(meta.stockUnit ?? meta.baseUnit ?? 'UN'),
    factor: meta.unitConversionFactor ? String(meta.unitConversionFactor) : null,
  };
};
