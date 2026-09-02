import {
  computeMeiLimiteProgresso,
  extrairValorLimiteSimplesDaNota,
  somarNfseAutorizadasNoAnoCivil,
} from '../meiLimiteFaturamento'
import {
  getLimiteReferenciaReaisParaAno,
  getSublimiteIcmsIssReaisParaAno,
} from '../meiLimiteFaturamentoConfig'
import type { NfseRecord } from '../../services/meiNotasService'

function nota(partial: Partial<NfseRecord> & { document_type: string }): NfseRecord {
  return {
    id: '1',
    status: 'concluido',
    created_at: '2026-03-15T12:00:00.000Z',
    ...partial,
  } as NfseRecord
}

describe('limite faturamento Simples', () => {
  it('usa limite de R$ 4,8 mi e sublimite de R$ 3,6 mi', () => {
    expect(getLimiteReferenciaReaisParaAno(2026, 'simples')).toBe(4_800_000)
    expect(getSublimiteIcmsIssReaisParaAno(2026)).toBe(3_600_000)
  })

  it('soma NFS-e + NF-e + NFC-e no regime simples', () => {
    const records = [
      nota({
        id: 'a',
        document_type: 'NFSE',
        payload_json: { servico: [{ valor: { servico: 100 } }] },
      }),
      nota({
        id: 'b',
        document_type: 'NFE',
        payload_json: {
          itens: [{ codigo: '1', valor: 200 }],
        },
      }),
      nota({
        id: 'c',
        document_type: 'NFCE',
        payload_json: {
          itens: [{
            codigo: '2',
            quantidade: { comercial: 2 },
            valorUnitario: { comercial: 50 },
          }],
        },
      }),
    ]
    const sum = somarNfseAutorizadasNoAnoCivil(records, { anoCivil: 2026, regime: 'simples' })
    expect(sum.total).toBe(400)
    expect(sum.notasConsideradas).toBe(3)
  })

  it('ignora NFE no regime mei', () => {
    const records = [
      nota({
        id: 'a',
        document_type: 'NFSE',
        payload_json: { servico: [{ valor: { servico: 100 } }] },
      }),
      nota({
        id: 'b',
        document_type: 'NFE',
        payload_json: { itens: [{ valor: 999 }] },
      }),
    ]
    const sum = somarNfseAutorizadasNoAnoCivil(records, { anoCivil: 2026, regime: 'mei' })
    expect(sum.total).toBe(100)
    expect(sum.notasConsideradas).toBe(1)
  })

  it('marca sublimite quando total >= 3,6 mi', () => {
    const progresso = computeMeiLimiteProgresso([], {
      anoCivil: 2026,
      regime: 'simples',
      agregadoServidor: { totalUtilizadoReais: 3_600_000, notasConsideradas: 10 },
    })
    expect(progresso.limiteReferenciaReais).toBe(4_800_000)
    expect(progresso.sublimiteReais).toBe(3_600_000)
    expect(progresso.atingiuSublimite).toBe(true)
    expect(progresso.percentualUtilizado).toBeCloseTo(75, 5)
    expect(progresso.banda).toBe('seguro')
  })

  it('extrai valor de NF-e com valor direto no item', () => {
    const v = extrairValorLimiteSimplesDaNota(
      nota({
        document_type: 'NFE',
        payload_json: { itens: [{ valor: 1234.5 }] },
      }),
    )
    expect(v).toBe(1234.5)
  })
})
