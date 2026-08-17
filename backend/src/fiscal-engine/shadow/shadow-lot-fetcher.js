/**
 * Fetch de lotes fiscais read-only para shadow planning.
 */
import { query } from '../../config/pg.js';
import { STOCK_LOT_STATUS } from '../acquisition/constants.js';

/**
 * @param {string} empresaId
 * @param {string} produtoCatalogoId
 */
export const fetchUsableLotsForShadowFromPg = async (
  empresaId,
  produtoCatalogoId,
  establishmentId = null,
) => {
  const params = [empresaId, produtoCatalogoId, STOCK_LOT_STATUS.USABLE];
  let sql = `SELECT *
     FROM fiscal_stock_lots
     WHERE empresa_id = $1
       AND produto_catalogo_id = $2
       AND status = $3`;
  if (establishmentId) {
    sql += ' AND establishment_id = $4';
    params.push(establishmentId);
  }
  sql += ' ORDER BY data_entrada ASC, id ASC';
  const { rows } = await query(sql, params);
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
  const filterByEstablishment = (lots) => {
    if (!options.establishmentId) return lots;
    return (lots ?? []).filter((lot) => {
      const lotEst = lot.establishment_id ?? lot.establishmentId ?? null;
      if (!lotEst) {
        if (options.allowLegacyUntaggedLots) return true;
        return options.establishmentId === 'default';
      }
      return String(lotEst) === String(options.establishmentId);
    });
  };

  if (options.inMemoryLots && Array.isArray(options.inMemoryLots)) {
    return filterByEstablishment(options.inMemoryLots);
  }
  if (options.lotFetcher && typeof options.lotFetcher === 'function') {
    return filterByEstablishment(await options.lotFetcher(empresaId, produtoCatalogoId, options));
  }
  if (options.preferPostgres !== false) {
    try {
      return await fetchUsableLotsForShadowFromPg(
        empresaId,
        produtoCatalogoId,
        options.establishmentId ?? null,
      );
    } catch {
      return [];
    }
  }
  return [];
};
