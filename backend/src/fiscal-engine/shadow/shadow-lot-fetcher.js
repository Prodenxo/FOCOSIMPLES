/**
 * Fetch de lotes fiscais read-only para shadow planning.
 */
import { query } from '../../config/pg.js';
import { STOCK_LOT_STATUS } from '../acquisition/constants.js';

/**
 * @param {string} empresaId
 * @param {string} produtoCatalogoId
 */
export const fetchUsableLotsForShadowFromPg = async (empresaId, produtoCatalogoId) => {
  const { rows } = await query(
    `SELECT *
     FROM fiscal_stock_lots
     WHERE empresa_id = $1
       AND produto_catalogo_id = $2
       AND status = $3
     ORDER BY data_entrada ASC, id ASC`,
    [empresaId, produtoCatalogoId, STOCK_LOT_STATUS.USABLE],
  );
  return rows;
};

/**
 * @param {Map<string, object[]> | Record<string, object[]>} lotsByProduct
 */
export const createInMemoryLotFetcher = (lotsByProduct = {}) => {
  const map = lotsByProduct instanceof Map ? lotsByProduct : new Map(Object.entries(lotsByProduct));
  return async (_empresaId, produtoCatalogoId) => map.get(produtoCatalogoId) ?? [];
};

/**
 * Tenta Postgres; fallback vazio (fail-open).
 * @param {string} empresaId
 * @param {string} produtoCatalogoId
 * @param {object} [options]
 * @param {boolean} [options.preferPostgres]
 */
export const fetchLotsForShadow = async (empresaId, produtoCatalogoId, options = {}) => {
  if (options.inMemoryLots && Array.isArray(options.inMemoryLots)) {
    return options.inMemoryLots;
  }
  if (options.lotFetcher && typeof options.lotFetcher === 'function') {
    return options.lotFetcher(empresaId, produtoCatalogoId);
  }
  if (options.preferPostgres !== false) {
    try {
      return await fetchUsableLotsForShadowFromPg(empresaId, produtoCatalogoId);
    } catch {
      return [];
    }
  }
  return [];
};
