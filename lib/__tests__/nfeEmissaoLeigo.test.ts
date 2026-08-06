import {
  applyCfopLocalizacaoToNfeItens,
  applySimplesNacionalDefaultsToNfeItem,
  CFOP_VENDA_ESTADUAL,
  CFOP_VENDA_INTERESTADUAL,
  detectNfeVendaLocalizacao,
  resolveCfopByLocalizacao,
  resolveIndIeDestFromDocument,
  shouldShowDestinatarioIeOptions,
  shouldShowDestinatarioInscricaoEstadual,
  isCepCompleteForLookup,
  normalizeCepForLookup,
} from '../nfeEmissaoLeigo'
import { getDefaultNfeItem } from '../meiNfseForms'

describe('nfeEmissaoLeigo', () => {
  it('detecta venda estadual e interestadual', () => {
    expect(detectNfeVendaLocalizacao('RJ', 'RJ')).toBe('estadual')
    expect(detectNfeVendaLocalizacao('RJ', 'ES')).toBe('interestadual')
  })

  it('resolve CFOP 5102 / 6102', () => {
    expect(resolveCfopByLocalizacao('SP', 'SP')).toBe(CFOP_VENDA_ESTADUAL)
    expect(resolveCfopByLocalizacao('SP', 'MG')).toBe(CFOP_VENDA_INTERESTADUAL)
    expect(resolveCfopByLocalizacao('', 'MG')).toBeNull()
  })

  it('aplica CFOP em todos os itens', () => {
    const next = applyCfopLocalizacaoToNfeItens([{ cfop: '5101' }], 'RJ', 'ES')
    expect(next[0]?.cfop).toBe('6102')
  })

  it('indIEDest por documento', () => {
    expect(resolveIndIeDestFromDocument('12345678901')).toBe('9')
    expect(resolveIndIeDestFromDocument('12345678000190')).toBe('1')
    expect(shouldShowDestinatarioIeOptions('12345678000190')).toBe(true)
    expect(shouldShowDestinatarioIeOptions('12345678901')).toBe(false)
    expect(shouldShowDestinatarioInscricaoEstadual('1', '12345678000190')).toBe(true)
    expect(shouldShowDestinatarioInscricaoEstadual('9', '12345678000190')).toBe(false)
  })

  it('aplica defaults Simples Nacional no item', () => {
    const item = applySimplesNacionalDefaultsToNfeItem(getDefaultNfeItem())
    expect(item.unidade).toBe('UN')
    expect(item.tributos.icms.csosn).toBe('102')
    expect(item.tributos.pis.cst).toBe('49')
    expect(item.tributos.cofins.cst).toBe('49')
  })

  it('normaliza CEP sem adivinhar dígito faltante', () => {
    expect(normalizeCepForLookup('6564500')).toBe('6564500')
    expect(normalizeCepForLookup('01310-100')).toBe('01310100')
    expect(isCepCompleteForLookup('50010000')).toBe(true)
    expect(isCepCompleteForLookup('5699999')).toBe(false)
  })
})
