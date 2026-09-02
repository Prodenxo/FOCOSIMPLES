import { readNfeCatalogProdutoMetadata } from '../nfeCatalogProdutoMetadata'
import {
  defaultScenarioName,
  parseScenarioAppliesFromRuleConditions,
  scenarioAppliesToOperationScope,
  syncFormEstablishmentContext,
} from './scenarioApplicationUi'
import type {
  AccountantApprovedRule,
  CompanyFiscalProfile,
  ProductFiscalConfigForm,
  ProductFiscalProfile,
} from './types'

const first = (values: unknown[] | undefined, fallback = ''): string => {
  if (!Array.isArray(values) || values.length === 0) return fallback
  return String(values[0] ?? fallback)
}

export function emptyProductFiscalConfigForm(
  establishmentIssuerUf = '',
): ProductFiscalConfigForm {
  const issuerUf = String(establishmentIssuerUf ?? '').trim().toUpperCase().slice(0, 2)
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
  }
}

export function ruleToForm(
  rule: AccountantApprovedRule | null,
  companyProfile: CompanyFiscalProfile | null,
  productProfile: ProductFiscalProfile | null,
  fiscalProductGroupId: string | null,
): ProductFiscalConfigForm {
  const issuerUf = companyProfile?.issuerUf ?? ''
  let base = emptyProductFiscalConfigForm(issuerUf)
  if (!rule) {
    if (productProfile?.itemSource) base.itemSource = productProfile.itemSource
    if (fiscalProductGroupId) base.fiscalProductGroupId = fiscalProductGroupId
    return syncFormEstablishmentContext(base, issuerUf)
  }

  const conditions = rule.conditions ?? {}
  const result = rule.approvedResult ?? {}
  const parsed = parseScenarioAppliesFromRuleConditions(conditions)
  const recipientTaxpayer = first(conditions.recipientTaxpayerStatus as unknown[] | undefined, 'UNKNOWN')
  const recipientConsumer = first(conditions.recipientFinalConsumer as unknown[] | undefined, 'UNKNOWN')

  base = {
    ...base,
    origemMercadoria: first(conditions.origem as unknown[] | undefined, base.origemMercadoria),
    itemSource: first(conditions.itemSource as unknown[] | undefined, productProfile?.itemSource ?? base.itemSource),
    priorStStatus: first(conditions.priorStStatus as unknown[] | undefined, base.priorStStatus),
    operationType: first(conditions.operationType as unknown[] | undefined, base.operationType),
    scenarioApplies: parsed.scenarioApplies,
    specificDestinationUf: parsed.specificDestinationUf,
    operationScope: scenarioAppliesToOperationScope(parsed.scenarioApplies),
    destinationUf: parsed.specificDestinationUf,
    restrictRecipientTaxpayer: recipientTaxpayer !== 'UNKNOWN' && recipientTaxpayer !== '',
    restrictFinalConsumer: recipientConsumer !== 'UNKNOWN' && recipientConsumer !== '',
    recipientTaxpayerStatus: recipientTaxpayer,
    recipientFinalConsumer: recipientConsumer,
    cfop: String(result.cfop ?? ''),
    csosn: String(result.csosn ?? ''),
    icmsGroup: deriveIcmsGroupFromCsosn(String(result.csosn ?? '')),
    currentOperationSt: String(result.currentOperationSt ?? base.currentOperationSt),
    pisCst: String(result.pis?.cst ?? base.pisCst),
    pisCalculationMode: (result.pis?.calculationMode as ProductFiscalConfigForm['pisCalculationMode']) ?? base.pisCalculationMode,
    pisPercentual: String(
      result.pis?.pPIS ?? result.pis?.rate ?? result.pis?.percentual ?? base.pisPercentual,
    ),
    cofinsCst: String(result.cofins?.cst ?? base.cofinsCst),
    cofinsCalculationMode: (result.cofins?.calculationMode as ProductFiscalConfigForm['cofinsCalculationMode']) ?? base.cofinsCalculationMode,
    cofinsPercentual: String(
      result.cofins?.pCOFINS ?? result.cofins?.rate ?? result.cofins?.percentual ?? base.cofinsPercentual,
    ),
    fiscalProductGroupId: first(conditions.fiscalProductGroupId as unknown[] | undefined, fiscalProductGroupId ?? ''),
    name: rule.name ?? defaultScenarioName(parsed.scenarioApplies, parsed.specificDestinationUf),
    description: rule.description ?? '',
    sourceLegalReference: rule.sourceLegalReference ?? '',
  }

  return syncFormEstablishmentContext(base, issuerUf)
}

export function formToRuleDraft(
  form: ProductFiscalConfigForm,
  options: {
    productId: string
    establishmentId: string
    establishmentIssuerUf?: string | null
    crt?: number
    ncm?: string
    ruleId?: string | null
    version?: number
  },
): Partial<AccountantApprovedRule> {
  const synced = syncFormEstablishmentContext(form, options.establishmentIssuerUf)
  const scenarioApplies = synced.scenarioApplies ?? 'INTERNAL'
  const operationScope = scenarioAppliesToOperationScope(scenarioApplies)

  const conditions: Record<string, unknown[]> = {
    crt: [options.crt ?? 1],
    productId: [options.productId],
    operationType: [synced.operationType],
    operationScope: [operationScope],
    itemSource: [synced.itemSource],
    priorStStatus: [synced.priorStStatus],
    origem: [synced.origemMercadoria],
  }

  if (scenarioApplies === 'INTERSTATE_UF' && synced.specificDestinationUf.trim().length === 2) {
    conditions.destinationUf = [synced.specificDestinationUf.trim().toUpperCase()]
  }

  if (synced.restrictRecipientTaxpayer && synced.recipientTaxpayerStatus !== 'UNKNOWN') {
    conditions.recipientTaxpayerStatus = [synced.recipientTaxpayerStatus]
  }
  if (synced.restrictFinalConsumer && synced.recipientFinalConsumer !== 'UNKNOWN') {
    conditions.recipientFinalConsumer = [synced.recipientFinalConsumer]
  }

  if (options.ncm) {
    conditions.ncm = [options.ncm.replace(/\D/g, '').slice(0, 8)]
  }

  const buildPisCofinsBlock = (
    cst: string,
    calculationMode: ProductFiscalConfigForm['pisCalculationMode'],
    percentual: string,
    tax: 'pis' | 'cofins',
  ) => {
    const block: Record<string, string> = {
      cst: cst.replace(/\D/g, '').slice(0, 2),
      calculationMode,
    }
    if (calculationMode === 'OUTR_ZERO' || calculationMode === 'ALIQ_PERCENT') {
      block[tax === 'pis' ? 'pPIS' : 'pCOFINS'] = percentual
    }
    return block
  }

  const csosn = synced.csosn.replace(/\D/g, '').slice(0, 3)
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
  }

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
  }
}

export function readCatalogNcmCest(metadataJson: unknown): { ncm: string; cest: string; unidade: string } {
  const meta = readNfeCatalogProdutoMetadata(metadataJson)
  return {
    ncm: meta.ncm ?? '',
    cest: meta.cest ?? '',
    unidade: meta.unidade ?? 'UN',
  }
}

/** Grupo XML ICMS derivado do CSOSN — não confundir com o código CSOSN. */
export function deriveIcmsGroupFromCsosn(csosn: string): string {
  const code = String(csosn ?? '').replace(/\D/g, '').slice(0, 3)
  return code ? `ICMSSN${code}` : ''
}

/** Valor exibido no formulário — sempre derivado do CSOSN atual. */
export function displayIcmsGroupForForm(form: Pick<ProductFiscalConfigForm, 'csosn'>): string {
  return deriveIcmsGroupFromCsosn(form.csosn)
}

export function patchCsosnWithDerivedIcmsGroup(
  csosn: string,
): Partial<ProductFiscalConfigForm> {
  return {
    csosn,
    icmsGroup: deriveIcmsGroupFromCsosn(csosn),
  }
}

export function shouldShowStFields(form: ProductFiscalConfigForm): boolean {
  const csosn = form.csosn.replace(/\D/g, '')
  const stDue = ['201', '202', '203', '500'].includes(csosn)
  const retained = form.priorStStatus === 'RETAINED'
  return stDue || retained || form.currentOperationSt === 'DUE_BY_ISSUER'
}
