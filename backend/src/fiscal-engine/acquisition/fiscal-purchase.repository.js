/**
 * Repositório Postgres — fiscal purchase / stock (Fase 2 hardening).
 * Escopo obrigatório por empresa_id em todas as operações.
 */
import { randomUUID } from 'node:crypto';
import { getPgPool } from '../../config/pg.js';
import { toDecimal, formatDecimal } from '../money/decimal.js';
import { ensureFiscalPurchaseSchema, canAutoEnsureFiscalPurchaseSchema } from './fiscal-purchase.schema.js';
import { FISCAL_LOT_SOURCE } from './manual-opening-lot.constants.js';
import { ORIGEM_FISCAL_SOURCE } from '../types/origem-mercadoria.js';

const QTY_SCALE = 10;

const maybeEnsureSchema = async () => {
  if (canAutoEnsureFiscalPurchaseSchema()) {
    await ensureFiscalPurchaseSchema();
  }
};

const jsonValue = (value) => {
  if (value == null) return null;
  return JSON.stringify(value);
};

const mapInvoiceRow = (row) => (row ? {
  ...row,
  parse_warnings: row.parse_warnings ?? [],
  header_json: row.header_json ?? {},
} : null);

/**
 * @param {string} empresaId
 * @param {string} chaveNfe
 */
export const findInvoiceByChave = async (empresaId, chaveNfe) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const inv = await pool.query(
    `SELECT * FROM fiscal_purchase_invoices
     WHERE empresa_id = $1 AND chave_nfe = $2
     LIMIT 1`,
    [empresaId, chaveNfe],
  );
  if (!inv.rows[0]) return null;
  const invoice = mapInvoiceRow(inv.rows[0]);
  const itemsRes = await pool.query(
    `SELECT * FROM fiscal_purchase_items WHERE purchase_invoice_id = $1 ORDER BY numero_item`,
    [invoice.id],
  );
  const items = itemsRes.rows;
  const lotsRes = await pool.query(
    `SELECT l.* FROM fiscal_stock_lots l
     INNER JOIN fiscal_purchase_items i ON i.id = l.purchase_item_id
     WHERE i.purchase_invoice_id = $1`,
    [invoice.id],
  );
  return { invoice, items, lots: lotsRes.rows };
};

/**
 * @param {object} params
 */
export const savePurchaseImport = async ({ invoice, items, lots }) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const dup = await client.query(
      `SELECT id FROM fiscal_purchase_invoices
       WHERE empresa_id = $1 AND chave_nfe = $2 FOR UPDATE`,
      [invoice.empresa_id, invoice.chave_nfe],
    );
    if (dup.rows[0]) {
      await client.query('ROLLBACK');
      const existing = await findInvoiceByChave(invoice.empresa_id, invoice.chave_nfe);
      return { duplicate: true, ...existing };
    }

    const invoiceId = invoice.id || randomUUID();
    await client.query(
      `INSERT INTO fiscal_purchase_invoices (
        id, empresa_id, chave_nfe, inf_nfe_id, modelo, serie, numero, dh_emi,
        emitente_cnpj, destinatario_doc, document_status,
        authorization_status, event_status, signature_status,
        protocolo_numero, protocolo_chave, protocolo_cstat,
        xml_sha256, parser_version, parse_status, parse_warnings, header_json
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      )`,
      [
        invoiceId,
        invoice.empresa_id,
        invoice.chave_nfe,
        invoice.inf_nfe_id,
        invoice.modelo,
        invoice.serie,
        invoice.numero,
        invoice.dh_emi,
        invoice.emitente_cnpj,
        invoice.destinatario_doc,
        invoice.document_status,
        invoice.authorization_status ?? 'UNKNOWN',
        invoice.event_status ?? 'NOT_CHECKED',
        invoice.signature_status ?? 'UNVERIFIED',
        invoice.protocolo_numero,
        invoice.protocolo_chave,
        invoice.protocolo_cstat,
        invoice.xml_sha256,
        invoice.parser_version,
        invoice.parse_status ?? 'PARSED',
        jsonValue(invoice.parse_warnings ?? []),
        jsonValue(invoice.header_json ?? {}),
      ],
    );

    const savedItems = [];
    for (const it of items) {
      const itemId = it.id || randomUUID();
      await client.query(
        `INSERT INTO fiscal_purchase_items (
          id, purchase_invoice_id, numero_item, c_prod, c_ean, x_prod, ncm, supplier_cest,
          cfop_entrada, origem, u_com, q_com, v_un_com, v_prod, c_ean_trib, u_trib, q_trib,
          v_un_trib, ind_tot, desconto, frete, seguro, outras_despesas,
          parsed_tax_json, prior_st_status, prior_st_evidence_json,
          catalog_match_status, produto_catalogo_id, unit_conversion_json,
          stock_unit_resolution_json, issues_json
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
          $24,$25,$26,$27,$28,$29,$30,$31
        )`,
        [
          itemId, invoiceId, it.numero_item, it.c_prod, it.c_ean, it.x_prod, it.ncm,
          it.supplier_cest, it.cfop_entrada, it.origem, it.u_com, it.q_com, it.v_un_com,
          it.v_prod, it.c_ean_trib, it.u_trib, it.q_trib, it.v_un_trib, it.ind_tot,
          it.desconto, it.frete, it.seguro, it.outras_despesas,
          jsonValue(it.parsed_tax_json ?? {}),
          it.prior_st_status,
          jsonValue(it.prior_st_evidence_json ?? {}),
          it.catalog_match_status,
          it.produto_catalogo_id,
          jsonValue(it.unit_conversion_json ?? {}),
          jsonValue(it.stock_unit_resolution_json ?? {}),
          jsonValue(it.issues_json ?? []),
        ],
      );
      savedItems.push({ ...it, id: itemId, purchase_invoice_id: invoiceId });
    }

    const savedLots = [];
    for (let idx = 0; idx < lots.length; idx += 1) {
      const lot = lots[idx];
      const lotId = lot.id || randomUUID();
      const purchaseItemId = savedItems[idx]?.id;
      await client.query(
        `INSERT INTO fiscal_stock_lots (
          id, empresa_id, establishment_id, produto_catalogo_id, purchase_item_id,
          lot_source, origem_mercadoria, origem_mercadoria_source,
          base_unit, quantidade_inicial, quantidade_disponivel, prior_st_status,
          prior_st_evidence_json, supplier_cest, st_retained_values_json,
          stock_unit_resolution_json, data_entrada, status, version
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
        )`,
        [
          lotId,
          lot.empresa_id,
          lot.establishment_id ?? null,
          lot.produto_catalogo_id,
          purchaseItemId,
          FISCAL_LOT_SOURCE.PURCHASE_XML,
          lot.origem_mercadoria,
          ORIGEM_FISCAL_SOURCE.PURCHASE_XML_CONFIRMED,
          lot.base_unit,
          lot.quantidade_inicial,
          lot.quantidade_disponivel,
          lot.prior_st_status,
          jsonValue(lot.prior_st_evidence_json ?? {}),
          lot.supplier_cest,
          jsonValue(lot.st_retained_values_json ?? {}),
          jsonValue(lot.stock_unit_resolution_json ?? {}),
          lot.data_entrada,
          lot.status,
          lot.version ?? 0,
        ],
      );
      savedLots.push({
        ...lot,
        id: lotId,
        purchase_item_id: purchaseItemId,
      });
    }

    await client.query('COMMIT');
    const savedInvoice = { ...invoice, id: invoiceId };
    return {
      duplicate: false,
      invoice: savedInvoice,
      items: savedItems,
      lots: savedLots,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err?.code === '23505') {
      const existing = await findInvoiceByChave(invoice.empresa_id, invoice.chave_nfe);
      return { duplicate: true, ...existing };
    }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * @param {string} empresaId
 * @param {string} lotId
 * @param {string} quantidade
 * @param {number} [expectedVersion]
 */
export const consumeStockLotQuantity = async (empresaId, lotId, quantidade, expectedVersion) => {
  await maybeEnsureSchema();
  const qty = toDecimal(quantidade);
  if (!qty.gt(0)) return { ok: false, error: 'Quantidade inválida' };

  const pool = getPgPool();
  const current = await pool.query(
    `SELECT * FROM fiscal_stock_lots WHERE id = $1 AND empresa_id = $2`,
    [lotId, empresaId],
  );
  const lot = current.rows[0];
  if (!lot) return { ok: false, error: 'Lote não encontrado' };

  const version = expectedVersion ?? lot.version ?? 0;
  const available = toDecimal(lot.quantidade_disponivel);
  if (available.lt(qty)) {
    return {
      ok: false,
      error: 'Estoque insuficiente',
      available: formatDecimal(available, QTY_SCALE),
    };
  }

  const nextAvailable = available.minus(qty);
  const nextStatus = nextAvailable.isZero() ? 'DEPLETED' : lot.status;

  const updated = await pool.query(
    `UPDATE fiscal_stock_lots
     SET quantidade_disponivel = $1,
         status = $2,
         version = version + 1,
         updated_at = now()
     WHERE id = $3 AND empresa_id = $4 AND version = $5
       AND quantidade_disponivel >= $6
     RETURNING *`,
    [
      formatDecimal(nextAvailable, QTY_SCALE),
      nextStatus,
      lotId,
      empresaId,
      version,
      formatDecimal(qty, QTY_SCALE),
    ],
  );

  if (!updated.rows[0]) {
    return { ok: false, error: 'Conflito de versão ou estoque insuficiente' };
  }

  return {
    ok: true,
    lot: updated.rows[0],
    consumed: formatDecimal(qty, QTY_SCALE),
  };
};

/**
 * @param {string} empresaId
 * @param {string} lotId
 */
export const getStockLotById = async (empresaId, lotId) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const res = await pool.query(
    `SELECT * FROM fiscal_stock_lots WHERE id = $1 AND empresa_id = $2`,
    [lotId, empresaId],
  );
  return res.rows[0] || null;
};

/**
 * @param {string} empresaId
 */
export const listStockLotsByEmpresa = async (empresaId) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const res = await pool.query(
    `SELECT * FROM fiscal_stock_lots WHERE empresa_id = $1 ORDER BY data_entrada DESC`,
    [empresaId],
  );
  return res.rows;
};

/**
 * @param {string} empresaId
 * @returns {Promise<string|null>}
 */
let getEmpresaFiscalDocOverride = null;

/** @internal testes */
export const __setGetEmpresaFiscalDocForTests = (fn) => {
  getEmpresaFiscalDocOverride = typeof fn === 'function' ? fn : null;
};

export const getEmpresaFiscalDoc = async (empresaId) => {
  if (getEmpresaFiscalDocOverride) {
    return getEmpresaFiscalDocOverride(empresaId);
  }
  const pool = getPgPool();
  const res = await pool.query(
    `SELECT cnpj FROM empresas WHERE id = $1 LIMIT 1`,
    [empresaId],
  );
  const cnpj = String(res.rows[0]?.cnpj ?? '').replace(/\D/g, '');
  return cnpj.length === 14 ? cnpj : null;
};

/** @internal testes — limpa dados de uma empresa/chave */
export const __deletePurchaseImportForTests = async (empresaId, chaveNfe) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const inv = await pool.query(
    `SELECT id FROM fiscal_purchase_invoices WHERE empresa_id = $1 AND chave_nfe = $2`,
    [empresaId, chaveNfe],
  );
  const invoiceId = inv.rows[0]?.id;
  if (!invoiceId) return;
  await pool.query(
    `DELETE FROM fiscal_stock_allocations WHERE stock_lot_id IN (
       SELECT l.id FROM fiscal_stock_lots l
       INNER JOIN fiscal_purchase_items i ON i.id = l.purchase_item_id
       WHERE i.purchase_invoice_id = $1
     )`,
    [invoiceId],
  );
  await pool.query(
    `DELETE FROM fiscal_stock_allocation_requests WHERE empresa_id = $1 AND id IN (
       SELECT DISTINCT allocation_request_uuid FROM fiscal_stock_allocations WHERE empresa_id = $1
     )`,
    [empresaId],
  );
  await pool.query(
    `DELETE FROM fiscal_stock_lots WHERE purchase_item_id IN (
       SELECT id FROM fiscal_purchase_items WHERE purchase_invoice_id = $1
     )`,
    [invoiceId],
  );
  await pool.query(`DELETE FROM fiscal_purchase_items WHERE purchase_invoice_id = $1`, [invoiceId]);
  await pool.query(
    `DELETE FROM fiscal_purchase_invoices WHERE id = $1 AND empresa_id = $2`,
    [invoiceId, empresaId],
  );
};
