/**
 * Orquestra importação manual de XML NF-e de compra (Fase 2 hardening).
 * Não conectado à emissão / PlugNotas.
 */
import { parsePurchaseNfeXml } from './purchase-xml-parser.js';
import {
  buildPriorStEvidence,
  classifyPriorStFromIcmsGroups,
} from './acquisition-classifier.js';
import { matchPurchaseItemToCatalog } from './catalog-match.js';
import { buildStockLotFromPurchaseItem } from './stock-lot.service.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import {
  PURCHASE_XML_PARSER_VERSION,
  SIGNATURE_STATUS,
  CATALOG_MATCH_STATUS,
} from './constants.js';
import { validatePurchaseRecipient } from './purchase-recipient-validator.js';
import { resolveStockUnit, STOCK_UNIT_SOURCE } from './stock-unit-resolution.js';
import { extractCatalogUnitConversion } from './purchase-catalog.service.js';
import * as memoryRepo from './fiscal-purchase-memory.repository.js';
import * as pgRepo from './fiscal-purchase.repository.js';

const IMPORT_HARD_BLOCK_CODES = new Set([
  'PURCHASE_RECIPIENT_MISMATCH',
  'XML_INVALID',
  'PROTOCOL_DIGEST_MISMATCH',
]);

const importHardBlockedByIssues = (issues) => (
  (Array.isArray(issues) ? issues : []).some((issue) => (
    IMPORT_HARD_BLOCK_CODES.has(issue?.code)
  ))
);

/** @type {typeof pgRepo | typeof memoryRepo | null} */
let repoOverride = null;

/** @internal */
export const __setPurchaseRepoForTests = (repo) => {
  repoOverride = repo;
};

/** @internal */
export const __resetPurchaseRepoForTests = () => {
  repoOverride = null;
  memoryRepo.__resetFiscalPurchaseMemoryRepo();
};

const repo = () => repoOverride || pgRepo;

/**
 * @param {object} params
 */
export const importPurchaseNfeXml = async ({
  empresaId,
  xmlBuffer,
  empresaFiscalDoc = null,
  userId = null,
  catalogProducts = [],
  confirmedCatalogId = null,
  confirmedCatalogProduct = null,
  __testHooks = {},
}) => {
  if (!empresaId) throw new Error('empresaId obrigatório');

  const parsed = parsePurchaseNfeXml(xmlBuffer);
  const { header, items } = parsed;
  const issues = [];

  if (header.chaveCoherenceOk === false) {
    issues.push(createFiscalIssue(
      'XML_INVALID',
      `Chave NF-e incoerente com XML: ${header.parseWarnings.slice(-3).join('; ')}`,
    ));
  }

  if (header.protocolDigestOk === false) {
    issues.push(createFiscalIssue(
      'PROTOCOL_DIGEST_MISMATCH',
      header.parseWarnings.find((w) => w.includes('digVal')) || 'Digest do protocolo diverge da NF-e assinada',
    ));
  }

  let fiscalDoc = empresaFiscalDoc;
  if (!fiscalDoc) {
    fiscalDoc = await pgRepo.getEmpresaFiscalDoc(empresaId);
  }

  const recipientCheck = validatePurchaseRecipient({
    destinatarioDoc: header.destinatarioDoc,
    empresaFiscalDoc: fiscalDoc,
  });
  if (!recipientCheck.ok) {
    issues.push(recipientCheck.issue);
  }

  if (header.signatureStatus === SIGNATURE_STATUS.INVALID) {
    issues.push(createFiscalIssue(
      'XML_SIGNATURE_INVALID',
      header.signatureReason || 'Assinatura XML inválida',
      { meta: { signatureStatus: header.signatureStatus, reasonCode: header.signatureReasonCode } },
    ));
  } else if (header.signatureStatus === SIGNATURE_STATUS.UNVERIFIED) {
    issues.push(createFiscalIssue(
      'XML_SIGNATURE_UNVERIFIED',
      header.signatureReason || 'Autenticidade XML não confirmada',
      { meta: { signatureStatus: header.signatureStatus, reasonCode: header.signatureReasonCode } },
    ));
  }

  const existing = await repo().findInvoiceByChave(empresaId, header.chaveNfe);
  if (existing) {
    return {
      duplicate: true,
      invoice: existing.invoice,
      items: existing.items,
      lots: existing.lots,
      issues,
      blocked: importHardBlockedByIssues(issues),
    };
  }

  if (importHardBlockedByIssues(issues)) {
    return {
      duplicate: false,
      blocked: true,
      invoice: null,
      items: [],
      lots: [],
      issues,
    };
  }

  const dataEntrada = header.dhEmi
    ? String(header.dhEmi).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const manualCatalog = confirmedCatalogProduct || (
    confirmedCatalogId && catalogProducts.find((p) => p.id === confirmedCatalogId)
  );

  const purchaseItems = items.map((row) => {
    const classification = classifyPriorStFromIcmsGroups(row.parsedTax.icmsGroups);
    const priorStEvidence = buildPriorStEvidence(row.parsedTax, PURCHASE_XML_PARSER_VERSION);
    priorStEvidence.priorStStatus = classification.priorStStatus;

    let catalogMatch = matchPurchaseItemToCatalog(row, catalogProducts);
    if (confirmedCatalogId && manualCatalog) {
      catalogMatch = {
        status: CATALOG_MATCH_STATUS.MANUALLY_CONFIRMED,
        produtoCatalogoId: confirmedCatalogId,
        suggestions: catalogMatch.suggestions,
      };
    }

    const itemIssues = [];
    if (row.commercial.supplierCest) {
      itemIssues.push(createFiscalIssue(
        'SUPPLIER_CEST_EVIDENCE',
        'CEST do fornecedor registrado como evidência — não validado como definitivo',
        { meta: { supplierCest: row.commercial.supplierCest } },
      ));
    }

    const catalogConversion = manualCatalog
      ? extractCatalogUnitConversion(manualCatalog)
      : null;

    const stockUnitResolution = resolveStockUnit(row.commercial, {
      confirmedSource: catalogMatch.status === CATALOG_MATCH_STATUS.MANUALLY_CONFIRMED
        ? STOCK_UNIT_SOURCE.MANUAL_CONFIRMED
        : null,
      catalogUnitConversion: catalogConversion,
    });

    return {
      numero_item: row.numeroItem,
      c_prod: row.commercial.cProd,
      c_ean: row.commercial.cEAN,
      x_prod: row.commercial.xProd,
      ncm: row.commercial.ncm,
      supplier_cest: row.commercial.supplierCest,
      cfop_entrada: row.commercial.cfop,
      origem: row.commercial.origem,
      u_com: row.commercial.uCom,
      q_com: row.commercial.qCom,
      v_un_com: row.commercial.vUnCom,
      v_prod: row.commercial.vProd,
      c_ean_trib: row.commercial.cEANTrib,
      u_trib: row.commercial.uTrib,
      q_trib: row.commercial.qTrib,
      v_un_trib: row.commercial.vUnTrib,
      ind_tot: row.commercial.indTot,
      desconto: row.commercial.desconto,
      parsed_tax_json: row.parsedTax,
      prior_st_status: classification.priorStStatus,
      prior_st_evidence_json: priorStEvidence,
      catalog_match_status: catalogMatch.status,
      produto_catalogo_id: catalogMatch.produtoCatalogoId,
      unit_conversion_json: row.unitConversion,
      stock_unit_resolution_json: stockUnitResolution,
      issues_json: itemIssues,
    };
  });

  const lots = purchaseItems.map((pi) => buildStockLotFromPurchaseItem({
    empresaId,
    purchaseItem: pi,
    priorStEvidence: pi.prior_st_evidence_json,
    catalogMatch: {
      status: pi.catalog_match_status,
      produtoCatalogoId: pi.produto_catalogo_id,
    },
    authorizationStatus: header.authorizationStatus,
    eventStatus: header.eventStatus,
    signatureStatus: header.signatureStatus,
    stockUnitResolution: pi.stock_unit_resolution_json,
    dataEntrada,
    blockingIssues: issues,
  }));

  const invoice = {
    empresa_id: empresaId,
    chave_nfe: header.chaveNfe,
    inf_nfe_id: header.infNfeId,
    modelo: header.modelo,
    serie: header.serie,
    numero: header.numero,
    dh_emi: header.dhEmi,
    emitente_cnpj: header.emitenteCnpj,
    destinatario_doc: header.destinatarioDoc,
    document_status: header.documentStatus,
    authorization_status: header.authorizationStatus,
    event_status: header.eventStatus,
    signature_status: header.signatureStatus,
    protocolo_numero: header.protocolo?.nProt,
    protocolo_chave: header.protocolo?.chNFe,
    protocolo_cstat: header.protocolo?.cStat,
    xml_sha256: header.xmlSha256,
    parser_version: header.parserVersion,
    parse_status: 'PARSED',
    parse_warnings: header.parseWarnings,
    header_json: header,
  };

  if (__testHooks.failAfterInvoice) {
    throw new Error('ROLLBACK_TEST_HOOK');
  }

  const saved = await repo().savePurchaseImport({ invoice, items: purchaseItems, lots });

  const warningIssues = header.parseWarnings.map((w) => createFiscalIssue(
    'REQUIRED_FIELD_MISSING',
    w,
    { severity: 'WARNING', blocksEmission: false, overrideAllowed: false },
  ));

  return {
    duplicate: saved.duplicate,
    invoice: saved.invoice,
    items: saved.items,
    lots: saved.lots,
    issues: [...issues, ...warningIssues],
    blocked: importHardBlockedByIssues(issues),
  };
};

export const memoryRepository = memoryRepo;
