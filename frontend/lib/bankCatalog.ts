import type { ContaFinanceiraTipo } from './contaFinanceiraTypes'

/** ID salvo em `contas_financeiras.instituicao_id`. */
export type BankCatalogId = string

export type BankCatalogEntry = {
  id: BankCatalogId
  /** Nome exibido no app. */
  nome: string
  /**
   * Slug aceito por `@edusites/bancos-brasil` (`svgBanco({ nome })`).
   * Se omitido, só fallback com iniciais.
   */
  libraryNome?: string
  cor: string
  keywords?: string[]
  defaultTipo?: ContaFinanceiraTipo
}

export const CUSTOM_BANK_ID = 'personalizada' as const

/** Catálogo alinhado aos nomes da lib `@edusites/bancos-brasil`. */
export const BANK_CATALOG: BankCatalogEntry[] = [
  { id: 'nubank', nome: 'Nubank', libraryNome: 'nubank', cor: '#820AD1', keywords: ['nu'] },
  { id: 'itau', nome: 'Itaú', libraryNome: 'itau', cor: '#EC7000' },
  { id: 'bradesco', nome: 'Bradesco', libraryNome: 'bradesco', cor: '#CC092F' },
  { id: 'santander', nome: 'Santander', libraryNome: 'santander', cor: '#EC0000' },
  {
    id: 'bb',
    nome: 'Banco do Brasil',
    libraryNome: 'bancodobrasil',
    cor: '#003D7A',
    keywords: ['banco do brasil', 'bb'],
  },
  { id: 'caixa', nome: 'Caixa', libraryNome: 'caixa', cor: '#0066A1', keywords: ['cef'] },
  { id: 'inter', nome: 'Inter', libraryNome: 'inter', cor: '#FF7A00', keywords: ['banco inter'] },
  { id: 'c6', nome: 'C6 Bank', libraryNome: 'c6', cor: '#121212', keywords: ['c6 bank'] },
  { id: 'picpay', nome: 'PicPay', libraryNome: 'picpay', cor: '#21C25E' },
  { id: 'mercadopago', nome: 'Mercado Pago', libraryNome: 'mercadopago', cor: '#00BCFF' },
  { id: 'neon', nome: 'Neon', libraryNome: 'neon', cor: '#161C3E' },
  { id: 'next', nome: 'Next', libraryNome: 'next', cor: '#00FF5F' },
  { id: 'btg', nome: 'BTG Pactual', libraryNome: 'btg', cor: '#001E62', keywords: ['btg'] },
  { id: 'xp', nome: 'XP', libraryNome: 'xp', cor: '#000000', keywords: ['xp investimentos'] },
  { id: 'safra', nome: 'Safra', libraryNome: 'safra', cor: '#151D43' },
  { id: 'original', nome: 'Original', libraryNome: 'original', cor: '#00A857' },
  { id: 'pagbank', nome: 'PagBank', libraryNome: 'pagbank', cor: '#42A936', keywords: ['pagseguro'] },
  { id: 'sicredi', nome: 'Sicredi', libraryNome: 'sicredi', cor: '#3DAE2B' },
  { id: 'sicoob', nome: 'Sicoob', libraryNome: 'sicoob', cor: '#003B43' },
  { id: 'cora', nome: 'Cora', libraryNome: 'cora', cor: '#FE3E6D' },
  { id: 'digio', nome: 'Digio', libraryNome: 'digio', cor: '#00275C' },
  { id: 'stone', nome: 'Stone', libraryNome: 'stone', cor: '#00A868' },
  { id: 'bmg', nome: 'BMG', libraryNome: 'bmg', cor: '#F26321' },
  { id: 'pan', nome: 'Banco Pan', libraryNome: 'pan', cor: '#414141' },
  { id: 'rico', nome: 'Rico', libraryNome: 'rico', cor: '#010042' },
  { id: 'dinheiro', nome: 'Dinheiro', cor: '#22C55E', defaultTipo: 'dinheiro', keywords: ['cash', 'especie'] },
]

const catalogById = new Map(BANK_CATALOG.map((b) => [b.id, b]))

function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function findBankById(id: string | null | undefined): BankCatalogEntry | undefined {
  if (!id || id === CUSTOM_BANK_ID) return undefined
  return catalogById.get(id)
}

export function resolveLibraryNome(entry: BankCatalogEntry | undefined): string | null {
  return entry?.libraryNome ?? null
}

export function findBankByNome(nome: string): BankCatalogEntry | undefined {
  const q = normalizeSearch(nome)
  if (!q) return undefined
  const exact = BANK_CATALOG.find((b) => normalizeSearch(b.nome) === q)
  if (exact) return exact
  return BANK_CATALOG.find((b) => {
    if (normalizeSearch(b.nome).includes(q) || q.includes(normalizeSearch(b.nome))) return true
    return b.keywords?.some((k) => q.includes(normalizeSearch(k)) || normalizeSearch(k).includes(q))
  })
}

export function filterBanksByQuery(query: string): BankCatalogEntry[] {
  const q = normalizeSearch(query)
  if (!q) return BANK_CATALOG
  return BANK_CATALOG.filter((b) => {
    if (normalizeSearch(b.nome).includes(q)) return true
    return b.keywords?.some((k) => normalizeSearch(k).includes(q))
  })
}

export function bankInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
