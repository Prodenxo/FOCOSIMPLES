export type AccountantRuleStatus = 'DRAFT' | 'APPROVED' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED'

export type ProductFiscalUiStatus = 'READY' | 'PENDENTE' | 'INCOMPLETO' | 'BLOQUEADO'

export type FiscalConfigurationReadiness =
  | 'READY'
  | 'PARTIAL'
  | 'INCOMPLETE'
  | 'CONFLICT'

export type PisCofinsCalculationMode =
  | 'NT'
  | 'OUTR_ZERO'
  | 'ALIQ_PERCENT'
  | 'QTDE'

export type PisCofinsConfig = {
  cst?: string
  calculationMode?: PisCofinsCalculationMode
  rate?: string | number
  percentual?: string | number
  pPIS?: string | number
  pCOFINS?: string | number
}

export type ApprovedFiscalResult = {
  cfop?: string
  csosn?: string
  icmsGroup?: string
  currentOperationSt?: string
  stParameters?: Record<string, unknown>
  pis?: PisCofinsConfig
  cofins?: PisCofinsConfig
}

export type AccountantApprovedRule = {
  id: string
  tenantId: string
  version: number
  establishmentId?: string | null
  status: AccountantRuleStatus
  conditions: Record<string, unknown[]>
  approvedResult: ApprovedFiscalResult
  validFrom?: string
  validUntil?: string | null
  name?: string | null
  description?: string | null
  configuredBy?: string
  configuredAt?: string
  approvedBy?: string | null
  approvedAt?: string | null
  justification?: string | null
  sourceLegalReference?: string | null
  legalSourceRefs?: unknown[]
}

export type CompanyFiscalProfile = {
  id?: string
  tenantId?: string
  establishmentId?: string
  crt?: number
  taxRegime?: string
  issuerUf?: string
  stateRegistration?: string
  status?: string
}

export type ProductFiscalProfile = {
  id?: string
  tenantId?: string
  productId?: string
  ncm?: string
  cest?: string
  itemSource?: string
  status?: string
}

export type FiscalProductGroup = {
  id: string
  tenantId: string
  name: string
  description?: string | null
  status: 'ACTIVE' | 'SUSPENDED'
}

export type FiscalProductGroupMembership = {
  id: string
  productId: string
  fiscalProductGroupId: string
}

export type RulePreviewResult = {
  validation?: { ok?: boolean; issues?: Array<{ code?: string; message?: string }> }
  capability?: {
    executable?: boolean
    issues?: Array<{ code?: string; message?: string }>
    supportedCapabilities?: string[]
  }
  supported?: boolean
  warnings?: string[]
}

export type FiscalReadinessResponse = {
  readiness?: FiscalConfigurationReadiness
  trafficLight?: string
  missingFacts?: string[]
  issues?: Array<{ code?: string; message?: string }>
  tenantId?: string
}

export type FiscalProductListRow = {
  productId: string
  descricao: string
  codigo: string
  ncm: string
  cest: string
  unidade: string
  grupoFiscalId: string | null
  grupoFiscalNome: string | null
  fiscalStatus: ProductFiscalUiStatus
  ruleId: string | null
  ruleStatus: AccountantRuleStatus | null
  updatedAt: string | null
}

export type ProductFiscalConfigForm = {
  origemMercadoria: string
  itemSource: string
  priorStStatus: string
  operationType: string
  /** Condição de aplicação — derivada de scenarioApplies (uso interno / CFOP). */
  operationScope: string
  /** @deprecated UI — preenchido pelo estabelecimento; não editável. */
  issuerUf: string
  /** @deprecated UI — omitido em regras genéricas. */
  destinationUf: string
  /** Quando a regra se aplica (condição, não dado fixo do produto). */
  scenarioApplies: 'INTERNAL' | 'INTERSTATE_ANY' | 'INTERSTATE_UF' | 'FOREIGN'
  /** UF destino explícita — somente quando scenarioApplies = INTERSTATE_UF. */
  specificDestinationUf: string
  restrictRecipientTaxpayer: boolean
  restrictFinalConsumer: boolean
  recipientTaxpayerStatus: string
  recipientFinalConsumer: string
  cfop: string
  csosn: string
  icmsGroup: string
  currentOperationSt: string
  pisCst: string
  pisCalculationMode: PisCofinsCalculationMode
  pisPercentual: string
  cofinsCst: string
  cofinsCalculationMode: PisCofinsCalculationMode
  cofinsPercentual: string
  fiscalProductGroupId: string
  name: string
  description: string
  sourceLegalReference: string
}

export class FiscalConfigurationApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly permission?: string
  readonly issues?: Array<{ code?: string; message?: string }>

  constructor(
    message: string,
    status: number,
    code?: string,
    permission?: string,
    issues?: Array<{ code?: string; message?: string }>,
  ) {
    super(message)
    this.name = 'FiscalConfigurationApiError'
    this.status = status
    this.code = code
    this.permission = permission
    this.issues = issues
  }
}
