import { parseNumberBR } from './numberFormat'

export function formatMoedaValor(value: number, moeda: string): string {
  const code = String(moeda || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0)
  } catch {
    return `${code} ${(Number(value) || 0).toFixed(2)}`
  }
}

export function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0)
}

/** Valor numérico pt-BR sem símbolo de moeda (estilo carteira). */
export function formatMoedaValorAmount(value: number, moeda: string): string {
  const code = String(moeda || 'USD').toUpperCase()
  const n = Number(value) || 0
  try {
    const parts = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: code,
    }).formatToParts(n)
    return parts
      .filter((p) => p.type !== 'currency')
      .map((p) => p.value)
      .join('')
      .trim()
  } catch {
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
}

/** Formata digitação de valor decimal pt-BR (ex.: 12.345,67) — sem símbolo de moeda. */
export function formatMoedaValorInput(text: string): string {
  const digits = text.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Converte valor formatado pt-BR para número. */
export function parseMoedaValorInput(text: string): number {
  return parseNumberBR(text)
}

/** Exibe valor salvo para edição no input. */
export function formatMoedaValorForInput(value: number): string {
  if (!Number.isFinite(value) || value < 0) return ''
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
