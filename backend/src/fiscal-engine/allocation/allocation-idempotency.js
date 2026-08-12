/**
 * Fingerprint canônico para idempotência de alocação fiscal (Fase 3).
 *
 * Política A (boundary): quantidade validada/canonicalizada via DecimalFieldPolicy qCom
 * (maxScale 4, HALF_UP) ANTES da alocação. Fingerprint e reserva usam a mesma quantidade canônica.
 * Entradas com precisão além de qCom são rejeitadas — não arredondamos silenciosamente no boundary.
 */
import { toDecimal, formatDecimal } from '../money/decimal.js';
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';

const QTY_STORAGE_SCALE = 10;

/**
 * Quantidade canônica — DecimalFieldPolicy qCom (MOC NF-e 7.0, maxScale 4, HALF_UP).
 * @param {unknown} quantidade
 */
export const canonicalizeAllocationQuantity = (quantidade) => (
  formatFieldByPolicy(toDecimal(quantidade), 'qCom')
);

/**
 * Resolve quantidade no boundary: exige aderência à precisão qCom antes de reservar.
 * @param {unknown} quantidade
 * @returns {{ ok: true, quantity: string, canonicalQuantity: string } | { ok: false, reason: 'non_positive' | 'precision' }}
 */
export const resolveBoundaryAllocationQuantity = (quantidade) => {
  const raw = toDecimal(quantidade);
  if (!raw.gt(0)) {
    return { ok: false, reason: 'non_positive' };
  }
  const canonicalQuantity = canonicalizeAllocationQuantity(quantidade);
  const canonical = toDecimal(canonicalQuantity);
  if (!raw.eq(canonical)) {
    return { ok: false, reason: 'precision' };
  }
  return {
    ok: true,
    quantity: formatDecimal(canonical, QTY_STORAGE_SCALE),
    canonicalQuantity,
  };
};

/**
 * IDs comerciais opcionais — null/undefined/'' são equivalentes (ausência).
 * @param {unknown} value
 */
export const normalizeOptionalFingerprintId = (value) => {
  if (value == null || value === '') return null;
  return String(value);
};

/**
 * @param {object} params
 */
export const buildAllocationRequestFingerprint = ({
  produtoCatalogoId,
  quantidade,
  commercialSaleId,
  commercialSaleItemId,
}) => ({
  produtoCatalogoId: String(produtoCatalogoId),
  quantidadeSolicitada: canonicalizeAllocationQuantity(quantidade),
  commercialSaleId: normalizeOptionalFingerprintId(commercialSaleId),
  commercialSaleItemId: normalizeOptionalFingerprintId(commercialSaleItemId),
});

const storedQuantityFingerprint = (storedRequest) => (
  canonicalizeAllocationQuantity(storedRequest?.quantidade_solicitada ?? '0')
);

/**
 * @param {object} storedRequest — row/request persistido
 * @param {ReturnType<typeof buildAllocationRequestFingerprint>} fingerprint
 */
export const matchesStoredAllocationRequest = (storedRequest, fingerprint) => {
  if (!storedRequest || !fingerprint) return false;
  const storedProduto = String(storedRequest.produto_catalogo_id ?? '');
  const storedQty = storedQuantityFingerprint(storedRequest);
  const storedSaleId = normalizeOptionalFingerprintId(storedRequest.commercial_sale_id);
  const storedSaleItemId = normalizeOptionalFingerprintId(storedRequest.commercial_sale_item_id);
  return storedProduto === fingerprint.produtoCatalogoId
    && storedQty === fingerprint.quantidadeSolicitada
    && storedSaleId === fingerprint.commercialSaleId
    && storedSaleItemId === fingerprint.commercialSaleItemId;
};

/**
 * @param {object} storedRequest
 * @param {ReturnType<typeof buildAllocationRequestFingerprint>} fingerprint
 */
export const describeAllocationRequestMismatch = (storedRequest, fingerprint) => {
  const parts = [];
  if (String(storedRequest?.produto_catalogo_id ?? '') !== fingerprint.produtoCatalogoId) {
    parts.push(`produto ${storedRequest?.produto_catalogo_id} ≠ ${fingerprint.produtoCatalogoId}`);
  }
  const storedQty = storedQuantityFingerprint(storedRequest);
  if (storedQty !== fingerprint.quantidadeSolicitada) {
    parts.push(`quantidade ${storedQty} ≠ ${fingerprint.quantidadeSolicitada}`);
  }
  const storedSaleId = normalizeOptionalFingerprintId(storedRequest?.commercial_sale_id);
  if (storedSaleId !== fingerprint.commercialSaleId) {
    parts.push(`commercialSaleId ${storedSaleId} ≠ ${fingerprint.commercialSaleId}`);
  }
  const storedSaleItemId = normalizeOptionalFingerprintId(storedRequest?.commercial_sale_item_id);
  if (storedSaleItemId !== fingerprint.commercialSaleItemId) {
    parts.push(`commercialSaleItemId ${storedSaleItemId} ≠ ${fingerprint.commercialSaleItemId}`);
  }
  return parts.join('; ');
};
