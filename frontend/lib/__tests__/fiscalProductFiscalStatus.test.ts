import {
  deriveProductFiscalUiStatus,
  findRulesForProductAtEstablishment,
  resolveEstablishmentSelection,
  ruleMatchesEstablishment,
} from '@/lib/fiscalConfiguration/productFiscalStatus'
import type { AccountantApprovedRule } from '@/lib/fiscalConfiguration/types'

const baseRule = (overrides: Partial<AccountantApprovedRule>): AccountantApprovedRule => ({
  id: 'rule-1',
  tenantId: 'tenant-1',
  version: 1,
  status: 'DRAFT',
  conditions: { productId: ['prod-1'] },
  approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
  ...overrides,
})

describe('productFiscalStatus', () => {
  it('não vaza regra de outro establishment', () => {
    const rule = baseRule({ establishmentId: '11111111000111' })
    expect(ruleMatchesEstablishment(rule, '22222222000122')).toBe(false)
    expect(ruleMatchesEstablishment(rule, '11111111000111')).toBe(true)
  })

  it('READY quando regra APPROVED existe para produto e CNPJ', () => {
    const rules = [
      baseRule({
        status: 'APPROVED',
        establishmentId: '35774511000145',
        conditions: { productId: ['47090301-dd7e-45df-bfdc-50767c04ba48'] },
      }),
    ]
    const matched = findRulesForProductAtEstablishment(
      rules,
      '47090301-dd7e-45df-bfdc-50767c04ba48',
      null,
      '35774511000145',
    )
    expect(deriveProductFiscalUiStatus(matched, null)).toBe('READY')
  })

  it('PENDENTE sem regra', () => {
    expect(deriveProductFiscalUiStatus([], null)).toBe('PENDENTE')
  })

  it('BLOQUEADO quando preview indica capability não executável', () => {
    const rules = [baseRule({ status: 'DRAFT' })]
    expect(
      deriveProductFiscalUiStatus(rules, {
        capability: { executable: false, issues: [{ message: 'bloqueado' }] },
      }),
    ).toBe('BLOQUEADO')
  })

  it('INCOMPLETO para DRAFT sem bloqueio', () => {
    const rules = [baseRule({ status: 'DRAFT' })]
    expect(deriveProductFiscalUiStatus(rules, { capability: { executable: true } })).toBe('INCOMPLETO')
  })

  it('resolveEstablishmentSelection preserva CNPJ válido após reload', () => {
    const establishments = [
      { establishmentId: '35774511000145' },
      { establishmentId: '11111111000111' },
    ]
    expect(resolveEstablishmentSelection('35774511000145', establishments)).toBe('35774511000145')
    expect(resolveEstablishmentSelection('35.774.511/0001-45', establishments)).toBe('35774511000145')
  })

  it('resolveEstablishmentSelection cai no primeiro CNPJ quando atual é inválido', () => {
    const establishments = [
      { establishmentId: '35774511000145' },
      { establishmentId: '11111111000111' },
    ]
    expect(resolveEstablishmentSelection('', establishments)).toBe('35774511000145')
    expect(resolveEstablishmentSelection('99999999000199', establishments)).toBe('35774511000145')
  })
})
