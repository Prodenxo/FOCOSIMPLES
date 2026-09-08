import {
  applyCatalogProdutoToNfseServico,
  buildNfseCatalogProdutoMetadata,
  canEditNfseReformaCatalogFields,
  catalogProdutoNeedsNfseReformaCompletion,
  lookupSuggestedCodigoNbs,
  validateNfseCatalogProdutoFormFields,
} from '../nfseCatalogProdutoMetadata'

describe('nfseCatalogProdutoMetadata', () => {
  it('sugere NBS para LC 14.01.01', () => {
    expect(lookupSuggestedCodigoNbs('14.01.01')).toBe('120013110')
  })

  it('valida cIndOp; NBS incompleto não bloqueia', () => {
    expect(validateNfseCatalogProdutoFormFields({ codigoNbs: '120013110', cIndOp: '050101' })).toBeNull()
    expect(validateNfseCatalogProdutoFormFields({ codigoNbs: '1010720', cIndOp: '050101' })).toBeNull()
    expect(validateNfseCatalogProdutoFormFields({ codigoNbs: '', cIndOp: '123' })).toMatch(/cIndOp/)
  })

  it('buildNfseCatalogProdutoMetadata persiste campos', () => {
    const meta = buildNfseCatalogProdutoMetadata(null, {
      codigoNbs: '120013110',
      cIndOp: '050101',
    })
    expect(meta.codigoNbs).toBe('120013110')
    expect(meta.cIndOp).toBe('050101')
    expect(meta.codigoOperacao).toBe('050101')
  })

  it('applyCatalogProdutoToNfseServico inclui reforma do catálogo', () => {
    const servico = applyCatalogProdutoToNfseServico({
      codigo: '140101',
      cnae: '4520001',
      discriminacao: 'Manutenção',
      metadata_json: { codigoNbs: '120013110', cIndOp: '050101' },
    })
    expect(servico.codigoNbs).toBe('120013110')
    expect(servico.cIndOp).toBe('050101')
  })

  it('catalogProdutoNeedsNfseReformaCompletion quando falta cIndOp', () => {
    expect(
      catalogProdutoNeedsNfseReformaCompletion({ document_type: 'NFSE', metadata_json: {} }),
    ).toBe(true)
    expect(
      catalogProdutoNeedsNfseReformaCompletion({
        document_type: 'NFSE',
        metadata_json: { cIndOp: '050101' },
      }),
    ).toBe(false)
  })

  it('canEditNfseReformaCatalogFields: cliente e contador', () => {
    expect(canEditNfseReformaCatalogFields('admin', false)).toBe(true)
    expect(canEditNfseReformaCatalogFields('usuario', false)).toBe(true)
    expect(canEditNfseReformaCatalogFields('usuario', true)).toBe(true)
  })
})
