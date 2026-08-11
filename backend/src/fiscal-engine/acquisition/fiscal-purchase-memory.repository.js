/**
 * Repositório in-memory — apenas unit tests.
 * Interface compatível com fiscal-purchase.repository.js (async).
 */
import { randomUUID } from 'node:crypto';
import { toDecimal, formatDecimal } from '../money/decimal.js';

/** @type {Map<string, object>} */
const invoicesById = new Map();
/** @type {Map<string, string>} */
const invoiceIdByChave = new Map();
/** @type {Map<string, object[]>} */
const itemsByInvoice = new Map();
/** @type {Map<string, object>} */
const lotsByPurchaseItem = new Map();
/** @type {Map<string, object>} */
const lotsById = new Map();

const QTY_SCALE = 10;
const chaveKey = (empresaId, chave) => `${empresaId}:${chave}`;

export const __resetFiscalPurchaseMemoryRepo = () => {
  invoicesById.clear();
  invoiceIdByChave.clear();
  itemsByInvoice.clear();
  lotsByPurchaseItem.clear();
  lotsById.clear();
};

/**
 * @param {string} empresaId
 * @param {string} chaveNfe
 */
export const findInvoiceByChave = async (empresaId, chaveNfe) => {
  const id = invoiceIdByChave.get(chaveKey(empresaId, chaveNfe));
  if (!id) return null;
  const invoice = invoicesById.get(id);
  if (!invoice) return null;
  return {
    invoice,
    items: itemsByInvoice.get(id) || [],
    lots: (itemsByInvoice.get(id) || []).map((it) => lotsByPurchaseItem.get(it.id)).filter(Boolean),
  };
};

/**
 * @param {object} params
 */
export const savePurchaseImport = async ({ invoice, items, lots }) => {
  const existingId = invoiceIdByChave.get(chaveKey(invoice.empresa_id, invoice.chave_nfe));
  if (existingId) {
    return {
      duplicate: true,
      invoice: invoicesById.get(existingId),
      items: itemsByInvoice.get(existingId) || [],
      lots: (itemsByInvoice.get(existingId) || []).map((it) => lotsByPurchaseItem.get(it.id)).filter(Boolean),
    };
  }

  const invoiceId = invoice.id || randomUUID();
  const savedInvoice = { ...invoice, id: invoiceId };
  invoicesById.set(invoiceId, savedInvoice);
  invoiceIdByChave.set(chaveKey(invoice.empresa_id, invoice.chave_nfe), invoiceId);

  const savedItems = items.map((it) => {
    const itemId = it.id || randomUUID();
    return { ...it, id: itemId, purchase_invoice_id: invoiceId };
  });
  itemsByInvoice.set(invoiceId, savedItems);

  const savedLots = lots.map((lot, idx) => {
    const lotId = lot.id || randomUUID();
    const purchaseItemId = savedItems[idx]?.id;
    const saved = {
      ...lot,
      id: lotId,
      purchase_item_id: purchaseItemId,
      version: lot.version ?? 0,
    };
    lotsById.set(lotId, saved);
    if (purchaseItemId) lotsByPurchaseItem.set(purchaseItemId, saved);
    return saved;
  });

  return {
    duplicate: false,
    invoice: savedInvoice,
    items: savedItems,
    lots: savedLots,
  };
};

/**
 * @param {string} empresaId
 * @param {string} lotId
 * @param {string} quantidade
 * @param {number} [expectedVersion]
 */
export const consumeStockLotQuantity = async (empresaId, lotId, quantidade, expectedVersion) => {
  const lot = lotsById.get(lotId);
  if (!lot || lot.empresa_id !== empresaId) {
    return { ok: false, error: 'Lote não encontrado' };
  }

  const qty = toDecimal(quantidade);
  if (!qty.gt(0)) return { ok: false, error: 'Quantidade inválida' };

  const currentVersion = expectedVersion ?? lot.version ?? 0;
  if ((lot.version ?? 0) !== currentVersion) {
    return { ok: false, error: 'Conflito de versão ou estoque insuficiente' };
  }

  const available = toDecimal(lot.quantidade_disponivel);
  if (available.lt(qty)) {
    return {
      ok: false,
      error: 'Estoque insuficiente',
      available: formatDecimal(available, QTY_SCALE),
    };
  }

  const nextAvailable = available.minus(qty);
  const updated = {
    ...lot,
    quantidade_disponivel: formatDecimal(nextAvailable, QTY_SCALE),
    version: currentVersion + 1,
    status: nextAvailable.isZero() ? 'DEPLETED' : lot.status,
    updated_at: new Date().toISOString(),
  };
  lotsById.set(lotId, updated);
  lotsByPurchaseItem.set(updated.purchase_item_id, updated);

  return { ok: true, lot: updated, consumed: formatDecimal(qty, QTY_SCALE) };
};

export const getStockLotById = async (empresaId, lotId) => {
  const lot = lotsById.get(lotId);
  if (!lot || lot.empresa_id !== empresaId) return null;
  return lot;
};

export const listStockLotsByEmpresa = async (empresaId) => (
  [...lotsById.values()].filter((l) => l.empresa_id === empresaId)
);

export const getEmpresaFiscalDoc = async () => null;
