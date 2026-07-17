export interface ContaMoedaGlobal {
  id: string
  user_id: string
  moeda: string
  nome: string | null
  valor: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface ContaMoedaGlobalInput {
  moeda: string
  nome?: string | null
  valor: number
  ativo?: boolean
}

export const POPULAR_MOEDAS = [
  'USD', 'EUR', 'GBP', 'JPY', 'ARS', 'CAD', 'CHF', 'AUD', 'CNY', 'MXN',
] as const

export function normalizeContaMoedaGlobalRow(row: Record<string, unknown>): ContaMoedaGlobal {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    moeda: String(row.moeda || '').toUpperCase(),
    nome: row.nome != null ? String(row.nome) : null,
    valor: Number(row.valor) || 0,
    ativo: row.ativo !== false,
    criado_em: String(row.criado_em || ''),
    atualizado_em: String(row.atualizado_em || ''),
  }
}
