import { Platform, Alert } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

export type ExportTransactionRow = {
  classificacao?: string | null
  valor?: number | string
  tipo?: string
  data?: string | null
  criado_em?: string | null
  status?: string | null
  obs?: string | null
}

/** Mesmo layout do Site (`Transactions.tsx` → exportToExcel) / `transacoes_YYYY-MM-DD.xlsx`. */
export function formatTransactionsForXlsx(transactions: ExportTransactionRow[]) {
  return transactions.map((t) => {
    let dataFormatada = ''
    if (t.data) {
      const dataObj = new Date(`${String(t.data).slice(0, 10)}T00:00:00-03:00`)
      dataFormatada = dataObj.toLocaleDateString('pt-BR')
    } else if (t.criado_em) {
      dataFormatada = new Date(t.criado_em).toLocaleDateString('pt-BR')
    }

    const valorNum = Number(t.valor) || 0
    const valorFormatado = valorNum.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

    const tipoRaw = String(t.tipo || '').toLowerCase()
    const tipoFormatado = tipoRaw === 'entrada' ? 'RECEITA' : 'DESPESA'

    const statusRaw = String(t.status || '').toLowerCase()
    const statusFormatado =
      statusRaw === 'recebido'
        ? 'Recebido'
        : statusRaw === 'pago'
          ? 'Pago'
          : statusRaw === 'a_receber'
            ? 'A Receber'
            : statusRaw === 'a_pagar'
              ? 'A Pagar'
              : t.status
                ? String(t.status)
                : ''

    return {
      Descrição: t.classificacao || '',
      Valor: valorFormatado,
      Tipo: tipoFormatado,
      Data: dataFormatada,
      Status: statusFormatado,
      Observações: t.obs || '-',
    }
  })
}

type XlsxModule = typeof import('xlsx')

let xlsxLoadPromise: Promise<XlsxModule> | null = null

async function loadXlsx(): Promise<XlsxModule> {
  if (!xlsxLoadPromise) {
    xlsxLoadPromise = import('xlsx').catch((err: unknown) => {
      xlsxLoadPromise = null
      const hint =
        'Instale a dependência na pasta App/frontend: npm install — depois reinicie o Expo (npm start).'
      throw new Error(`Exportação Excel indisponível. ${hint}`, { cause: err })
    })
  }
  return xlsxLoadPromise
}

function buildWorkbook(XLSX: XlsxModule, transactions: ExportTransactionRow[]) {
  const dadosFormatados = formatTransactionsForXlsx(transactions)
  const worksheet = XLSX.utils.json_to_sheet(dadosFormatados)
  worksheet['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 40 },
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transações')
  return workbook
}

export async function exportTransactionsToExcel(transactions: ExportTransactionRow[]): Promise<void> {
  if (!transactions.length) {
    const msg = 'Nenhuma transação para exportar com os filtros atuais.'
    if (Platform.OS === 'web') window.alert(msg)
    else Alert.alert('Exportar Excel', msg)
    return
  }

  const XLSX = await loadXlsx()
  const dataStr = new Date().toISOString().slice(0, 10)
  const fileName = `transacoes_${dataStr}.xlsx`
  const workbook = buildWorkbook(XLSX, transactions)

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    XLSX.writeFile(workbook, fileName)
    return
  }

  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })
  const cacheDir = FileSystem.cacheDirectory
  if (!cacheDir) {
    Alert.alert('Exportar Excel', 'Armazenamento temporário indisponível neste dispositivo.')
    return
  }

  const uri = `${cacheDir}${fileName}`
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' })

  const canShare = await Sharing.isAvailableAsync()
  if (!canShare) {
    Alert.alert('Exportar Excel', `Arquivo gerado: ${uri}`)
    return
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar transações',
    UTI: 'com.microsoft.excel.xlsx',
  })
}
