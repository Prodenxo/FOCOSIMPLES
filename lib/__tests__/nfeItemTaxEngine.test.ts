import {
  applyItemTaxResultToNfeItem,
  buildNfeTaxItemsKey,
  calculateItemTax,
  CFOP_VENDA_ESTADUAL,
  CFOP_VENDA_ESTADUAL_ST,
  CFOP_VENDA_INTERESTADUAL,
  CSOSN_ST,
  CSOSN_TRIBUTADO_SN,
  resolveEstadualHasSt,
} from '../nfeItemTaxEngine'
import { getDefaultNfeItem } from '../meiNfseForms'

describe('nfeItemTaxEngine', () => {
  it('estadual normal sem regra ST no NCM', () => {
    const tax = calculateItemTax({ ncm: '61091000' }, 'RJ', 'RJ')
    expect(tax.cfop).toBe(CFOP_VENDA_ESTADUAL)
    expect(tax.csosn).toBe(CSOSN_TRIBUTADO_SN)
  })

  it('estadual ST quando NCM está na lista (tax_rules_state)', () => {
    const tax = calculateItemTax({ ncm: '22021000' }, 'SP', 'SP', { hasSt: true })
    expect(tax.cfop).toBe(CFOP_VENDA_ESTADUAL_ST)
    expect(tax.csosn).toBe(CSOSN_ST)
    expect(resolveEstadualHasSt({ ncm: '22021000' }, { hasSt: true })).toBe(true)
  })

  it('CEST sozinho não gera ST (somente NCM na tabela)', () => {
    const tax = calculateItemTax({ ncm: '22021000', cest: '0300100' }, 'SP', 'SP', null)
    expect(tax.cfop).toBe(CFOP_VENDA_ESTADUAL)
    expect(tax.csosn).toBe(CSOSN_TRIBUTADO_SN)
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

  it('indústria sem ST → 5101 / 6101', () => {
    const estadual = calculateItemTax({ ncm: '61091000' }, 'RJ', 'RJ', null, 'MANUFACTURER')
    expect(estadual.cfop).toBe('5101')
    const interestadual = calculateItemTax({ ncm: '61091000' }, 'RJ', 'SP', null, 'MANUFACTURER')
    expect(interestadual.cfop).toBe('6101')
  })

  it('indústria com ST estadual por NCM → 5401', () => {
    const tax = calculateItemTax({ ncm: '22021000' }, 'SP', 'SP', { hasSt: true }, 'MANUFACTURER')
    expect(tax.cfop).toBe('5401')
    expect(tax.csosn).toBe(CSOSN_ST)
  })

  it('aplica resultado no item do formulário', () => {
    const item = getDefaultNfeItem()
    const tax = calculateItemTax({ ncm: '22021000' }, 'RJ', 'RJ', { hasSt: true })
    const next = applyItemTaxResultToNfeItem(item, tax)
    expect(next.cfop).toBe(CFOP_VENDA_ESTADUAL_ST)
    expect(next.tributos.icms.csosn).toBe(CSOSN_ST)
  })

  it('buildNfeTaxItemsKey detecta novo produto e mudança de NCM', () => {
    const one = buildNfeTaxItemsKey([{ ncm: '61091000' }])
    const two = buildNfeTaxItemsKey([{ ncm: '61091000' }, { ncm: '' }])
    const ncmChanged = buildNfeTaxItemsKey([{ ncm: '22011000' }])
    expect(one).not.toBe(two)
    expect(one).not.toBe(ncmChanged)
  })
})
