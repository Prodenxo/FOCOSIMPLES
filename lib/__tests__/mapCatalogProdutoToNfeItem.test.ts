import {
  buildNfeCatalogProdutoMetadata,
  emptyNfeCatalogProdutoFormFields,
  nfeCatalogProdutoFormFieldsFromMetadata,
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

  it('usa CFOP 6102 quando destinatário é de outro estado', () => {
    const row = mapCatalogProdutoToNfeItem(
      {
        id: 'p2',
        codigo: 'SKU',
        discriminacao: 'Produto',
        metadata_json: { ncm: '22011000', cfop: '5102', icmsCsosn: '102', pisCst: '49', cofinsCst: '49' },
      },
      { emitenteUf: 'RJ', destinatarioUf: 'ES' },
    )
    expect(row.cfop).toBe('6102')
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
})
