import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  declararPgdasdTrial,
  gerarDasPgdasdTrial,
  PGDASD_TRIAL_BASE_URL,
  PGDASD_TRIAL_DECLARACAO_CNPJ,
} from '../src/services/pgdasd/trial.js'

const fakeTokens = async () => ({ accessToken: 'trial-token' })

describe('PGDAS-D Trial SERPRO', () => {
  it('declara com CNPJ fictício, endpoint Declarar e sem token de procurador', async () => {
    let captured
    const result = await declararPgdasdTrial(
      { cnpjCompleto: PGDASD_TRIAL_DECLARACAO_CNPJ, pa: 202101 },
      {
        getTokens: fakeTokens,
        fetch: async (url, options) => {
          captured = { url, options }
          return new Response(JSON.stringify({
            status: 200,
            dados: JSON.stringify({ numeroDeclaracao: 'TRIAL-1' }),
          }), { status: 200 })
        },
      },
    )

    assert.equal(captured.url, `${PGDASD_TRIAL_BASE_URL}/Declarar`)
    assert.equal(captured.options.headers.Authorization, 'Bearer trial-token')
    assert.equal(captured.options.headers.jwt_token, undefined)
    assert.equal(captured.options.headers.autenticar_procurador_token, undefined)
    const body = JSON.parse(captured.options.body)
    assert.equal(body.contratante.numero, PGDASD_TRIAL_DECLARACAO_CNPJ)
    assert.equal(body.pedidoDados.idServico, 'TRANSDECLARACAO11')
    assert.equal(result.response.dados.numeroDeclaracao, 'TRIAL-1')
  })

  it('gera DAS no endpoint Emitir e período fixo oficial do Trial', async () => {
    let captured
    const result = await gerarDasPgdasdTrial({
      getTokens: fakeTokens,
      fetch: async (url, options) => {
        captured = { url, options }
        return new Response(JSON.stringify({
          status: 200,
          dados: JSON.stringify([{ pdf: 'A'.repeat(200), numeroDocumento: '1' }]),
        }), { status: 200 })
      },
    })

    assert.equal(captured.url, `${PGDASD_TRIAL_BASE_URL}/Emitir`)
    const body = JSON.parse(captured.options.body)
    assert.equal(body.pedidoDados.idServico, 'GERARDAS12')
    assert.deepEqual(JSON.parse(body.pedidoDados.dados), { periodoApuracao: '201801' })
    assert.match(result.response.dados[0].pdf, /omitido/)
  })

  it('transforma recusa Trial em erro legível', async () => {
    await assert.rejects(
      () => gerarDasPgdasdTrial({
        getTokens: fakeTokens,
        fetch: async () => new Response(JSON.stringify({
          mensagens: [{ texto: 'Cenário não encontrado.' }],
        }), { status: 400 }),
      }),
      /Cenário não encontrado/,
    )
  })

  it('traduz limite de chamadas do Trial', async () => {
    await assert.rejects(
      () => gerarDasPgdasdTrial({
        getTokens: fakeTokens,
        fetch: async () => new Response('Message throttled out', { status: 429 }),
      }),
      /Aguarde alguns segundos/,
    )
  })
})
