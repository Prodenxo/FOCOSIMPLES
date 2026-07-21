import { query } from './pg.js'

/**
 * Cliente Postgres com API parecida ao Supabase JS (.from/.select/.eq/.rpc).
 * Cobre o uso de mei-notas / certificado / RPS em AUTH_MODE=local.
 */

const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`

/**
 * node-pg serializa Array como literal de array Postgres (`{a,b}`), inválido em colunas json/jsonb.
 * Objetos plain já viram JSON via prepareValue; arrays precisam de stringify explícito.
 * @param {unknown} value
 * @returns {unknown}
 */
export const serializePgBindValue = (value) => {
  if (value === undefined) return null
  if (Array.isArray(value)) return JSON.stringify(value)
  return value
}

const splitSelectColumns = (raw) => {
  const text = String(raw || '*').trim()
  if (!text || text === '*') return ['*']
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      // remove quebras de linha de selects multilinha
      const cleaned = part.replace(/\s+/g, ' ').trim()
      if (cleaned === '*') return '*'
      // ignora aliases de join estilo postgrest (não usados no fluxo local)
      if (cleaned.includes('(') || cleaned.includes(':')) return null
      return cleaned
    })
    .filter(Boolean)
}

const parseOrFilter = (fragment) => {
  // PostgREST: field.op.value  (value pode conter pontos, ex. timestamps)
  const firstDot = fragment.indexOf('.')
  if (firstDot <= 0) return null
  const field = fragment.slice(0, firstDot)
  const rest = fragment.slice(firstDot + 1)
  const secondDot = rest.indexOf('.')
  if (secondDot <= 0) return null
  const op = rest.slice(0, secondDot)
  const value = rest.slice(secondDot + 1)
  return { field, op, value }
}

class PgQueryBuilder {
  constructor(table) {
    this.table = table
    this.action = 'select'
    this.columns = ['*']
    this.filters = []
    this.orGroups = []
    this.orders = []
    this.limitN = null
    this.offsetN = null
    this.payload = null
    this.onConflict = null
    this.returning = false
    this.head = false
    this.countMode = null
    this.expect = null // 'single' | 'maybeSingle'
  }

  select(columns = '*', options = {}) {
    this.action = this.action === 'insert' || this.action === 'update' || this.action === 'upsert'
      ? this.action
      : 'select'
    this.columns = splitSelectColumns(columns)
    if (options?.head) this.head = true
    if (options?.count) this.countMode = options.count
    this.returning = true
    return this
  }

  insert(rows) {
    this.action = 'insert'
    this.payload = rows
    return this
  }

  update(values) {
    this.action = 'update'
    this.payload = values
    return this
  }

  upsert(rows, options = {}) {
    this.action = 'upsert'
    this.payload = rows
    this.onConflict = options?.onConflict || null
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  eq(column, value) {
    this.filters.push({ type: 'eq', column, value })
    return this
  }

  neq(column, value) {
    this.filters.push({ type: 'neq', column, value })
    return this
  }

  gt(column, value) {
    this.filters.push({ type: 'gt', column, value })
    return this
  }

  gte(column, value) {
    this.filters.push({ type: 'gte', column, value })
    return this
  }

  lt(column, value) {
    this.filters.push({ type: 'lt', column, value })
    return this
  }

  lte(column, value) {
    this.filters.push({ type: 'lte', column, value })
    return this
  }

  is(column, value) {
    this.filters.push({ type: 'is', column, value })
    return this
  }

  in(column, values) {
    this.filters.push({ type: 'in', column, value: values })
    return this
  }

  ilike(column, value) {
    this.filters.push({ type: 'ilike', column, value })
    return this
  }

  like(column, value) {
    this.filters.push({ type: 'like', column, value })
    return this
  }

  or(expression) {
    const parts = String(expression || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map(parseOrFilter)
      .filter(Boolean)
    if (parts.length) this.orGroups.push(parts)
    return this
  }

  order(column, options = {}) {
    this.orders.push({
      column,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst === true,
    })
    return this
  }

  limit(n) {
    this.limitN = Number(n)
    return this
  }

  range(from, to) {
    const start = Number(from)
    const end = Number(to)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      this.offsetN = start
      this.limitN = end - start + 1
    }
    return this
  }

  single() {
    this.expect = 'single'
    this.limitN = 1
    return this
  }

  maybeSingle() {
    this.expect = 'maybeSingle'
    this.limitN = 1
    return this
  }

  _pushFilter(sqlParts, params, filter) {
    const col = quoteIdent(filter.column)
    switch (filter.type) {
      case 'eq':
        params.push(filter.value)
        sqlParts.push(`${col} = $${params.length}`)
        break
      case 'neq':
        params.push(filter.value)
        sqlParts.push(`${col} <> $${params.length}`)
        break
      case 'gt':
        params.push(filter.value)
        sqlParts.push(`${col} > $${params.length}`)
        break
      case 'gte':
        params.push(filter.value)
        sqlParts.push(`${col} >= $${params.length}`)
        break
      case 'lt':
        params.push(filter.value)
        sqlParts.push(`${col} < $${params.length}`)
        break
      case 'lte':
        params.push(filter.value)
        sqlParts.push(`${col} <= $${params.length}`)
        break
      case 'is':
        if (filter.value === null) sqlParts.push(`${col} IS NULL`)
        else if (filter.value === true) sqlParts.push(`${col} IS TRUE`)
        else if (filter.value === false) sqlParts.push(`${col} IS FALSE`)
        else {
          params.push(filter.value)
          sqlParts.push(`${col} IS $${params.length}`)
        }
        break
      case 'in': {
        const values = Array.isArray(filter.value) ? filter.value : []
        if (!values.length) {
          sqlParts.push('FALSE')
          break
        }
        const placeholders = values.map((v) => {
          params.push(v)
          return `$${params.length}`
        })
        sqlParts.push(`${col} IN (${placeholders.join(', ')})`)
        break
      }
      case 'ilike':
        params.push(filter.value)
        sqlParts.push(`${col} ILIKE $${params.length}`)
        break
      case 'like':
        params.push(filter.value)
        sqlParts.push(`${col} LIKE $${params.length}`)
        break
      default:
        break
    }
  }

  _pushParsedOp(sqlParts, params, { field, op, value }) {
    const col = quoteIdent(field)
    // Não usar decodeURIComponent cego: padrões ILIKE com `%17.19%` geram URIError
    // (`%17` parece escape inválido). Só decodifica quando parece %XX hex válido.
    let decoded = String(value ?? '')
    try {
      if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
        decoded = decodeURIComponent(decoded)
      }
    } catch {
      decoded = String(value ?? '')
    }
    switch (op) {
      case 'eq':
        params.push(decoded)
        sqlParts.push(`${col} = $${params.length}`)
        break
      case 'neq':
        params.push(decoded)
        sqlParts.push(`${col} <> $${params.length}`)
        break
      case 'gt':
        params.push(decoded)
        sqlParts.push(`${col} > $${params.length}`)
        break
      case 'gte':
        params.push(decoded)
        sqlParts.push(`${col} >= $${params.length}`)
        break
      case 'lt':
        params.push(decoded)
        sqlParts.push(`${col} < $${params.length}`)
        break
      case 'lte':
        params.push(decoded)
        sqlParts.push(`${col} <= $${params.length}`)
        break
      case 'is':
        if (decoded === 'null') sqlParts.push(`${col} IS NULL`)
        else if (decoded === 'true') sqlParts.push(`${col} IS TRUE`)
        else if (decoded === 'false') sqlParts.push(`${col} IS FALSE`)
        break
      case 'ilike':
        params.push(decoded)
        sqlParts.push(`${col} ILIKE $${params.length}`)
        break
      case 'like':
        params.push(decoded)
        sqlParts.push(`${col} LIKE $${params.length}`)
        break
      default:
        break
    }
  }

  _whereSql(params) {
    const parts = []
    for (const filter of this.filters) {
      this._pushFilter(parts, params, filter)
    }
    for (const group of this.orGroups) {
      const orParts = []
      for (const item of group) {
        this._pushParsedOp(orParts, params, item)
      }
      if (orParts.length) parts.push(`(${orParts.join(' OR ')})`)
    }
    if (!parts.length) return ''
    return ` WHERE ${parts.join(' AND ')}`
  }

  _orderSql() {
    if (!this.orders.length) return ''
    const chunks = this.orders.map((o) => {
      const dir = o.ascending ? 'ASC' : 'DESC'
      const nulls = o.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST'
      return `${quoteIdent(o.column)} ${dir}${nulls}`
    })
    return ` ORDER BY ${chunks.join(', ')}`
  }

  async then(resolve, reject) {
    try {
      const result = await this._execute()
      resolve(result)
    } catch (error) {
      if (typeof reject === 'function') reject(error)
      else resolve({ data: null, error })
    }
  }

  async _execute() {
    const table = quoteIdent(this.table)
    const params = []

    if (this.action === 'select') {
      const cols = this.columns.includes('*')
        ? '*'
        : this.columns.map(quoteIdent).join(', ')
      let sql = `SELECT ${cols} FROM ${table}`
      sql += this._whereSql(params)
      sql += this._orderSql()
      if (this.limitN != null && Number.isFinite(this.limitN)) {
        sql += ` LIMIT ${Math.max(0, Math.trunc(this.limitN))}`
      }
      if (this.offsetN != null && Number.isFinite(this.offsetN)) {
        sql += ` OFFSET ${Math.max(0, Math.trunc(this.offsetN))}`
      }
      const { rows } = await query(sql, params)
      return this._formatSelect(rows)
    }

    if (this.action === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload]
      if (!rows.length) return { data: null, error: null }
      const keys = Object.keys(rows[0] || {})
      if (!keys.length) return { data: null, error: { message: 'insert sem colunas' } }
      const colSql = keys.map(quoteIdent).join(', ')
      const valuesSql = rows.map((row) => {
        const placeholders = keys.map((key) => {
          params.push(serializePgBindValue(row[key]))
          return `$${params.length}`
        })
        return `(${placeholders.join(', ')})`
      }).join(', ')
      const returning = this.returning || this.expect
        ? ' RETURNING *'
        : ''
      const sql = `INSERT INTO ${table} (${colSql}) VALUES ${valuesSql}${returning}`
      const { rows: out } = await query(sql, params)
      return this._formatMutate(out, rows.length)
    }

    if (this.action === 'update') {
      const values = this.payload || {}
      const keys = Object.keys(values)
      if (!keys.length) return { data: null, error: { message: 'update sem colunas' } }
      const sets = keys.map((key) => {
        params.push(serializePgBindValue(values[key]))
        return `${quoteIdent(key)} = $${params.length}`
      })
      let sql = `UPDATE ${table} SET ${sets.join(', ')}`
      sql += this._whereSql(params)
      const returning = this.returning || this.expect ? ' RETURNING *' : ''
      sql += returning
      const { rows: out } = await query(sql, params)
      return this._formatMutate(out, out.length)
    }

    if (this.action === 'upsert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload]
      if (!rows.length) return { data: null, error: null }
      const keys = Object.keys(rows[0] || {})
      if (!keys.length) return { data: null, error: { message: 'upsert sem colunas' } }
      const conflictCols = String(this.onConflict || keys[0])
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
      const colSql = keys.map(quoteIdent).join(', ')
      const valuesSql = rows.map((row) => {
        const placeholders = keys.map((key) => {
          params.push(serializePgBindValue(row[key]))
          return `$${params.length}`
        })
        return `(${placeholders.join(', ')})`
      }).join(', ')
      const updateCols = keys.filter((k) => !conflictCols.includes(k))
      const setSql = updateCols.length
        ? updateCols.map((k) => `${quoteIdent(k)} = EXCLUDED.${quoteIdent(k)}`).join(', ')
        : `${quoteIdent(keys[0])} = EXCLUDED.${quoteIdent(keys[0])}`
      const conflictSql = conflictCols.map(quoteIdent).join(', ')
      const returning = this.returning || this.expect ? ' RETURNING *' : ''
      const sql = `INSERT INTO ${table} (${colSql}) VALUES ${valuesSql}
        ON CONFLICT (${conflictSql}) DO UPDATE SET ${setSql}${returning}`
      const { rows: out } = await query(sql, params)
      return this._formatMutate(out, rows.length)
    }

    if (this.action === 'delete') {
      let sql = `DELETE FROM ${table}`
      sql += this._whereSql(params)
      const returning = this.returning || this.expect ? ' RETURNING *' : ''
      sql += returning
      const { rows: out } = await query(sql, params)
      return this._formatMutate(out, out.length)
    }

    return { data: null, error: { message: `ação não suportada: ${this.action}` } }
  }

  _formatSelect(rows) {
    if (this.expect === 'single') {
      if (!rows.length) {
        return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } }
      }
      return { data: rows[0], error: null }
    }
    if (this.expect === 'maybeSingle') {
      return { data: rows[0] || null, error: null }
    }
    if (this.head) {
      return { data: null, error: null, count: rows.length }
    }
    return { data: rows, error: null }
  }

  _formatMutate(rows, fallbackCount) {
    if (this.expect === 'single') {
      if (!rows.length) {
        return { data: null, error: { message: 'No rows returned', code: 'PGRST116' } }
      }
      return { data: rows[0], error: null }
    }
    if (this.expect === 'maybeSingle') {
      return { data: rows[0] || null, error: null }
    }
    if (this.returning) {
      return { data: rows, error: null }
    }
    return { data: null, error: null, count: fallbackCount }
  }
}

const KNOWN_RPCS = new Set([
  'mei_nfse_reserve_rps',
  'mei_nfse_sync_rps_floor',
  'mei_nfse_set_rps_last',
])

export const createPgServiceClient = () => ({
  from(table) {
    return new PgQueryBuilder(String(table))
  },
  async rpc(fnName, params = {}) {
    const name = String(fnName || '').trim()
    if (!KNOWN_RPCS.has(name) && !/^[a-z_][a-z0-9_]*$/i.test(name)) {
      return { data: null, error: { message: `RPC inválida: ${name}` } }
    }
    try {
      if (name === 'mei_nfse_reserve_rps') {
        const { rows } = await query(
          `SELECT public.mei_nfse_reserve_rps($1, $2) AS value`,
          [params.p_cnpj, params.p_floor ?? 0],
        )
        return { data: rows[0]?.value ?? null, error: null }
      }
      if (name === 'mei_nfse_sync_rps_floor') {
        await query(`SELECT public.mei_nfse_sync_rps_floor($1, $2)`, [
          params.p_cnpj,
          params.p_floor ?? 0,
        ])
        return { data: null, error: null }
      }
      if (name === 'mei_nfse_set_rps_last') {
        await query(`SELECT public.mei_nfse_set_rps_last($1, $2)`, [
          params.p_cnpj,
          params.p_last ?? 0,
        ])
        return { data: null, error: null }
      }
      // genérico: named args não suportados — chama com valores ordenados alfabeticamente
      const keys = Object.keys(params).sort()
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
      const values = keys.map((k) => params[k])
      const { rows } = await query(
        `SELECT public.${name}(${placeholders}) AS value`,
        values,
      )
      return { data: rows[0]?.value ?? null, error: null }
    } catch (error) {
      return { data: null, error: { message: error.message || String(error) } }
    }
  },
})
