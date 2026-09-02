/**
 * Catálogo CFOP para UX de cadastro fiscal.
 * Fonte: Anexo II do Convênio s/n de 1970 (tabela vigente Portal Nacional NF-e).
 * Referência complementar de descrição: tabelas estaduais (ex.: SEFAZ-PE).
 * NÃO inferir CSOSN/ST/tributação a partir do CFOP.
 */
import rawCatalog from './cfopCatalog.generated.json'

export type CfopDirection = 'INBOUND' | 'OUTBOUND'
export type CfopScope = 'INTERNAL' | 'INTERSTATE' | 'FOREIGN'

export type CfopEntry = {
  code: string
  description: string
  application: string
  direction: CfopDirection
  scope: CfopScope
}

export const CFOP_CATALOG: CfopEntry[] = rawCatalog as CfopEntry[]

const CFOP_BY_CODE = new Map(CFOP_CATALOG.map((entry) => [entry.code, entry]))

export function inferCfopMetaFromCode(code: string): Pick<CfopEntry, 'direction' | 'scope'> | null {
  const normalized = String(code ?? '').replace(/\D/g, '').slice(0, 4)
  if (normalized.length !== 4) return null
  const first = normalized[0]
  switch (first) {
    case '1':
      return { direction: 'INBOUND', scope: 'INTERNAL' }
    case '2':
      return { direction: 'INBOUND', scope: 'INTERSTATE' }
    case '3':
      return { direction: 'INBOUND', scope: 'FOREIGN' }
    case '5':
      return { direction: 'OUTBOUND', scope: 'INTERNAL' }
    case '6':
      return { direction: 'OUTBOUND', scope: 'INTERSTATE' }
    case '7':
      return { direction: 'OUTBOUND', scope: 'FOREIGN' }
    default:
      return null
  }
}

function resolveCfopMeta(code: string): Pick<CfopEntry, 'direction' | 'scope'> | null {
  return getCfopByCode(code) ?? inferCfopMetaFromCode(code)
}

export function formatCfopOptionLabel(entry: CfopEntry): string {
  return `${entry.code} - ${entry.description}`
}

export function getCfopByCode(code: string | null | undefined): CfopEntry | undefined {
  const normalized = String(code ?? '').replace(/\D/g, '').slice(0, 4)
  if (normalized.length !== 4) return undefined
  return CFOP_BY_CODE.get(normalized)
}

export function mapOperationScopeToCfopScope(operationScope: string): CfopScope | null {
  switch (operationScope) {
    case 'INTERNAL':
      return 'INTERNAL'
    case 'INTERSTATE':
      return 'INTERSTATE'
    case 'FOREIGN':
      return 'FOREIGN'
    default:
      return null
  }
}

export function labelCfopScope(scope: CfopScope): string {
  switch (scope) {
    case 'INTERNAL':
      return 'dentro do estado'
    case 'INTERSTATE':
      return 'interestadual'
    case 'FOREIGN':
      return 'exterior'
    default:
      return scope
  }
}

export type CfopSearchFilters = {
  operationScope?: string
  /** Prioriza CFOPs compatíveis com a abrangência, sem ocultar os demais. */
  preferMatchingScope?: boolean
  limit?: number
}

export function searchCfopOptions(query: string, filters: CfopSearchFilters = {}): CfopEntry[] {
  const limit = filters.limit ?? 80
  const q = query.trim().toLowerCase()
  let results = CFOP_CATALOG

  const expectedScope = filters.operationScope
    ? mapOperationScopeToCfopScope(filters.operationScope)
    : null

  if (expectedScope && filters.preferMatchingScope !== false) {
    const matching = results.filter((entry) => entry.scope === expectedScope)
    const others = results.filter((entry) => entry.scope !== expectedScope)
    results = [...matching, ...others]
  }

  if (!q) return results.slice(0, limit)

  const tokens = q.split(/\s+/).filter(Boolean)
  return results
    .filter((entry) => {
      const haystack = `${entry.code} ${entry.description} ${entry.application}`.toLowerCase()
      return tokens.every((token) => haystack.includes(token))
    })
    .slice(0, limit)
}

export type CfopStructuralValidation = {
  valid: boolean
  severity: 'ok' | 'warn' | 'error'
  message: string | null
}

/**
 * Validação estrutural apenas — não decide tributação.
 */
export function validateCfopStructuralCompatibility(
  cfopCode: string,
  operationScope: string,
): CfopStructuralValidation {
  const entry = getCfopByCode(cfopCode)
  const meta = resolveCfopMeta(cfopCode)
  if (!meta) {
    return {
      valid: false,
      severity: 'error',
      message: entry
        ? 'CFOP inválido.'
        : 'CFOP não encontrado na tabela vigente.',
    }
  }

  const expectedScope = mapOperationScopeToCfopScope(operationScope)
  if (!expectedScope) {
    return { valid: true, severity: 'ok', message: null }
  }

  if (meta.scope !== expectedScope) {
    return {
      valid: false,
      severity: 'error',
      message: `CFOP ${cfopCode.replace(/\D/g, '').slice(0, 4)} é ${labelCfopScope(meta.scope)}, mas o cenário está como ${labelCfopScope(expectedScope)}.`,
    }
  }

  if (meta.direction === 'INBOUND') {
    return {
      valid: false,
      severity: 'error',
      message: `CFOP ${cfopCode.replace(/\D/g, '').slice(0, 4)} indica entrada (1xxx/2xxx/3xxx). Para saída use 5xxx, 6xxx ou 7xxx conforme a abrangência.`,
    }
  }

  return { valid: true, severity: 'ok', message: null }
}
