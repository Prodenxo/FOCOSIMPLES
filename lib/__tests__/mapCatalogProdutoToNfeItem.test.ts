import {
  MEI_DEFAULT_NFE_CSOSN,
  MEI_DEFAULT_NFE_PIS_COFINS_CST,
} from '../meiNfseForms'
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
})

describe('nfeCatalogProdutoMetadata', () => {
  it('valida NCM e tributos obrigatórios', () => {
    expect(validateNfeCatalogProdutoFormFields(emptyNfeCatalogProdutoFormFields())).toMatch(/NCM/)
    expect(
      validateNfeCatalogProdutoFormFields({
        ...emptyNfeCatalogProdutoFormFields(),
        ncm: '22011000',
        cfop: '5102',
        icmsCsosn: MEI_DEFAULT_NFE_CSOSN,
        pisCst: MEI_DEFAULT_NFE_PIS_COFINS_CST,
        cofinsCst: MEI_DEFAULT_NFE_PIS_COFINS_CST,
      }),
    ).toBeNull()
  })

  it('round-trip metadata_json', () => {
    const fields = {
      ncm: '22011000',
      cfop: '5102',
      unidade: 'CX',
      icmsCsosn: '102',
      pisCst: '49',
      cofinsCst: '49',
    }
    const meta = buildNfeCatalogProdutoMetadata(null, fields)
    expect(nfeCatalogProdutoFormFieldsFromMetadata(meta)).toMatchObject(fields)
  })
})
