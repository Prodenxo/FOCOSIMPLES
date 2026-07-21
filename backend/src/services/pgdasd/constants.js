/**
 * Constantes Integra Contador — PGDAS-D (Simples Nacional).
 * @see https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/solucoes/integra-sn/pgdasd/
 */

export const PGDASD_SISTEMA = 'PGDASD'

export const PGDASD_SERVICOS = Object.freeze({
  /** Entregar declaração mensal */
  TRANSDECLARACAO: 'TRANSDECLARACAO11',
  /** Gerar DAS de declaração transmitida */
  GERARDAS: 'GERARDAS12',
  /** Consultar declarações transmitidas */
  CONSDECLARACAO: 'CONSDECLARACAO13',
  /** Última declaração/recibo */
  CONSULTIMADECREC: 'CONSULTIMADECREC14',
  /** Declaração/recibo */
  CONSDECREC: 'CONSDECREC15',
  /** Extrato do DAS */
  CONSEXTRATO: 'CONSEXTRATO16',
  GERARDASCOBRANCA: 'GERARDASCOBRANCA17',
  GERARDASPROCESSO: 'GERARDASPROCESSO18',
  GERARDASAVULSO: 'GERARDASAVULSO19',
})

export const PGDASD_VERSAO = '1.0'

/** Portal público PGDAS-D (fallback quando API indisponível). */
export const PGDASD_PORTAL_URL =
  'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATBHE/pgdasd.app/Identificacao'

export const SIMPLES_DAS_NOT_CONFIGURED =
  'Integração Simples Nacional (PGDAS-D) não configurada. Configure SERPRO_* no servidor (Integra Contador).'
