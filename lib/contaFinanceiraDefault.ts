import type { ContaFinanceira } from './contaFinanceiraTypes'

/** Nome da carteira/conta padrão do produto Meu Financeiro. */
export const DEFAULT_CONTA_NOME = 'Meu Financeiro'

const DEFAULT_CONTA_NAME_KEYS = [
  'meu financeiro',
  'carteira',
  'carteira principal',
  'dinheiro',
  'principal',
]

export function normalizeContaNomeKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function pickDefaultContaFinanceira(
  contas: ContaFinanceira[],
): ContaFinanceira | null {
  const active = contas.filter((c) => c.ativo)
  if (!active.length) return null

  const findByKeys = (keys: string[]) =>
    active.find((c) => keys.includes(normalizeContaNomeKey(c.nome)))

  const branded = findByKeys([normalizeContaNomeKey(DEFAULT_CONTA_NOME)])
  if (branded) return branded

  const alias = findByKeys(DEFAULT_CONTA_NAME_KEYS)
  if (alias) return alias

  const dinheiro = active.filter((c) => c.tipo === 'dinheiro')
  if (dinheiro.length === 1) return dinheiro[0]
  if (dinheiro.length > 1) {
    const hinted = dinheiro.find((c) => {
      const key = normalizeContaNomeKey(c.nome)
      return DEFAULT_CONTA_NAME_KEYS.some((hint) => key.includes(hint))
    })
    if (hinted) return hinted
  }

  if (active.length === 1) return active[0]

  const sorted = [...active].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
  )
  return sorted[0] ?? null
}

export function sortContasWithDefaultFirst(contas: ContaFinanceira[]): ContaFinanceira[] {
  const def = pickDefaultContaFinanceira(contas)
  if (!def) return contas
  const rest = contas.filter((c) => c.id !== def.id)
  return [def, ...rest]
}

export function isDefaultContaFinanceira(
  conta: ContaFinanceira,
  contas: ContaFinanceira[],
): boolean {
  const def = pickDefaultContaFinanceira(contas)
  return Boolean(def && def.id === conta.id)
}
