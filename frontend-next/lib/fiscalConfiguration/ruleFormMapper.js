import { readNfeCatalogProdutoMetadata } from '@/lib/nfeCatalogProdutoMetadata';
import {
  defaultScenarioName,
  scenarioAppliesToOperationScope,
  syncFormEstablishmentContext,
} from '@/lib/fiscalConfiguration/scenarioApplicationUi';

const first = (values, fallback = '') => {
  if (!Array.isArray(values) || values.length === 0) return fallback;
  return String(values[0] ?? fallback);
};

export function emptyProductFiscalConfigForm(establishmentIssuerUf = '') {
  const issuerUf = String(establishmentIssuerUf ?? '').trim().toUpperCase().slice(0, 2);
  return {
    origemMercadoria: '0',
    itemSource: 'THIRD_PARTY',
    priorStStatus: 'UNKNOWN',
    operationType: 'VENDA',
    operationScope: 'INTERNAL',
    issuerUf,
    destinationUf: '',
    scenarioApplies: 'INTERNAL',
    specificDestinationUf: '',
    restrictRecipientTaxpayer: false,
    restrictFinalConsumer: false,
    recipientTaxpayerStatus: 'UNKNOWN',
    recipientFinalConsumer: 'UNKNOWN',
    cfop: '',
    csosn: '',
    icmsGroup: '',
    currentOperationSt: 'NOT_DUE',
    pisCst: '49',
    pisCalculationMode: 'OUTR_ZERO',
    pisPercentual: '0',
    cofinsCst: '49',
    cofinsCalculationMode: 'OUTR_ZERO',
    cofinsPercentual: '0',
    fiscalProductGroupId: '',
    name: defaultScenarioName('INTERNAL'),
    description: '',
    sourceLegalReference: '',
  };
}

export function deriveIcmsGroupFromCsosn(csosn) {
  const code = String(csosn ?? '').replace(/\D/g, '').slice(0, 3);
  return code ? `ICMSSN${code}` : '';
}

export function formToRuleDraft(form, options) {
  const synced = syncFormEstablishmentContext(form, options.establishmentIssuerUf);
  const scenarioApplies = synced.scenarioApplies ?? 'INTERNAL';
  const operationScope = scenarioAppliesToOperationScope(scenarioApplies);

  const conditions = {
    crt: [options.crt ?? 1],
    productId: [options.productId],
    operationType: [synced.operationType],
    operationScope: [operationScope],
    itemSource: [synced.itemSource],
    priorStStatus: [synced.priorStStatus],
    origem: [synced.origemMercadoria],
  };

  if (scenarioApplies === 'INTERSTATE_UF' && synced.specificDestinationUf.trim().length === 2) {
    conditions.destinationUf = [synced.specificDestinationUf.trim().toUpperCase()];
  }

  if (synced.restrictRecipientTaxpayer && synced.recipientTaxpayerStatus !== 'UNKNOWN') {
    conditions.recipientTaxpayerStatus = [synced.recipientTaxpayerStatus];
  }
  if (synced.restrictFinalConsumer && synced.recipientFinalConsumer !== 'UNKNOWN') {
    conditions.recipientFinalConsumer = [synced.recipientFinalConsumer];
  }

  if (options.ncm) {
    conditions.ncm = [options.ncm.replace(/\D/g, '').slice(0, 8)];
  }

  const buildPisCofinsBlock = (cst, calculationMode, percentual, tax) => {
    const block = {
      cst: cst.replace(/\D/g, '').slice(0, 2),
      calculationMode,
    };
    if (calculationMode === 'OUTR_ZERO' || calculationMode === 'ALIQ_PERCENT') {
      block[tax === 'pis' ? 'pPIS' : 'pCOFINS'] = percentual;
    }
    return block;
  };

  const csosn = synced.csosn.replace(/\D/g, '').slice(0, 3);
  const approvedResult = {
    cfop: synced.cfop.replace(/\D/g, '').slice(0, 4),
    csosn,
    icmsGroup: deriveIcmsGroupFromCsosn(csosn) || undefined,
    currentOperationSt: synced.currentOperationSt,
    pis: buildPisCofinsBlock(synced.pisCst, synced.pisCalculationMode, synced.pisPercentual, 'pis'),
    cofins: buildPisCofinsBlock(
      synced.cofinsCst,
      synced.cofinsCalculationMode,
      synced.cofinsPercentual,
      'cofins',
    ),
  };

  return {
    ...(options.ruleId ? { id: options.ruleId } : {}),
    version: options.version ?? 1,
    establishmentId: options.establishmentId.replace(/\D/g, ''),
    name: synced.name.trim() || defaultScenarioName(scenarioApplies, synced.specificDestinationUf),
    description: synced.description.trim() || undefined,
    sourceLegalReference: synced.sourceLegalReference.trim() || undefined,
    conditions,
    approvedResult,
    validFrom: new Date().toISOString().slice(0, 10),
  };
}

export function readCatalogNcmCest(metadataJson) {
  const meta = readNfeCatalogProdutoMetadata(metadataJson);
  return {
    ncm: meta.ncm ?? '',
    cest: meta.cest ?? '',
    unidade: meta.unidade ?? 'UN',
  };
}

export function ruleToForm(rule, companyProfile, productProfile, fiscalProductGroupId) {
  const issuerUf = companyProfile?.issuerUf ?? '';
  let base = emptyProductFiscalConfigForm(issuerUf);
  if (!rule) {
    if (productProfile?.itemSource) base.itemSource = productProfile.itemSource;
    if (fiscalProductGroupId) base.fiscalProductGroupId = fiscalProductGroupId;
    return syncFormEstablishmentContext(base, issuerUf);
  }
  const conditions = rule.conditions ?? {};
  const result = rule.approvedResult ?? {};
  const scope = String(conditions.operationScope?.[0] ?? 'INTERNAL');
  const destUf = String(conditions.destinationUf?.[0] ?? '').trim().toUpperCase();
  let scenarioApplies = 'INTERNAL';
  if (scope === 'FOREIGN') scenarioApplies = 'FOREIGN';
  else if (scope === 'INTERSTATE') {
    scenarioApplies = destUf.length === 2 ? 'INTERSTATE_UF' : 'INTERSTATE_ANY';
  }

  base = {
    ...base,
    origemMercadoria: first(conditions.origem, base.origemMercadoria),
    itemSource: first(conditions.itemSource, productProfile?.itemSource ?? base.itemSource),
    priorStStatus: first(conditions.priorStStatus, base.priorStStatus),
    operationType: first(conditions.operationType, base.operationType),
    scenarioApplies,
    specificDestinationUf: destUf,
    operationScope: scenarioAppliesToOperationScope(scenarioApplies),
    destinationUf: destUf,
    cfop: String(result.cfop ?? ''),
    csosn: String(result.csosn ?? ''),
    icmsGroup: deriveIcmsGroupFromCsosn(String(result.csosn ?? '')),
    currentOperationSt: String(result.currentOperationSt ?? base.currentOperationSt),
    pisCst: String(result.pis?.cst ?? base.pisCst),
    pisCalculationMode: result.pis?.calculationMode ?? base.pisCalculationMode,
    pisPercentual: String(result.pis?.pPIS ?? result.pis?.rate ?? base.pisPercentual),
    cofinsCst: String(result.cofins?.cst ?? base.cofinsCst),
    cofinsCalculationMode: result.cofins?.calculationMode ?? base.cofinsCalculationMode,
    cofinsPercentual: String(result.cofins?.pCOFINS ?? result.cofins?.rate ?? base.cofinsPercentual),
    fiscalProductGroupId: first(conditions.fiscalProductGroupId, fiscalProductGroupId ?? ''),
    name: rule.name ?? defaultScenarioName(scenarioApplies, destUf),
    description: rule.description ?? '',
    sourceLegalReference: rule.sourceLegalReference ?? '',
  };
  return syncFormEstablishmentContext(base, issuerUf);
}
