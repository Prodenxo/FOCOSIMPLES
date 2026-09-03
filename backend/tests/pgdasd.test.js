import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapDeclaracoesToPeriods, buildFallbackPeriodList, lastClosedPeriodoApuracao } from '../src/services/pgdasd/consultar-declaracoes.js'
import { aggregateNotasFaturamentoPeriodo, buildDeclaracaoMensalPayload } from '../src/services/pgdasd/transmitir-declaracao.js'
import { extractPdfBase64FromPgdasdResponse } from '../src/services/pgdasd/client.js'
import { inspectPgdasdSerproConfig } from '../src/services/pgdasd/client.js'
import {
  shouldFallbackToDasExtrato,
  todayYmdSaoPaulo,
} from '../src/services/simples-das.service.js'

describe('pgdasd consultar map', () => {
  it('mapeia periodos a partir de estrutura CONSDECLARACAO', () => {
    const periods = mapDeclaracoesToPeriods({
      anoCalendario: 2026,
      periodos: [
        {
          periodoApuracao: '202603',
          operacoes: [
            {
              tipoOperacao: 'Declaração Original',
              indiceDeclaracao: { numeroDeclaracao: '123' },
            },
          ],
        },
      ],
    })
    assert.equal(periods.length, 1)
    assert.equal(periods[0].periodoApuracao, '202603')
    assert.equal(periods[0].competencia, '2026-03')
  })

  it('lastClosedPeriodoApuracao é o mês anterior', () => {
    assert.equal(lastClosedPeriodoApuracao(new Date(2026, 8, 2)), '202608')
    assert.equal(lastClosedPeriodoApuracao(new Date(2026, 0, 5)), '202512')
  })

  it('fallback gera competências (só para integração off)', () => {
    const rows = buildFallbackPeriodList(3)
    assert.equal(rows.length, 3)
    assert.match(rows[0].periodoApuracao, /^\d{6}$/)
  })

  it('marca pago quando operação indica pagamento', () => {
    const periods = mapDeclaracoesToPeriods({
      periodos: [
        {
          periodoApuracao: '202601',
          operacoes: [{ tipoOperacao: 'Pagamento DAS', pago: true }],
        },
      ],
    })
    assert.equal(periods[0].status, 'pago')
  })

  it('marca pago quando indiceDas.dasPago=true', () => {
    const periods = mapDeclaracoesToPeriods({
      periodos: [
        {
          periodoApuracao: '202602',
          operacoes: [
            { tipoOperacao: 'Declaração Original' },
            {
              tipoOperacao: 'Geração de DAS',
              indiceDas: { numeroDas: '1', dasPago: true },
            },
          ],
        },
      ],
    })
    assert.equal(periods[0].status, 'pago')
    assert.equal(periods[0].numeroDas, '1')
  })

  it('escolhe numeroDas pago mais recente', () => {
    const periods = mapDeclaracoesToPeriods({
      periodos: [
        {
          periodoApuracao: '202605',
          operacoes: [
            {
              tipoOperacao: 'Geração de DAS',
              indiceDas: { numeroDas: '111', dasPago: false, dataHoraEmissaoDas: 20260501120000 },
            },
            {
              tipoOperacao: 'Geração de DAS',
              indiceDas: { numeroDas: '222', dasPago: true, dataHoraEmissaoDas: 20260510120000 },
            },
            {
              tipoOperacao: 'Geração de DAS',
              indiceDas: { numeroDas: '333', dasPago: true, dataHoraEmissaoDas: 20260505120000 },
            },
          ],
        },
      ],
    })
    assert.equal(periods[0].numeroDas, '222')
    assert.equal(periods[0].status, 'pago')
  })

  it('marca a_pagar quando houve Geração de DAS não pago', () => {
    const periods = mapDeclaracoesToPeriods({
      periodos: [
        {
          periodoApuracao: '202603',
          operacoes: [
            { tipoOperacao: 'Declaração Original' },
            {
              tipoOperacao: 'Geração de DAS',
              indiceDas: { numeroDas: '2', dasPago: false },
            },
          ],
        },
      ],
    })
    assert.equal(periods[0].status, 'a_pagar')
  })

  it('marca sem_debito quando só há declaração (sem geração de DAS / sem valor devido)', () => {
    const periods = mapDeclaracoesToPeriods({
      periodos: [
        {
          periodoApuracao: '202601',
          operacoes: [{ tipoOperacao: 'Declaração Original', indiceDeclaracao: { numeroDeclaracao: '9' } }],
        },
      ],
    })
    assert.equal(periods[0].status, 'sem_debito')
    assert.equal(periods[0].hasDas, false)
  })

  it('extrai numeroDas de numeroDocumento no indiceDas', () => {
    const periods = mapDeclaracoesToPeriods({
      periodos: [
        {
          periodoApuracao: '202606',
          operacoes: [
            {
              tipoOperacao: 'Geração de DAS',
              indiceDas: { numeroDocumento: '07202620299718700', dasPago: false },
            },
          ],
        },
      ],
    })
    assert.equal(periods[0].numeroDas, '07202620299718700')
    assert.equal(periods[0].status, 'a_pagar')
  })
})

describe('pgdasd faturamento notas', () => {
  it('soma NFS-e e NF-e concluídas do período', () => {
    const fat = aggregateNotasFaturamentoPeriodo([
      {
        document_type: 'NFSE',
        status: 'concluido',
        created_at: '2026-08-10T15:00:00.000Z',
        payload_json: { servico: [{ valor: { servico: 1.13 } }] },
      },
      {
        document_type: 'NFE',
        status: 'autorizado',
        created_at: '2026-08-20T15:00:00.000Z',
        payload_json: { itens: [{ valor: 100, quantidade: 1 }] },
      },
      {
        document_type: 'NFSE',
        status: 'processando',
        created_at: '2026-08-12T15:00:00.000Z',
        payload_json: { servico: [{ valor: { servico: 999 } }] },
      },
    ], '202608')
    assert.equal(fat.count, 2)
    assert.equal(fat.total, 101.13)
    assert.equal(fat.porTipo.NFSE, 1)
    assert.equal(fat.porTipo.NFE, 1)
  })
})

describe('pgdasd declaracao draft', () => {
  it('monta payload mínimo TRANSDECLARACAO', () => {
    const draft = buildDeclaracaoMensalPayload({
      cnpj: '49453916000196',
      periodoApuracao: '202606',
      valorReceitaInterna: 1500.5,
    })
    assert.equal(draft.cnpjCompleto, '49453916000196')
    assert.equal(draft.pa, 202606)
    assert.equal(draft.declaracao.receitaBrutaPa.valorCaixaInterno, 1500.5)
    assert.equal(draft.declaracao.receitasBrutasAnteriores.length, 12)
  })
})

describe('pgdasd pdf extract', () => {
  it('extrai pdf base64 do detalhamento', () => {
    const fakePdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(120, 65),
    ]).toString('base64')
    const pdf = extractPdfBase64FromPgdasdResponse({
      dados: [{ pdf: fakePdf, detalhamento: { numeroDocumento: '1' } }],
    })
    assert.equal(pdf, fakePdf)
  })
})

describe('pgdasd config inspect', () => {
  it('retorna missing sem lançar', () => {
    const cfg = inspectPgdasdSerproConfig()
    assert.equal(typeof cfg.configured, 'boolean')
    assert.ok(Array.isArray(cfg.missing))
  })
})

describe('pgdasd guia vencida vs extrato', () => {
  it('hoje em Brasília tem 8 dígitos', () => {
    assert.match(todayYmdSaoPaulo(new Date('2026-09-03T20:00:00-03:00')), /^\d{8}$/)
    assert.equal(todayYmdSaoPaulo(new Date('2026-09-03T20:00:00-03:00')), '20260903')
  })

  it('atualizar vencido não cai no extrato do PGDAS', () => {
    assert.equal(shouldFallbackToDasExtrato({ regenerate: true }), false)
    assert.equal(shouldFallbackToDasExtrato({ dataConsolidacao: '20260903' }), false)
    assert.equal(shouldFallbackToDasExtrato({}), true)
  })
})
