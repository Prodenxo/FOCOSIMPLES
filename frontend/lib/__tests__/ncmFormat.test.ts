import {
  cleanNcmDescription,
  formatNcmCodeDisplay,
  formatNcmLabel,
  normalizeNcmCode,
  stripNcmHtml,
} from '../ncmFormat'

describe('ncmFormat', () => {
  it('formata código NCM com pontos', () => {
    expect(formatNcmCodeDisplay('48202000')).toBe('4820.20.00')
    expect(normalizeNcmCode('4820.20.00')).toBe('48202000')
  })

  it('limpa traços da descrição', () => {
    expect(cleanNcmDescription('- Cadernos')).toBe('Cadernos')
  })

  it('remove tags HTML da BrasilAPI', () => {
    expect(stripNcmHtml('Peixe-sapo (<i>Lophius gastrophysus</i>)')).toBe(
      'Peixe-sapo (Lophius gastrophysus)',
    )
  })

  it('monta label amigável', () => {
    expect(formatNcmLabel('48202000', '- Cadernos')).toBe('4820.20.00 - Cadernos')
  })
})
