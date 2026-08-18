import {
  buildNfeCatalogProdutoMetadata,
  catalogProdutoNeedsNfeCompletion,
  emptyNfeCatalogProdutoFormFields,
  nfeCatalogProdutoFormFieldsFromMetadata,
  resolveCatalogProdutoNcm,
  validateNfeCatalogProdutoFormFields,
} from '../nfeCatalogProdutoMetadata'
import { mapCatalogProdutoToNfeItem } from '../mapCatalogProdutoToNfeItem'

describe('mapCatalogProdutoToNfeItem', () => {
  it('mapeia tributos do metadata_json cadastrado no produto', () => {
    const row = mapCatalogProdutoToNfeItem({
      id: 'p1',
      codigo: 'AGUA20',
      discriminacao: 'Água 20L',
      valor_sugerido: 12.5,
      metadata_json: {
        ncm: '22011000',
        cfop: '5102',
        unidade: 'UN',
        icmsCsosn: '102',
        pisCst: '49',
        cofinsCst: '49',
      },
    })
    expect(row.tributos.icms.csosn).toBe('102')
    expect(row.tributos.pis.cst).toBe('49')
    expect(row.tributos.cofins.cst).toBe('49')
    expect(row.ncm).toBe('22011000')
    expect(row.cfop).toBe('5102')
  })

  it('sempre inicia com CSOSN 102 e sem CEST — tributação vem do backend', () => {
    const row = mapCatalogProdutoToNfeItem(
      {
        id: 'p4',
        codigo: 'CAM',
        discriminacao: 'Camiseta algodão',
        metadata_json: {
          ncm: '61091000',
          icmsCsosn: '500',
          cest: '0300100',
          pisCst: '49',
          cofinsCst: '49',
        },
      },
      { emitenteUf: 'RJ', destinatarioUf: 'SP', destinatarioDoc: '52998224725' },
    )
    expect(row.tributos.icms.csosn).toBe('102')
    expect(row.cest).toBe('')
    expect(row.cfop).toBe('5102')
  })

  it('usa NCM legado da coluna cnae quando metadata_json está vazio', () => {
    const row = mapCatalogProdutoToNfeItem({
      id: 'p-legacy',
      codigo: 'CAM-ALG-001',
      discriminacao: 'Camiseta',
      cnae: '61091000',
      metadata_json: null,
    })
    expect(row.ncm).toBe('61091000')
  })
})

describe('nfeCatalogProdutoMetadata', () => {
  it('valida apenas NCM obrigatório', () => {
    expect(validateNfeCatalogProdutoFormFields(emptyNfeCatalogProdutoFormFields())).toMatch(/NCM/)
    expect(
      validateNfeCatalogProdutoFormFields({
        ...emptyNfeCatalogProdutoFormFields(),
        ncm: '22011000',
      }),
    ).toBeNull()
  })

  it('round-trip metadata_json guarda ncm e unidade', () => {
    const fields = {
      ncm: '22011000',
      cfop: '5102',
      unidade: 'CX',
      icmsCsosn: '102',
      pisCst: '49',
      cofinsCst: '49',
    }
    const meta = buildNfeCatalogProdutoMetadata(null, fields)
    expect(meta).toMatchObject({ ncm: '22011000', unidade: 'CX' })
    expect(nfeCatalogProdutoFormFieldsFromMetadata(meta).ncm).toBe('22011000')
  })

  it('resolveCatalogProdutoNcm lê metadata e fallback cnae', () => {
    expect(resolveCatalogProdutoNcm({ metadata_json: { ncm: '61091000' } })).toBe('61091000')
    expect(resolveCatalogProdutoNcm({ metadata_json: null, cnae: '61091000' })).toBe('61091000')
    expect(catalogProdutoNeedsNfeCompletion({ metadata_json: null, cnae: '61091000' })).toBe(false)
    expect(catalogProdutoNeedsNfeCompletion({ metadata_json: null, cnae: '' })).toBe(true)
  })
})
