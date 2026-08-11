/**
 * Vinculação item compra ↔ catálogo — supplier.cProd ≠ productCatalogId.
 */
import { CATALOG_MATCH_STATUS } from './constants.js';

/**
 * @param {object} item
 * @param {Array<{ id: string, ncm?: string, codigo?: string, metadata_json?: unknown }>} catalogProducts
 */
export const matchPurchaseItemToCatalog = (item, catalogProducts = []) => {
  const ncm = String(item?.commercial?.ncm ?? item?.ncm ?? '').replace(/\D/g, '').slice(0, 8);
  const cProd = String(item?.commercial?.cProd ?? item?.cProd ?? '').trim();
  const cEan = String(item?.commercial?.cEAN ?? item?.c_ean ?? '').replace(/\D/g, '');
  const cEanTrib = String(item?.commercial?.cEANTrib ?? item?.c_ean_trib ?? '').replace(/\D/g, '');
  const gtin = [cEan, cEanTrib].find((g) => g && g !== 'SEMGTIN' && g.length >= 8);

  if (gtin) {
    const byGtin = (catalogProducts || []).filter((p) => {
      const meta = p?.metadata_json && typeof p.metadata_json === 'object' ? p.metadata_json : {};
      const pGtin = String(meta.gtin ?? meta.ean ?? meta.cEAN ?? '').replace(/\D/g, '');
      return pGtin && pGtin === gtin;
    });
    if (byGtin.length === 1) {
      return {
        status: CATALOG_MATCH_STATUS.AUTO_SUGGESTED,
        produtoCatalogoId: byGtin[0].id,
        suggestions: byGtin.map((p) => p.id),
      };
    }
  }

  if (!ncm) {
    return { status: CATALOG_MATCH_STATUS.UNMATCHED, produtoCatalogoId: null, suggestions: [] };
  }

  const byNcm = (catalogProducts || []).filter((p) => {
    const meta = p?.metadata_json && typeof p.metadata_json === 'object' ? p.metadata_json : {};
    const pNcm = String(meta.ncm ?? p.ncm ?? '').replace(/\D/g, '').slice(0, 8);
    return pNcm === ncm;
  });

  const byCode = cProd
    ? byNcm.filter((p) => String(p.codigo ?? '').trim() === cProd)
    : [];

  if (byCode.length === 1) {
    return {
      status: CATALOG_MATCH_STATUS.AUTO_SUGGESTED,
      produtoCatalogoId: byCode[0].id,
      suggestions: byCode.map((p) => p.id),
    };
  }

  if (byNcm.length === 1) {
    return {
      status: CATALOG_MATCH_STATUS.AUTO_SUGGESTED,
      produtoCatalogoId: byNcm[0].id,
      suggestions: byNcm.map((p) => p.id),
    };
  }

  if (byNcm.length > 1) {
    return {
      status: CATALOG_MATCH_STATUS.UNMATCHED,
      produtoCatalogoId: null,
      suggestions: byNcm.map((p) => p.id),
    };
  }

  return { status: CATALOG_MATCH_STATUS.UNMATCHED, produtoCatalogoId: null, suggestions: [] };
};

/**
 * @param {string} catalogMatchStatus
 */
export const isCatalogMatchConfident = (catalogMatchStatus) => (
  catalogMatchStatus === CATALOG_MATCH_STATUS.MANUALLY_CONFIRMED
);
