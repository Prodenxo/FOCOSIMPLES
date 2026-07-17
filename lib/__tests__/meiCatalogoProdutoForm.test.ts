import {
  buildProdutoCatalogPayload,
  normalizeCnaeInput,
  normalizeCodigoServicoInput,
  validateProdutoCatalogForm,
} from '../meiCatalogoProdutoForm'

const parseDecimal = (raw: string): number | null => {
  const t = raw.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

describe('meiCatalogoProdutoForm', () => {
  it('normaliza CNAE com máscara', () => {
    expect(normalizeCnaeInput('4211-1/02')).toBe('4211102')
  })

  it('normaliza código municipal removendo pontos', () => {
    expect(normalizeCodigoServicoInput('07.02')).toBe('0702')
    expect(normalizeCodigoServicoInput('140101')).toBe('140101')
  })

  it('rejeita código e CNAE iguais após normalização', () => {
    const err = validateProdutoCatalogForm(
      {
        codigo: '4211-1/02',
        cnae: '4211-1/02',
        discriminacao: 'Pintura',
        aliquotaStr: '5',
        valorSugeridoStr: '',
      },
      parseDecimal,
    )
    expect(err).toMatch(/não podem ser iguais/i)
  })

  it('aceita formulário válido', () => {
    const payload = buildProdutoCatalogPayload(
      {
        codigo: '14.01.01',
        cnae: '4211-1/02',
        discriminacao: 'Pintura para sinalização',
        aliquotaStr: '5',
        valorSugeridoStr: '',
      },
      parseDecimal,
    )
    expect(payload.codigo).toBe('140101')
    expect(payload.cnae).toBe('4211102')
  })

  it('aceita catálogo sem alíquota (MEI/Simples)', () => {
    const err = validateProdutoCatalogForm(
      {
        codigo: '170601',
        cnae: '7319002',
        discriminacao: 'Promoção de vendas',
        aliquotaStr: '',
        valorSugeridoStr: '',
      },
      parseDecimal,
    )
    expect(err).toBeNull()

    const payload = buildProdutoCatalogPayload(
      {
        codigo: '170601',
        cnae: '7319002',
        discriminacao: 'Promoção de vendas',
        aliquotaStr: '',
        valorSugeridoStr: '',
      },
      parseDecimal,
    )
    expect(payload.aliquota).toBeUndefined()
  })

  it('aceita produto NF-e com tributos no metadata', () => {
    const payload = buildProdutoCatalogPayload(
      {
        codigo: 'AGUA20',
        cnae: '',
        discriminacao: 'Água 20 litros',
        aliquotaStr: '',
        valorSugeridoStr: '12,50',
        documentType: 'NFE',
        nfe: {
          ncm: '22011000',
          cfop: '5102',
          unidade: 'UN',
          icmsCsosn: '102',
          pisCst: '49',
          cofinsCst: '49',
        },
      },
      parseDecimal,
    )
    expect(payload.metadata_json).toMatchObject({
      ncm: '22011000',
      icmsCsosn: '102',
      pisCst: '49',
    })
    expect(payload.cnae).toBe('')
  })
})
