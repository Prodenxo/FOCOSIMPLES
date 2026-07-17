import type { DocumentType, NfseCatalogCliente } from '../services/meiNotasService'

export type CatalogClienteGrupo = {
  /** CPF/CNPJ só dígitos */
  documento: string
  nome: string
  email: string | null
  activeTypes: DocumentType[]
  rows: NfseCatalogCliente[]
  /** Metadados fiscais preferindo NFE, senão primeira row */
  primary: NfseCatalogCliente
}

function normalizeDoc (value: string): string {
  return String(value || '').replace(/\D/g, '')
}

function asDocType (raw: string | null | undefined): DocumentType | null {
  const t = String(raw || '').toUpperCase()
  if (t === 'NFSE' || t === 'NFE' || t === 'NFCE') return t
  return null
}

/**
 * Agrupa rows do catálogo (1 por document_type) em um cliente por CPF/CNPJ.
 * Rows inactive não devem vir da listagem default; se vierem, só entram nos tipos ativos se active !== false.
 */
export function groupCatalogoClientes (rows: NfseCatalogCliente[]): CatalogClienteGrupo[] {
  const map = new Map<string, NfseCatalogCliente[]>()
  for (const row of rows) {
    const doc = normalizeDoc(row.documento || '')
    if (!doc) continue
    const list = map.get(doc) || []
    list.push(row)
    map.set(doc, list)
  }

  const groups: CatalogClienteGrupo[] = []
  for (const [documento, list] of map.entries()) {
    const activeRows = list.filter((r) => r.active !== false)
    if (activeRows.length === 0) continue

    const sorted = [...activeRows].sort((a, b) => {
      const ta = String(a.document_type || '')
      const tb = String(b.document_type || '')
      return ta.localeCompare(tb)
    })
    const types = sorted
      .map((r) => asDocType(r.document_type))
      .filter((t): t is DocumentType => Boolean(t))
    const uniqueTypes = [...new Set(types)]
    const primary =
      sorted.find((r) => asDocType(r.document_type) === 'NFE')
      || sorted[0]

    groups.push({
      documento,
      nome: primary.nome?.trim() || sorted.find((r) => r.nome?.trim())?.nome?.trim() || documento,
      email: primary.email ?? sorted.find((r) => r.email)?.email ?? null,
      activeTypes: uniqueTypes,
      rows: sorted,
      primary,
    })
  }

  groups.sort((a, b) => {
    const aAt = a.primary.last_used_at || a.primary.updated_at || ''
    const bAt = b.primary.last_used_at || b.primary.updated_at || ''
    return bAt.localeCompare(aAt)
  })
  return groups
}

export function formatCatalogGrupoMeta (group: CatalogClienteGrupo): string {
  return group.activeTypes.join(' · ')
}
