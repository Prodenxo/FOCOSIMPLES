/**
 * Monta FiscalContext v3.1 a partir de inputs de operação/emissão.
 * Não executa resolução tributária — apenas normaliza o contexto.
 */
import { ENGINE_SCHEMA_VERSION } from '../constants.js';
import { buildFiscalEngineMetadata } from '../types/nfe-technical-profile.js';
import { normalizeEstablishmentIdFromEmitenteCpfCnpj } from '../establishment/fiscal-establishment-id.js';
import { normalizeCrt, getCrtProfile } from '../types/crt.js';
import {
  ITEM_SOURCE,
  normalizeItemSource,
  parseItemSourceHint,
  PERSON_TYPE,
  ICMS_TAXPAYER_STATUS,
  deriveIndIeDest,
} from '../types/item-source.js';
import { normalizeOrigemMercadoriaCode } from '../types/origem-mercadoria.js';
import { PRIOR_ST_STATUS } from '../types/st-allocation.js';
import { toDecimal } from '../money/decimal.js';
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);
const normalizeUf = (value) => String(value ?? '').trim().toUpperCase().slice(0, 2);

/**
 * @typedef {object} BuildFiscalContextInput
 * @property {string} [decisionId]
 * @property {string | Date} [dataOperacao]
 * @property {object} [emitente]
 * @property {object} [destinatario]
 * @property {object} [produto]
 * @property {object} [item]
 * @property {object} [estoque]
 * @property {object} [operacao]
 * @property {object} [nfeTechnicalProfileOverrides]
 */

/**
 * @param {BuildFiscalContextInput} input
 */
export const buildFiscalContextV31 = (input = {}) => {
  const emitenteRaw = input.emitente && typeof input.emitente === 'object' ? input.emitente : {};
  const destRaw = input.destinatario && typeof input.destinatario === 'object' ? input.destinatario : {};
  const produtoRaw = input.produto && typeof input.produto === 'object' ? input.produto : {};
  const itemRaw = input.item && typeof input.item === 'object' ? input.item : {};
  const estoqueRaw = input.estoque && typeof input.estoque === 'object' ? input.estoque : {};
  const operacaoRaw = input.operacao && typeof input.operacao === 'object' ? input.operacao : {};

  const crt = normalizeCrt(emitenteRaw.crt ?? emitenteRaw.CRT) ?? null;
  const crtProfile = crt ? getCrtProfile(crt) : null;

  const doc = onlyDigits(destRaw.cpfCnpj ?? destRaw.destinatarioDoc, 14);
  const personType = doc.length === 11
    ? PERSON_TYPE.PF
    : (doc.length === 14 ? PERSON_TYPE.PJ : PERSON_TYPE.UNKNOWN);

  const icmsTaxpayerStatus = String(
    destRaw.icmsTaxpayerStatus ?? destRaw.icms_taxpayer_status ?? ICMS_TAXPAYER_STATUS.UNKNOWN,
  ).toUpperCase();

  const indIEDest = destRaw.indIEDest
    ?? destRaw.indicadorInscricaoEstadual
    ?? deriveIndIeDest(
      /** @type {import('../types/item-source.js').IcmsTaxpayerStatus} */ (icmsTaxpayerStatus),
      destRaw.inscricaoEstadual,
    );

  const itemSourceHint = parseItemSourceHint(itemRaw.itemSourceHint ?? itemRaw.businessTypeHint);
  const itemSource = normalizeItemSource(
    itemRaw.itemSource ?? itemSourceHint ?? ITEM_SOURCE.UNKNOWN,
  );

  const dataOperacao = input.dataOperacao instanceof Date
    ? input.dataOperacao.toISOString().slice(0, 10)
    : String(input.dataOperacao || new Date().toISOString().slice(0, 10)).slice(0, 10);

  const qty = toDecimal(itemRaw.quantidade ?? 1);
  const vu = toDecimal(itemRaw.valorUnitario ?? 0);
  const vt = itemRaw.valorTotal != null
    ? toDecimal(itemRaw.valorTotal)
    : qty.times(vu);

  const emitenteUf = normalizeUf(
    emitenteRaw.uf ?? emitenteRaw.endereco?.estado ?? emitenteRaw.endereco?.uf,
  );
  const emitenteCnpj = onlyDigits(emitenteRaw.cpfCnpj ?? emitenteRaw.cnpj ?? emitenteRaw.document, 14) || null;
  const establishmentId = emitenteRaw.establishmentId
    ?? normalizeEstablishmentIdFromEmitenteCpfCnpj(emitenteCnpj)
    ?? null;
  const destUf = normalizeUf(
    destRaw.uf ?? destRaw.endereco?.estado ?? destRaw.endereco?.uf,
  );

  const localizacao = !emitenteUf || !destUf
    ? 'UNKNOWN'
    : (emitenteUf === destUf ? 'INTERNA' : 'INTERESTADUAL');

  const issues = [];

  if (!crt) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'CRT do emitente é obrigatório no Fiscal Engine v3.1.'));
  }

  if (itemSource === 'UNKNOWN') {
    issues.push(createFiscalIssue('ITEM_SOURCE_UNKNOWN', 'itemSource não confirmado (OWN_PRODUCTION / THIRD_PARTY).'));
  }

  const priorStStatus = String(estoqueRaw.priorStStatus ?? PRIOR_ST_STATUS.UNKNOWN).toUpperCase();
  if (!Object.values(PRIOR_ST_STATUS).includes(priorStStatus)) {
    issues.push(createFiscalIssue('PRIOR_ST_UNKNOWN', 'priorStStatus inválido.'));
  }

  const context = {
    decisionId: input.decisionId || null,
    engineSchemaVersion: ENGINE_SCHEMA_VERSION,
    metadata: buildFiscalEngineMetadata(input.nfeTechnicalProfileOverrides),
    dataOperacao,

    emitente: {
      crt,
      crtProfile,
      regimeDerivado: emitenteRaw.regimeTributario ?? emitenteRaw.regime_derivado ?? null,
      uf: emitenteUf || null,
      cnae: emitenteRaw.cnae ? String(emitenteRaw.cnae) : null,
      inscricaoEstadual: emitenteRaw.inscricaoEstadual ?? null,
      businessTypeHint: emitenteRaw.businessTypeHint ?? emitenteRaw.businessType ?? null,
      cpfCnpj: emitenteCnpj,
      establishmentId,
    },

    destinatario: {
      uf: destUf || null,
      personType,
      icmsTaxpayerStatus,
      consumidorFinal: destRaw.consumidorFinal ?? null,
      inscricaoEstadual: destRaw.inscricaoEstadual ?? null,
      indIEDest,
      cpfCnpj: doc || null,
    },

    produto: {
      ncm: onlyDigits(produtoRaw.ncm, 8),
      descricao: String(produtoRaw.descricao ?? '').trim(),
      gtin: produtoRaw.gtin ?? null,
      unidade: produtoRaw.unidade ?? 'UN',
      /** Sugestão UI — nunca usada como origem fiscal sem confirmação */
      defaultOrigemMercadoria: produtoRaw.defaultOrigemMercadoria != null
        ? normalizeOrigemMercadoriaCode(produtoRaw.defaultOrigemMercadoria)
        : null,
      defaultCest: produtoRaw.defaultCest ? onlyDigits(produtoRaw.defaultCest, 7) : null,
    },

    item: {
      itemSource,
      itemSourceHint,
      quantidade: formatFieldByPolicy(qty, 'qCom', dataOperacao),
      valorUnitario: formatFieldByPolicy(vu, 'vUnCom', dataOperacao),
      valorTotal: formatFieldByPolicy(vt, 'vProd', dataOperacao),
    },

    estoque: {
      stockLotId: estoqueRaw.stockLotId ?? null,
      origemMercadoria: normalizeOrigemMercadoriaCode(estoqueRaw.origemMercadoria),
      priorStStatus,
      priorStEvidence: estoqueRaw.priorStEvidence ?? null,
      purchaseInvoiceId: estoqueRaw.purchaseInvoiceId ?? null,
      purchaseItemId: estoqueRaw.purchaseItemId ?? null,
      stRetainedAllocation: estoqueRaw.stRetainedAllocation ?? null,
    },

    operacao: {
      tipo: String(operacaoRaw.tipo ?? 'VENDA').toUpperCase(),
      natureza: String(operacaoRaw.natureza ?? 'SAIDA').toUpperCase(),
      localizacao,
      presencialidade: operacaoRaw.presencialidade ?? null,
      intermediador: operacaoRaw.intermediador ?? null,
      finalidadeNfe: operacaoRaw.finalidadeNfe ?? null,
    },

    /** Issues de contexto (pré-resolvers) */
    contextIssues: issues,
  };

  if (context.estoque.origemMercadoria === 'UNKNOWN') {
    issues.push(createFiscalIssue('ORIGIN_UNKNOWN', 'Origem da mercadoria não confirmada no lote/aquisição.'));
  }

  if (icmsTaxpayerStatus === ICMS_TAXPAYER_STATUS.UNKNOWN) {
    issues.push(createFiscalIssue(
      'ICMS_TAXPAYER_STATUS_UNKNOWN',
      'Status de contribuinte ICMS do destinatário não informado.',
    ));
  }

  return context;
};
