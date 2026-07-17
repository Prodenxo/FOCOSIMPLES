import {
  DEFAULT_MEI_DOCUMENTOS_PERMITIDOS,
  isMeiDocTypePermitido,
  meiDocTypesPermitidos,
  primeiroMeiDocTypePermitido,
  resolveMeiDocumentosPermitidos,
} from '../meiDocumentosPermitidos'

describe('meiDocumentosPermitidos', () => {
  it('prioriza espelho admin sobre empresa Plugnotas', () => {
    const out = resolveMeiDocumentosPermitidos(
      { nfse: true, nfe: true, nfce: false },
      { nfse: { ativo: true }, nfe: { ativo: false }, nfce: { ativo: true } },
    )
    expect(out).toEqual({ nfse: true, nfe: true, nfce: false })
  })

  it('usa flags da empresa quando não há espelho', () => {
    const out = resolveMeiDocumentosPermitidos(null, {
      nfse: { ativo: true },
      nfe: { ativo: true },
      nfce: { ativo: false },
    })
    expect(out).toEqual({ nfse: true, nfe: true, nfce: false })
  })

  it('cai no default seguro (só NFS-e) sem espelho nem empresa', () => {
    expect(resolveMeiDocumentosPermitidos(null, null)).toEqual(DEFAULT_MEI_DOCUMENTOS_PERMITIDOS)
  })

  it('lista tipos permitidos e primeiro tipo', () => {
    const state = { nfse: false, nfe: true, nfce: true }
    expect(meiDocTypesPermitidos(state)).toEqual(['NFE', 'NFCE'])
    expect(primeiroMeiDocTypePermitido(state)).toBe('NFE')
    expect(isMeiDocTypePermitido('NFSE', state)).toBe(false)
    expect(isMeiDocTypePermitido('NFE', state)).toBe(true)
  })
})
