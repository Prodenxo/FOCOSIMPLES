import { formToRuleDraft, ruleToForm, shouldShowStFields, deriveIcmsGroupFromCsosn } from '@/lib/fiscalConfiguration/ruleFormMapper'
import type { AccountantApprovedRule } from '@/lib/fiscalConfiguration/types'

describe('ruleFormMapper', () => {
  it('mapeia regra APPROVED para formulário sem exigir UF fixa', () => {
    const rule: AccountantApprovedRule = {
      id: 'homologacao-0145-camisa-5102-102',
      tenantId: 'tenant',
      version: 1,
      status: 'APPROVED',
      establishmentId: '35774511000145',
      conditions: {
        productId: ['47090301-dd7e-45df-bfdc-50767c04ba48'],
        priorStStatus: ['NO_ST_EVIDENCE'],
        operationType: ['VENDA'],
        operationScope: ['INTERNAL'],
        issuerUf: ['RJ'],
        destinationUf: ['RJ'],
        itemSource: ['THIRD_PARTY'],
        origem: ['0'],
      },
      approvedResult: {
        cfop: '5102',
        csosn: '102',
        icmsGroup: 'ICMSSN102',
        currentOperationSt: 'NOT_DUE',
        pis: { cst: '49', calculationMode: 'OUTR_ZERO', rate: '0' },
        cofins: { cst: '49', calculationMode: 'OUTR_ZERO', rate: '0' },
      },
    }

    const form = ruleToForm(rule, { issuerUf: 'RJ' }, null, null)
    expect(form.cfop).toBe('5102')
    expect(form.csosn).toBe('102')
    expect(form.priorStStatus).toBe('NO_ST_EVIDENCE')
    expect(form.scenarioApplies).toBe('INTERNAL')
    expect(form.restrictRecipientTaxpayer).toBe(false)
  })

  it('gera draft genérico de venda interna sem issuerUf/destinationUf', () => {
    const draft = formToRuleDraft(
      ruleToForm(null, { issuerUf: 'RJ' }, null, null),
      {
        productId: '47090301-dd7e-45df-bfdc-50767c04ba48',
        establishmentId: '35774511000145',
        establishmentIssuerUf: 'RJ',
        ncm: '61091000',
      },
    )
    expect(draft.establishmentId).toBe('35774511000145')
    expect(draft.conditions?.productId).toEqual(['47090301-dd7e-45df-bfdc-50767c04ba48'])
    expect(draft.conditions?.operationScope).toEqual(['INTERNAL'])
    expect(draft.conditions?.issuerUf).toBeUndefined()
    expect(draft.conditions?.destinationUf).toBeUndefined()
  })

  it('inclui destinationUf somente em cenário interestadual com UF específica', () => {
    const base = ruleToForm(null, { issuerUf: 'RJ' }, null, null)
    const draft = formToRuleDraft(
      {
        ...base,
        scenarioApplies: 'INTERSTATE_UF',
        specificDestinationUf: 'SP',
        operationScope: 'INTERSTATE',
      },
      {
        productId: '47090301-dd7e-45df-bfdc-50767c04ba48',
        establishmentId: '35774511000145',
        establishmentIssuerUf: 'RJ',
        ncm: '61091000',
      },
    )
    expect(draft.conditions?.operationScope).toEqual(['INTERSTATE'])
    expect(draft.conditions?.destinationUf).toEqual(['SP'])
    expect(draft.conditions?.issuerUf).toBeUndefined()
  })

  it('exibe ST somente quando CSOSN/evidência exigir', () => {
    const base = ruleToForm(null, { issuerUf: 'RJ' }, null, null)
    expect(shouldShowStFields({ ...base, csosn: '102', priorStStatus: 'NO_ST_EVIDENCE' })).toBe(false)
    expect(shouldShowStFields({ ...base, csosn: '500', priorStStatus: 'NO_ST_EVIDENCE' })).toBe(true)
  })

  it('deriva grupo ICMS XML a partir do CSOSN', () => {
    expect(deriveIcmsGroupFromCsosn('102')).toBe('ICMSSN102')
    expect(deriveIcmsGroupFromCsosn('500')).toBe('ICMSSN500')
  })

  it('ignora grupo ICMS manual inválido ao gerar draft', () => {
    const base = ruleToForm(null, { issuerUf: 'RJ' }, null, null)
    const draft = formToRuleDraft(
      { ...base, cfop: '5102', csosn: '102', icmsGroup: '151' },
      {
        productId: '47090301-dd7e-45df-bfdc-50767c04ba48',
        establishmentId: '35774511000145',
        establishmentIssuerUf: 'RJ',
        ncm: '61091000',
      },
    )
    expect(draft.approvedResult?.icmsGroup).toBe('ICMSSN102')
  })

  it('normaliza grupo ICMS ao carregar regra com valor legado inválido', () => {
    const rule: AccountantApprovedRule = {
      id: 'legacy-151',
      tenantId: 'tenant',
      version: 1,
      status: 'DRAFT',
      establishmentId: '35774511000145',
      conditions: { productId: ['p1'], operationScope: ['INTERNAL'] },
      approvedResult: {
        cfop: '5102',
        csosn: '102',
        icmsGroup: '151',
        currentOperationSt: 'NOT_DUE',
      },
    }
    const form = ruleToForm(rule, { issuerUf: 'RJ' }, null, null)
    expect(form.icmsGroup).toBe('ICMSSN102')
  })
})
