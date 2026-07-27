import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  extractNfeNumeroFromDuplicidadeMessage,
  isNfeDuplicidadeRejection,
  readEmpresaNfeNumeracao,
  readNfeNumeroFromHistoryRow,
  resolveNextNfeNumeroAfterFailure,
} from '../src/services/plugnotas/plugnotas-empresa-nfe-numeracao-heal.js'

describe('nfe numeracao heal — parse duplicidade', () => {
  const msg = (
    'Rejeicao: Duplicidade de NF-e, com diferença na Chave de Acesso '
    + '[chNFe:33231031540734000197550010000000011001534406]'
  )

  it('detecta duplicidade', () => {
    assert.equal(isNfeDuplicidadeRejection(msg), true)
    assert.equal(isNfeDuplicidadeRejection({ message: msg }), true)
    assert.equal(isNfeDuplicidadeRejection('nota autorizada'), false)
  })

  it('extrai nNF=1 da chave', () => {
    assert.equal(extractNfeNumeroFromDuplicidadeMessage(msg), 1)
  })

  it('lê numeracao[] do PlugNotas', () => {
    const read = readEmpresaNfeNumeracao({
      nfe: {
        ativo: true,
        config: { numeracao: [{ serie: 1, numero: 7 }] },
      },
    }, 'nfe')
    assert.equal(read.serie, 1)
    assert.equal(read.numero, 7)
  })

  it('resolve próximo número como RPS (max failed/local/empresa)', () => {
    assert.equal(resolveNextNfeNumeroAfterFailure(2, 2, 3), 3)
    assert.equal(resolveNextNfeNumeroAfterFailure(5, 2, 3), 6)
    assert.equal(resolveNextNfeNumeroAfterFailure(1, 10, 3), 11)
  })

  it('lê nNF do histórico local', () => {
    const n = readNfeNumeroFromHistoryRow({
      response_json: {
        message: msg,
      },
    })
    assert.equal(n, 1)
  })
})
