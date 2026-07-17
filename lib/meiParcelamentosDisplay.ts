import type {
  ParcelamentoItem,
  ParcelamentoParcelaOption,
  ParcelamentoParcelaSituacao,
} from '../services/guidesMeiService'

export type ParcelaLedgerStatus = 'pago' | 'a_pagar' | 'liberada'

export type ParcelaLedgerRow = {
  id: string
  periodoApuracao: string
  label: string
  status: ParcelaLedgerStatus
  pedidoNumero: string
  modalidade?: string
  parcela: ParcelamentoParcelaOption
}

export type ParcelaStatusFilter = 'todos' | 'a_pagar' | 'pago'

export function parcelamentoNumeroKey (numero?: string | number | null): string {
  return String(numero ?? '').replace(/\D/g, '').trim()
}

export function isParcelamentoEmAberto (situacao?: string): boolean {
  return /em\s*parcelamento/i.test(situacao || '')
}

function parcelaPeriodoKey (periodo?: string | number | null): string {
  return String(periodo ?? '').replace(/\D/g, '').slice(0, 6)
}

export function periodoApuracaoToMmYyyy (periodo?: string | number | null): string | null {
  const key = parcelaPeriodoKey(periodo)
  if (key.length !== 6) return null
  return `${key.slice(4, 6)}/${key.slice(0, 4)}`
}

export function deriveParcelaLedgerStatus (
  parcela: ParcelamentoParcelaOption,
): ParcelaLedgerStatus | null {
  if (parcela.pago || parcela.situacaoParcela === 'pago') return 'pago'
  if (parcela.emAberto || parcela.situacaoParcela === 'a_pagar') return 'a_pagar'
  if (parcela.liberadaParaImpressao || parcela.situacaoParcela === 'liberada') {
    return 'liberada'
  }
  return null
}

export function parcelaLedgerStatusLabel (status: ParcelaLedgerStatus): string {
  if (status === 'pago') return 'Pago'
  if (status === 'a_pagar') return 'A pagar'
  return 'Liberado'
}

export function parcelaPermiteDownload (parcela: ParcelamentoParcelaOption): boolean {
  return (
    !parcela.pago
    && parcela.situacaoParcela !== 'pago'
    && (parcela.emAberto === true || parcela.liberadaParaImpressao === true)
  )
}

export function parcelaRowPermiteDownload (row: ParcelaLedgerRow): boolean {
  return parcelaPermiteDownload(row.parcela)
}

function competenciaSortKey (periodoApuracao: string): number {
  const key = parcelaPeriodoKey(periodoApuracao)
  return key.length === 6 ? Number(key) : 0
}

export function buildParcelaLedgerRows (
  parcelamentos: ParcelamentoItem[],
  parcelasPorNumero: Record<string, ParcelamentoParcelaOption[]>,
): ParcelaLedgerRow[] {
  const rows: ParcelaLedgerRow[] = []

  for (const pedido of parcelamentos) {
    if (!isParcelamentoEmAberto(pedido.situacao)) continue
    const numero = parcelamentoNumeroKey(pedido.numero)
    if (!numero) continue
    const parcelas = parcelasPorNumero[numero] ?? []

    for (const parcela of parcelas) {
      const status = deriveParcelaLedgerStatus(parcela)
      if (!status) continue
      const periodoApuracao = parcelaPeriodoKey(parcela.periodoApuracao)
      if (periodoApuracao.length !== 6) continue
      const label = periodoApuracaoToMmYyyy(periodoApuracao) ?? parcela.label?.trim() ?? periodoApuracao
      rows.push({
        id: `${numero}-${periodoApuracao}`,
        periodoApuracao,
        label,
        status,
        pedidoNumero: numero,
        modalidade: pedido.modalidade,
        parcela,
      })
    }
  }

  return rows.sort(
    (a, b) => competenciaSortKey(b.periodoApuracao) - competenciaSortKey(a.periodoApuracao),
  )
}

export function filterParcelaLedgerRows (
  rows: ParcelaLedgerRow[],
  filter: ParcelaStatusFilter,
): ParcelaLedgerRow[] {
  if (filter === 'a_pagar') {
    return rows.filter((row) => row.status === 'a_pagar' || row.status === 'liberada')
  }
  if (filter === 'pago') {
    return rows.filter((row) => row.status === 'pago')
  }
  return rows
}

export function parcelaLedgerRowDownloadKey (row: ParcelaLedgerRow): string {
  return row.id
}

export function situacaoParcelaLabel (p: ParcelamentoParcelaOption): string {
  const status = deriveParcelaLedgerStatus(p)
  if (!status) return 'Indisponível'
  return parcelaLedgerStatusLabel(status)
}

export type { ParcelamentoParcelaSituacao }
