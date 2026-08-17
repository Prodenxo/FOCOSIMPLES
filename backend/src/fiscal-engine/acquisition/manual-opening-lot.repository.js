/**
 * Repositório Postgres — lote fiscal inicial manual (Phase 8F.5).
 */
import { randomUUID } from 'node:crypto';
import { getPgPool } from '../../config/pg.js';
import { formatDecimal, toDecimal } from '../money/decimal.js';
import { ensureFiscalPurchaseSchema, canAutoEnsureFiscalPurchaseSchema } from './fiscal-purchase.schema.js';
import { FISCAL_LOT_SOURCE, MANUAL_OPENING_REASON } from './manual-opening-lot.constants.js';
import { manualOpeningOrigemSource } from './manual-opening-lot.policy.js';
import { ORIGEM_FISCAL_SOURCE } from '../types/origem-mercadoria.js';
import { STOCK_LOT_STATUS } from './constants.js';
import {
  STOCK_UNIT_RESOLUTION_STATUS,
  STOCK_UNIT_SOURCE,
} from './stock-unit-resolution.js';

const QTY_SCALE = 10;

const maybeEnsureSchema = async () => {
  if (canAutoEnsureFiscalPurchaseSchema()) {
    await ensureFiscalPurchaseSchema();
  }
};

const jsonValue = (value) => JSON.stringify(value ?? {});

/**
 * @param {object} params
 */
export const findManualOpeningLotByConfirmationRequestId = async ({
  tenantId,
  establishmentId,
  confirmationRequestId,
}) => {
  if (!confirmationRequestId) return null;
  await maybeEnsureSchema();
  const pool = getPgPool();
  const res = await pool.query(
    `SELECT * FROM fiscal_stock_lots
     WHERE empresa_id = $1
       AND establishment_id = $2
       AND lot_source = $3
       AND manual_confirmation_json->>'confirmationRequestId' = $4
     LIMIT 1`,
    [tenantId, establishmentId, FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION, confirmationRequestId],
  );
  return res.rows[0] ?? null;
};

/**
 * @param {object} params
 */
export const insertManualOpeningLot = async ({
  tenantId,
  establishmentId,
  produtoCatalogoId,
  quantidade,
  origemMercadoria,
  priorStStatus,
  createdByUserId,
  observacao = null,
  confirmationRequestId = null,
  baseUnit = 'UN',
  dataEntrada = null,
}) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const qty = formatDecimal(toDecimal(quantidade), QTY_SCALE);
  const lotId = randomUUID();
  const entryDate = dataEntrada || new Date().toISOString().slice(0, 10);
  const manualConfirmationJson = {
    confirmedAt: new Date().toISOString(),
    reason: MANUAL_OPENING_REASON.OPENING_FISCAL_BALANCE,
    ...(observacao ? { note: String(observacao).slice(0, 2000) } : {}),
    ...(confirmationRequestId ? { confirmationRequestId: String(confirmationRequestId) } : {}),
  };

  const stockUnitResolution = {
    baseUnit,
    baseQty: qty,
    source: STOCK_UNIT_SOURCE.CATALOG_CONFIRMED,
    status: STOCK_UNIT_RESOLUTION_STATUS.CONFIRMED,
    unitConversionEvidence: { sameUnit: true, manualOpening: true, uCom: baseUnit, qCom: qty },
  };

  await pool.query(
    `INSERT INTO fiscal_stock_lots (
      id, empresa_id, establishment_id, produto_catalogo_id, purchase_item_id,
      lot_source, origem_mercadoria, origem_mercadoria_source, prior_st_status,
      prior_st_evidence_json, base_unit, quantidade_inicial, quantidade_disponivel,
      stock_unit_resolution_json, manual_confirmation_json, created_by_user_id,
      data_entrada, status, version
    ) VALUES (
      $1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
    )`,
    [
      lotId,
      tenantId,
      establishmentId,
      produtoCatalogoId,
      FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION,
      origemMercadoria,
      manualOpeningOrigemSource(),
      priorStStatus,
      jsonValue({
        manualOrigemConfirmed: true,
        origemSource: ORIGEM_FISCAL_SOURCE.MANUAL_FISCAL_CONFIRMATION,
        priorStConfirmedManually: true,
      }),
      baseUnit,
      qty,
      qty,
      jsonValue(stockUnitResolution),
      jsonValue(manualConfirmationJson),
      createdByUserId,
      entryDate,
      STOCK_LOT_STATUS.USABLE,
      0,
    ],
  );

  const saved = await pool.query(
    `SELECT * FROM fiscal_stock_lots WHERE id = $1 AND empresa_id = $2`,
    [lotId, tenantId],
  );
  return saved.rows[0];
};

/** @type {{ findByConfirmation?: Function, insert?: Function } | null} */
let memoryOverride = null;

/** @internal testes */
export const __setManualOpeningLotRepoForTests = (repo) => {
  memoryOverride = repo;
};

/** @internal testes */
export const __resetManualOpeningLotRepoForTests = () => {
  memoryOverride = null;
};

export const manualOpeningLotRepo = {
  findByConfirmationRequestId: (params) => (
    memoryOverride?.findByConfirmation
      ? memoryOverride.findByConfirmation(params)
      : findManualOpeningLotByConfirmationRequestId(params)
  ),
  insert: (params) => (
    memoryOverride?.insert
      ? memoryOverride.insert(params)
      : insertManualOpeningLot(params)
  ),
};
