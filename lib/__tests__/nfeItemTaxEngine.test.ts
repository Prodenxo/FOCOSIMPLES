import {
  applyItemTaxResultToNfeItem,
  buildNfeTaxItemsKey,
  calculateItemTax,
  CFOP_VENDA_ESTADUAL,
  CFOP_VENDA_ESTADUAL_ST,
  CFOP_VENDA_INTERESTADUAL,
  CSOSN_ST,
  CSOSN_TRIBUTADO_SN,
  productHasCest,
  resolveEstadualHasSt,
} from '../nfeItemTaxEngine'
import { getDefaultNfeItem } from '../meiNfseForms'

describe('nfeItemTaxEngine', () => {
  it('estadual normal sem CEST nem regra', () => {
    const tax = calculateItemTax({ ncm: '61091000' }, 'RJ', 'RJ')
    expect(tax.cfop).toBe(CFOP_VENDA_ESTADUAL)
    expect(tax.csosn).toBe(CSOSN_TRIBUTADO_SN)
  })

  it('estadual ST por CEST', () => {
    const tax = calculateItemTax({ ncm: '22021000', cest: '0300100' }, 'SP', 'SP')
    expect(tax.cfop).toBe(CFOP_VENDA_ESTADUAL_ST)
    expect(tax.csosn).toBe(CSOSN_ST)
  })

  it('estadual ST por regra na tabela (sem CEST)', () => {
    const tax = calculateItemTax({ ncm: '22021000' }, 'MG', 'MG', { hasSt: true })
    expect(tax.cfop).toBe(CFOP_VENDA_ESTADUAL_ST)
    expect(tax.csosn).toBe(CSOSN_ST)
    expect(resolveEstadualHasSt({ ncm: '22021000' }, { hasSt: true })).toBe(true)
    expect(productHasCest({ cest: '' })).toBe(false)
  })

  it('interestadual com protocolo ST', () => {
    const tax = calculateItemTax({ ncm: '22021000' }, 'RJ', 'SP', { hasSt: true, cfopSt: '6105' })
    expect(tax.cfop).toBe('6105')
    expect(tax.csosn).toBe(CSOSN_ST)
  })

  it('interestadual sem protocolo ST', () => {
    const tax = calculateItemTax({ ncm: '61091000' }, 'RJ', 'SP', { hasSt: false })
    expect(tax.cfop).toBe(CFOP_VENDA_INTERESTADUAL)
    expect(tax.csosn).toBe(CSOSN_TRIBUTADO_SN)
  })

  it('funciona para qualquer par de UFs (ex.: AM → PA)', () => {
    const tax = calculateItemTax({ ncm: '84713012' }, 'AM', 'PA', null)
    expect(tax.cfop).toBe(CFOP_VENDA_INTERESTADUAL)
    expect(tax.scope).toBe('interestadual')
  })

  it('aplica resultado no item do formulário', () => {
    const item = getDefaultNfeItem()
    const tax = calculateItemTax({ ncm: '22021000', cest: '0300100' }, 'RJ', 'RJ')
    const next = applyItemTaxResultToNfeItem(item, tax)
    expect(next.cfop).toBe(CFOP_VENDA_ESTADUAL_ST)
    expect(next.tributos.icms.csosn).toBe(CSOSN_ST)
  })

  it('buildNfeTaxItemsKey detecta novo produto e mudança de NCM/CEST', () => {
    const one = buildNfeTaxItemsKey([{ ncm: '61091000', cest: '' }])
    const two = buildNfeTaxItemsKey([
      { ncm: '61091000', cest: '' },
      { ncm: '', cest: '' },
    ])
    const cestChanged = buildNfeTaxItemsKey([{ ncm: '61091000', cest: '2803800' }])
    expect(one).not.toBe(two)
    expect(one).not.toBe(cestChanged)
  })
})
