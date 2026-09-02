import {
  inferCestFromProductDescription,
  normalizeCestInput,
} from '../nfe-cest-packaging-hints'

describe('nfe-cest-packaging-hints', () => {
  it('infere CEST para refrigerante PET', () => {
    expect(inferCestFromProductDescription('22021000', 'Refrigerante Cola 2L PET')).toBe('0300100')
  })

  it('infere CEST para cerveja em lata', () => {
    expect(inferCestFromProductDescription('22030000', 'Cerveja Pilsen 350ml Lata')).toBe('0300300')
  })

  it('retorna null sem palavra-chave de embalagem', () => {
    expect(inferCestFromProductDescription('22021000', 'Refrigerante Cola 2L')).toBeNull()
  })

  it('normalizeCestInput mantém 7 dígitos', () => {
    expect(normalizeCestInput('03.001.00')).toBe('0300100')
  })
})
