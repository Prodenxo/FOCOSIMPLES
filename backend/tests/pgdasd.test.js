import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapDeclaracoesToPeriods, buildFallbackPeriodList, lastClosedPeriodoApuracao } from '../src/services/pgdasd/consultar-declaracoes.js'
import { aggregateNotasFaturamentoPeriodo, buildDeclaracaoMensalPayload } from '../src/services/pgdasd/transmitir-declaracao.js'
import { extractPdfBase64FromPgdasdResponse } from '../src/services/pgdasd/client.js'
import { inspectPgdasdSerproConfig } from '../src/services/pgdasd/client.js'
import { normalizeDasSimplesDraft } from '../src/services/pgdasd/das-simples-store.js'
import {
  shouldFallbackToDasExtrato,
  todayYmdSaoPaulo,
  isSemDebitoSerproMessage,
} from '../src/services/simples-das.service.js'

describe('pgdasd rascunho', () => {
  it('normaliza apenas os campos permitidos do formulário', () => {
    assert.deepEqual(normalizeDasSimplesDraft({
      valorReceitaInterna: '1500.25',
      casoEspecial: true,
      idAtividadeServico: 13,
      idAtividadeMercadoria: 2,
      valorReceitaExterna: -10,
      folhasSalario: [{ pa: '202507', valor: '800' }],
      codigoOutroMunicipio: '35.503-08',
      outraUf: 'sp!',
      cnpjsFiliais: '11.222.333/0001-81',
      campoInesperado: 'não salvar',
    }), {
      valorReceitaInterna: 1500.25,
      casoEspecial: true,
      idAtividadeServico: 13,
      idAtividadeMercadoria: 2,
      valorReceitaExterna: 0,
      folhasSalario: [{ pa: '202507', valor: 800 }],
      codigoOutroMunicipio: '3550308',
      outraUf: 'SP',
      cnpjsFiliais: '11.222.333/0001-81',
    })
  })
})

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

  it('indiceDas vazio na declaração não vira a_pagar', () => {
    const periods = mapDeclaracoesToPeriods({
      periodos: [
        {
          periodoApuracao: '202607',
          operacoes: [
            {
              tipoOperacao: 'Declaração Original',
              indiceDeclaracao: { numeroDeclaracao: '99' },
              indiceDas: {},
            },
          ],
        },
      ],
    })
    assert.equal(periods[0].status, 'sem_debito')
    assert.equal(periods[0].hasDas, false)
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
    assert.equal(fat.valorServicos, 1.13)
    assert.equal(fat.valorMercadorias, 100)
  })
})

describe('pgdasd declaracao draft', () => {
  it('monta payload TRANSDECLARACAO no formato SERPRO, só com o faturamento', () => {
    const draft = buildDeclaracaoMensalPayload({
      cnpj: '49453916000196',
      periodoApuracao: '202606',
      valorReceitaInterna: 1500.5,
    })
    assert.equal(draft.cnpjCompleto, '49453916000196')
    assert.equal(draft.pa, 202606)
    assert.equal(draft.indicadorComparacao, false)
    assert.equal(draft.declaracao.tipoDeclaracao, 1)
    assert.equal(draft.declaracao.receitaPaCompetenciaInterno, 1500.5)
    assert.equal(draft.declaracao.receitaPaCompetenciaExterno, 0)
    assert.equal(draft.declaracao.estabelecimentos[0].cnpjCompleto, '49453916000196')
    assert.equal(draft.declaracao.estabelecimentos[0].atividades[0].idAtividade, 14)
    assert.equal(draft.declaracao.estabelecimentos[0].atividades[0].valorAtividade, 1500.5)
    assert.equal(draft.declaracao.receitaBrutaPa, undefined)
  })

  it('parte serviço e mercadoria pelas notas e marca retificadora', () => {
    const draft = buildDeclaracaoMensalPayload({
      cnpj: '49453916000196',
      periodoApuracao: '202606',
      valorReceitaInterna: 101.13,
      valorServicos: 1.13,
      valorMercadorias: 100,
      tipoDeclaracao: 2,
    })
    const ids = draft.declaracao.estabelecimentos[0].atividades.map((a) => a.idAtividade)
    assert.deepEqual(ids, [14, 1])
    assert.equal(draft.declaracao.tipoDeclaracao, 2)
  })

  it('faz as atividades somarem receita interna e externa', () => {
    const draft = buildDeclaracaoMensalPayload({
      cnpj: '49453916000196',
      periodoApuracao: '202606',
      valorReceitaInterna: 1000,
      valorReceitaExterna: 200,
      valorServicos: 1000,
    })
    const totalAtividades = draft.declaracao.estabelecimentos[0].atividades
      .reduce((total, atividade) => total + atividade.valorAtividade, 0)
    assert.equal(totalAtividades, 1200)
    assert.equal(
      totalAtividades,
      draft.declaracao.receitaPaCompetenciaInterno
        + draft.declaracao.receitaPaCompetenciaExterno,
    )
  })

  it('mês zerado envia estabelecimento sem atividade', () => {
    const draft = buildDeclaracaoMensalPayload({
      cnpj: '49453916000196',
      periodoApuracao: '202606',
      valorReceitaInterna: 0,
    })
    assert.equal(draft.declaracao.estabelecimentos[0].atividades, undefined)
  })

  it('caso especial preenche ISS outro município e filial sem mandar folha indevida', () => {
    const draft = buildDeclaracaoMensalPayload({
      cnpj: '49453916000196',
      periodoApuracao: '202606',
      valorReceitaInterna: 2000,
      idAtividadeServico: 13,
      codigoOutroMunicipio: '3550308',
      outraUf: 'SP',
      folhasSalario: [{ pa: 202507, valor: 800 }],
      cnpjsFiliais: '11222333000181',
    })
    const atividade = draft.declaracao.estabelecimentos[0].atividades[0]
    assert.equal(atividade.idAtividade, 13)
    assert.equal(atividade.receitasAtividade[0].codigoOutroMunicipio, '3550308')
    assert.equal(atividade.receitasAtividade[0].outraUf, 'SP')
    assert.equal(draft.declaracao.folhasSalario, undefined)
    assert.equal(draft.declaracao.estabelecimentos[1].cnpjCompleto, '11222333000181')
  })

  it('atividade de Fator R exige e envia os 12 meses anteriores de folha', () => {
    const folhasSalario = [
      202507, 202508, 202509, 202510, 202511, 202512,
      202601, 202602, 202603, 202604, 202605, 202606,
    ].map((pa, index) => ({ pa, valor: index * 100 }))
    const draft = buildDeclaracaoMensalPayload({
      cnpj: '49453916000196',
      periodoApuracao: '202607',
      valorReceitaInterna: 2000,
      idAtividadeServico: 11,
      folhasSalario,
    })
    assert.deepEqual(draft.declaracao.folhasSalario, folhasSalario)
  })

  it('atividade de Fator R recusa folha incompleta', () => {
    assert.throws(
      () => buildDeclaracaoMensalPayload({
        cnpj: '49453916000196',
        periodoApuracao: '202607',
        valorReceitaInterna: 2000,
        idAtividadeServico: 11,
        folhasSalario: [{ pa: 202606, valor: 800 }],
      }),
      /12 meses anteriores/,
    )
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

describe('serpro error message', () => {
  it('extrai mensagens da SERPRO', async () => {
    const { extractSerproErrorMessage } = await import('../src/services/gestao/serpro-error-message.js')
    const msg = extractSerproErrorMessage({
      mensagens: [{ codigo: 'MSG_X', texto: 'Período em cobrança.' }],
    }, 'Bad Request')
    assert.equal(msg, 'Período em cobrança.')
  })

  it('traduz Forbidden genérico da SERPRO', async () => {
    const { humanizeSerproForbiddenMessage } = await import('../src/services/gestao/serpro-error-message.js')
    const msg = humanizeSerproForbiddenMessage('Forbidden')
    assert.match(msg, /Receita negou/i)
    assert.match(msg, /certificado A1/i)
  })
})

describe('simples-das sem debito', () => {
  it('detecta mensagem sem valor devido', () => {
    assert.equal(isSemDebitoSerproMessage('MSG_E0139: não haver valor devido', ''), true)
    assert.equal(isSemDebitoSerproMessage('Forbidden', ''), false)
  })
})
