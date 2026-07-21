import { formatCurrencyBR } from './numberFormat'
import {
  extrairValorLimiteSimplesDaNota,
  resolverPayloadJsonDaNota,
  resolverResponseJsonDaNota,
} from './meiLimiteFaturamento'
import type { NfseRecord } from '../services/meiNotasService'

function asRecord (value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickNome (value: unknown): string {
  return String(value ?? '').trim()
}

/** Remove prefixo técnico (`mei-`, `fs-`, …) da label de integração. */
export function formatNotaIntegracaoLabel (idIntegracao?: string | null): string {
  const raw = String(idIntegracao || '').trim()
  if (!raw) return ''
  return raw.replace(/^(mei|fs|sn|nfse|nfe|nfce)-/i, '')
}

export function extractNotaClienteNome (nota: Pick<NfseRecord, 'payload_json' | 'response_json' | 'cnpj_tomador'>): string {
  const sources = [resolverPayloadJsonDaNota(nota as NfseRecord), resolverResponseJsonDaNota(nota as NfseRecord)]
  for (const src of sources) {
    if (!src) continue
    const tomador = asRecord(src.tomador) || asRecord(src.tomadores)
    const destinatario = asRecord(src.destinatario) || asRecord(src.destinatarioNota)
    const nome =
      pickNome(tomador?.razaoSocial)
      || pickNome(tomador?.nome)
      || pickNome(destinatario?.razaoSocial)
      || pickNome(destinatario?.nome)
      || pickNome(src.tomadorRazaoSocial)
      || pickNome(src.destinatarioRazaoSocial)
    if (nome) return nome
  }
  return ''
}

export function extractNotaValorReais (nota: NfseRecord): number | null {
  return extrairValorLimiteSimplesDaNota(nota)
}

export function formatNotaValorLabel (nota: NfseRecord): string | null {
  const valor = extractNotaValorReais(nota)
  if (valor === null) return null
  return formatCurrencyBR(valor)
}

/** Título principal do card: cliente > protocolo > id limpo (sem prefixo mei/fs). */
export function resolveNotaCardTitle (nota: Pick<
  NfseRecord,
  'id' | 'protocol' | 'plugnotas_id' | 'id_integracao' | 'payload_json' | 'response_json' | 'cnpj_tomador'
>): string {
  if (nota.id === '__emit_pending__') return 'Enviando nota…'
  const cliente = extractNotaClienteNome(nota)
  if (cliente) return cliente
  if (nota.protocol) return `Protocolo ${nota.protocol}`
  const cleanId = formatNotaIntegracaoLabel(nota.id_integracao)
  if (cleanId) return cleanId
  return String(nota.plugnotas_id || nota.id)
}
