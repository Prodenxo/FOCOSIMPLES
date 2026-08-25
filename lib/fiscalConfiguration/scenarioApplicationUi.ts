import type { ProductFiscalConfigForm } from './types'

export type ScenarioAppliesKind =
  | 'INTERNAL'
  | 'INTERSTATE_ANY'
  | 'INTERSTATE_UF'
  | 'FOREIGN'

export function scenarioAppliesToOperationScope(kind: ScenarioAppliesKind): string {
  switch (kind) {
    case 'INTERNAL':
      return 'INTERNAL'
    case 'INTERSTATE_ANY':
    case 'INTERSTATE_UF':
      return 'INTERSTATE'
    case 'FOREIGN':
      return 'FOREIGN'
    default:
      return 'INTERNAL'
  }
}

export function defaultScenarioName(kind: ScenarioAppliesKind, specificUf = ''): string {
  switch (kind) {
    case 'INTERNAL':
      return 'Venda interna'
    case 'INTERSTATE_ANY':
      return 'Venda interestadual'
    case 'INTERSTATE_UF':
      return specificUf ? `Venda interestadual — ${specificUf}` : 'Venda interestadual (UF específica)'
    case 'FOREIGN':
      return 'Exportação / exterior'
    default:
      return 'Cenário fiscal'
  }
}

export function parseScenarioAppliesFromForm(form: ProductFiscalConfigForm): ScenarioAppliesKind {
  if (form.scenarioApplies) return form.scenarioApplies
  const scope = form.operationScope || 'INTERNAL'
  if (scope === 'FOREIGN') return 'FOREIGN'
  if (scope === 'INTERSTATE') {
    const dest = String(form.specificDestinationUf || form.destinationUf || '').trim()
    return dest.length === 2 ? 'INTERSTATE_UF' : 'INTERSTATE_ANY'
  }
  return 'INTERNAL'
}

export function parseScenarioAppliesFromRuleConditions(
  conditions: Record<string, unknown[]>,
): { scenarioApplies: ScenarioAppliesKind; specificDestinationUf: string } {
  const scope = String(conditions.operationScope?.[0] ?? 'INTERNAL')
  const destUf = String(conditions.destinationUf?.[0] ?? '').trim().toUpperCase()

  if (scope === 'FOREIGN') {
    return { scenarioApplies: 'FOREIGN', specificDestinationUf: '' }
  }
  if (scope === 'INTERSTATE') {
    if (destUf.length === 2) {
      return { scenarioApplies: 'INTERSTATE_UF', specificDestinationUf: destUf }
    }
    return { scenarioApplies: 'INTERSTATE_ANY', specificDestinationUf: '' }
  }
  return { scenarioApplies: 'INTERNAL', specificDestinationUf: '' }
}

export function applyScenarioAppliesPatch(
  patch: Partial<ProductFiscalConfigForm>,
  current: ProductFiscalConfigForm,
): Partial<ProductFiscalConfigForm> {
  const next = { ...current, ...patch }
  const kind = parseScenarioAppliesFromForm(next as ProductFiscalConfigForm)
  const operationScope = scenarioAppliesToOperationScope(kind)

  const result: Partial<ProductFiscalConfigForm> = {
    ...patch,
    scenarioApplies: kind,
    operationScope,
  }

  if (patch.scenarioApplies && !patch.name?.trim()) {
    result.name = defaultScenarioName(
      kind,
      next.specificDestinationUf || next.destinationUf,
    )
  }

  if (kind !== 'INTERSTATE_UF') {
    result.specificDestinationUf = ''
    result.destinationUf = ''
  }

  return result
}

export function syncFormEstablishmentContext(
  form: ProductFiscalConfigForm,
  establishmentIssuerUf?: string | null,
): ProductFiscalConfigForm {
  const issuerUf = String(establishmentIssuerUf ?? form.issuerUf ?? '').trim().toUpperCase().slice(0, 2)
  const kind = parseScenarioAppliesFromForm(form)
  return {
    ...form,
    issuerUf,
    operationScope: scenarioAppliesToOperationScope(kind),
    scenarioApplies: kind,
  }
}

export function summarizeScenarioApplication(form: ProductFiscalConfigForm): string {
  const kind = parseScenarioAppliesFromForm(form)
  const parts = [defaultScenarioName(kind, form.specificDestinationUf)]

  if (form.restrictRecipientTaxpayer && form.recipientTaxpayerStatus !== 'UNKNOWN') {
    parts.push('destinatário restrito')
  }
  if (form.restrictFinalConsumer && form.recipientFinalConsumer !== 'UNKNOWN') {
    parts.push('consumidor restrito')
  }

  return parts.join(' · ')
}
