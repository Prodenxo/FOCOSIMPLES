import { Platform, Alert } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import type { DocumentType } from '../services/meiNotasService'

export type CatalogoProdutoSpreadsheetRow = {
  line: number
  codigo?: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  csosn: string
  pisCst?: string
  cofinsCst?: string
  preco?: number | string | null
}

const TEMPLATE_HEADERS = [
  'codigo',
  'descricao',
  'ncm',
  'cfop',
  'unidade',
  'csosn',
  'pisCst',
  'cofinsCst',
  'preco',
] as const

const TEMPLATE_EXAMPLE = {
  codigo: 'SKU-001',
  descricao: 'Produto exemplo',
  ncm: '22030000',
  cfop: '5102',
  unidade: 'UN',
  csosn: '102',
  pisCst: '49',
  cofinsCst: '49',
  preco: '10.00',
}

type XlsxModule = typeof import('xlsx')

let xlsxLoadPromise: Promise<XlsxModule> | null = null

async function loadXlsx (): Promise<XlsxModule> {
  if (!xlsxLoadPromise) {
    xlsxLoadPromise = import('xlsx').catch((err: unknown) => {
      xlsxLoadPromise = null
      throw new Error('Biblioteca Excel indisponível. Reinicie o app após npm install.', {
        cause: err,
      })
    })
  }
  return xlsxLoadPromise
}

function normalizeHeaderKey (raw: string): string {
  const key = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  const aliases: Record<string, string> = {
    codigo: 'codigo',
    sku: 'codigo',
    descricao: 'descricao',
    discriminacao: 'descricao',
    ncm: 'ncm',
    cfop: 'cfop',
    unidade: 'unidade',
    und: 'unidade',
    csosn: 'csosn',
    icmscsosn: 'csosn',
    icms_csosn: 'csosn',
    piscst: 'pisCst',
    pis_cst: 'pisCst',
    pis: 'pisCst',
    cofinscst: 'cofinsCst',
    cofins_cst: 'cofinsCst',
    cofins: 'cofinsCst',
    preco: 'preco',
    valor: 'preco',
    valor_sugerido: 'preco',
  }
  return aliases[key] || key
}

/**
 * Converte sheet JSON (primeira linha = cabeçalho) em rows tipadas.
 */
export function parseCatalogoProdutosSheetRows (
  records: Record<string, unknown>[],
): CatalogoProdutoSpreadsheetRow[] {
  const rows: CatalogoProdutoSpreadsheetRow[] = []
  for (let i = 0; i < records.length; i += 1) {
    const raw = records[i] || {}
    const normalized: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) {
      normalized[normalizeHeaderKey(k)] = v
    }
    const descricao = String(normalized.descricao ?? '').trim()
    const ncm = String(normalized.ncm ?? '').replace(/\D/g, '')
    const cfop = String(normalized.cfop ?? '').replace(/\D/g, '')
    const unidade = String(normalized.unidade ?? 'UN').trim() || 'UN'
    const csosn = String(normalized.csosn ?? '').replace(/\D/g, '')
    if (!descricao && !ncm && !cfop && !csosn) continue
    rows.push({
      line: i + 2,
      codigo: String(normalized.codigo ?? '').trim() || undefined,
      descricao,
      ncm,
      cfop,
      unidade,
      csosn,
      pisCst: String(normalized.pisCst ?? '').trim() || undefined,
      cofinsCst: String(normalized.cofinsCst ?? '').trim() || undefined,
      preco: normalized.preco == null || String(normalized.preco).trim() === ''
        ? null
        : normalized.preco as string | number,
    })
  }
  return rows
}

export async function parseCatalogoProdutosWorkbookBase64 (
  base64: string,
): Promise<CatalogoProdutoSpreadsheetRow[]> {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(base64, { type: 'base64' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return parseCatalogoProdutosSheetRows(records)
}

export async function downloadCatalogoProdutosTemplate (): Promise<void> {
  const XLSX = await loadXlsx()
  const worksheet = XLSX.utils.json_to_sheet([TEMPLATE_EXAMPLE], { header: [...TEMPLATE_HEADERS] })
  worksheet['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'produtos')
  const fileName = 'modelo_catalogo_produtos_nfe.xlsx'
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })

  if (Platform.OS === 'web') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  const path = `${FileSystem.cacheDirectory || ''}${fileName}`
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const canShare = await Sharing.isAvailableAsync()
  if (!canShare) {
    Alert.alert('Modelo gerado', `Arquivo salvo em cache: ${fileName}`)
    return
  }
  await Sharing.shareAsync(path, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Baixar modelo de produtos',
    UTI: 'com.microsoft.excel.xlsx',
  })
}

/**
 * Abre o seletor e devolve rows parseadas (ou null se cancelado).
 */
export async function pickAndParseCatalogoProdutosSpreadsheet (): Promise<{
  fileName: string
  rows: CatalogoProdutoSpreadsheetRow[]
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: Platform.OS === 'web'
      ? [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          '.xlsx',
          '.xls',
          '.csv',
        ]
      : [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/csv',
        ],
    copyToCacheDirectory: true,
  })
  if (result.canceled || !result.assets?.[0]) return null
  const asset = result.assets[0]
  const fileName = asset.name || 'produtos.xlsx'

  let base64: string
  if (Platform.OS === 'web') {
    const file = (asset as { file?: File }).file
    if (file) {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
      base64 = btoa(binary)
    } else {
      const res = await fetch(asset.uri)
      const buf = await res.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
      base64 = btoa(binary)
    }
  } else {
    base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
  }

  const rows = await parseCatalogoProdutosWorkbookBase64(base64)
  return { fileName, rows }
}

export function defaultSpreadsheetDocumentType (
  allowed: DocumentType[] | undefined,
): DocumentType {
  if (allowed?.includes('NFE')) return 'NFE'
  if (allowed?.includes('NFCE')) return 'NFCE'
  return 'NFE'
}
