import {
  buildProdutoCatalogPayload,
  normalizeCnaeInput,
  normalizeCodigoServicoInput,
  validateProdutoCatalogForm,
} from '../meiCatalogoProdutoForm'
import { emptyNfeCatalogProdutoFormFields } from '../nfeCatalogProdutoMetadata'

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

  it('aceita produto NF-e e grava NCM no metadata (tributos calculados na emissão)', () => {
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
          cest: '',
        },
      },
      parseDecimal,
    )
    expect(payload.metadata_json).toMatchObject({
      ncm: '22011000',
      unidade: 'UN',
    })
    expect(payload.cnae).toBe('')
  })

  it('infere CEST ao salvar produto com embalagem PET na descrição (sem marcar ST)', () => {
    const payload = buildProdutoCatalogPayload(
      {
        codigo: 'REF2L',
        cnae: '',
        discriminacao: 'Refrigerante Cola 2L PET',
        aliquotaStr: '',
        valorSugeridoStr: '8,00',
        documentType: 'NFE',
        nfe: {
          ...emptyNfeCatalogProdutoFormFields(),
          ncm: '22021000',
        },
      },
      parseDecimal,
    )
    expect(payload.metadata_json).toMatchObject({
      ncm: '22021000',
      cest: '0300100',
    })
    expect(payload.metadata_json).not.toHaveProperty('hasSt')
  })
})
