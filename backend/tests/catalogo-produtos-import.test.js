import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('catalogo from-cnaes / spreadsheet rules', () => {
  it('rejeita NF-e via from-cnaes', async () => {
    const { criarCatalogoProdutosFromCnaes } = await import(
      '../src/services/mei-notas.service.js'
    )
    await assert.rejects(
      () => criarCatalogoProdutosFromCnaes('user-test', {
        documentType: 'NFE',
        items: [{ codigo: '5611201', descricao: 'Restaurantes' }],
      }),
      (err) => {
        assert.equal(err?.status, 400)
        assert.equal(err?.errors?.code, 'CATALOGO_CNAE_NFE_FORBIDDEN')
        assert.match(String(err.message), /planilha|produto completo/i)
        return true
      },
    )
  })

  it('rejeita planilha com documentType NFS-e', async () => {
    const { criarCatalogoProdutosFromSpreadsheet } = await import(
      '../src/services/mei-notas.service.js'
    )
    await assert.rejects(
      () => criarCatalogoProdutosFromSpreadsheet('user-test', {
        documentType: 'NFSE',
        rows: [{ descricao: 'X', ncm: '22030000', cfop: '5102', unidade: 'UN', csosn: '102' }],
      }),
      (err) => {
        assert.equal(err?.status, 400)
        assert.equal(err?.errors?.code, 'CATALOGO_SPREADSHEET_DOC_TYPE')
        return true
      },
    )
  })

  it('rejeita planilha sem rows', async () => {
    const { criarCatalogoProdutosFromSpreadsheet } = await import(
      '../src/services/mei-notas.service.js'
    )
    await assert.rejects(
      () => criarCatalogoProdutosFromSpreadsheet('user-test', {
        documentType: 'NFE',
        rows: [],
      }),
      (err) => {
        assert.equal(err?.status, 400)
        return true
      },
    )
  })
})
