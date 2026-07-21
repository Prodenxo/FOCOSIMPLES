/**
 * Spike / diagnóstico PGDASD (Integra Contador).
 * Uso: node scripts/one-time/spike-pgdasd.mjs [CNPJ] [AAAAMM]
 * Não chama a Receita se SERPRO_* estiver incompleto.
 */
import 'dotenv/config'
import {
  inspectPgdasdSerproConfig,
  assertPgdasdSerproConfigured,
} from '../../src/services/pgdasd/client.js'
import { consultarDeclaracoesPorAno, mapDeclaracoesToPeriods } from '../../src/services/pgdasd/consultar-declaracoes.js'
import { gerarDasPgdasd } from '../../src/services/pgdasd/gerar-das.js'

const cnpj = String(process.argv[2] || process.env.SPIKE_CNPJ || '').replace(/\D/g, '')
const periodo = String(process.argv[3] || '').replace(/\D/g, '')

const cfg = inspectPgdasdSerproConfig()
console.log('[spike-pgdasd] config', cfg)

if (!cfg.configured) {
  console.log('[spike-pgdasd] Configure as variáveis SERPRO_* e rode de novo para testar CONSDECLARACAO13 / GERARDAS12.')
  process.exit(0)
}

assertPgdasdSerproConfigured()

if (cnpj.length !== 14) {
  console.log('[spike-pgdasd] Informe CNPJ: node scripts/one-time/spike-pgdasd.mjs <CNPJ14> [AAAAMM]')
  process.exit(0)
}

const ano = periodo.length === 6 ? Number(periodo.slice(0, 4)) : new Date().getFullYear()
console.log('[spike-pgdasd] consultando declarações', { cnpj: `${cnpj.slice(0, 4)}***`, ano })
const { dados } = await consultarDeclaracoesPorAno({ contribuinteCnpj: cnpj, anoCalendario: ano })
const periods = mapDeclaracoesToPeriods(dados)
console.log('[spike-pgdasd] periodos', periods.slice(0, 12))

if (periodo.length === 6) {
  console.log('[spike-pgdasd] gerando DAS', periodo)
  const das = await gerarDasPgdasd({ contribuinteCnpj: cnpj, periodoApuracao: periodo })
  console.log('[spike-pgdasd] das ok', {
    competencia: das.competencia,
    numeroDocumento: das.numeroDocumento,
    valorTotal: das.valorTotal,
    pdfLen: das.pdfBase64?.length || 0,
  })
}
