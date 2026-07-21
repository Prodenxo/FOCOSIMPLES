const TECHNICAL_MARKERS = [
  'serpro',
  'backend',
  'modalidade',
  'acionamento',
  'destinatario',
  'integra contador',
  'termo de autorização',
  'jwt_token',
  'icgerenciador',
]

/**
 * Mensagens fiscais/ação do usuário que devem aparecer inteiras (ou reescritas),
 * mesmo quando longas ou com jargão técnico parcial.
 */
function rewriteKnownFiscalErrors (raw: string): string | null {
  const lower = raw.toLowerCase()

  if (
    lower.includes('procuração')
    || lower.includes('procuracao')
    || lower.includes('ecac')
    || lower.includes('e-cac')
    || /icgerenciador-022/i.test(raw)
  ) {
    return (
      'Falta procuração no e-CAC: o contratante da API (escritório) ainda não está '
      + 'autorizado a consultar o PGDAS-D deste CNPJ. Outorgue a procuração e atualize a lista.'
    )
  }

  if (/msg_e0139|sem valor devido|não foi gerado das/i.test(raw)) {
    return 'Não há DAS a pagar neste período (Receita: sem valor devido).'
  }

  if (/pgdasd_not_configured|não configurada no servidor/i.test(raw)) {
    return 'Integração Simples Nacional (PGDAS-D) não configurada no servidor.'
  }

  return null
}

export function toMeiUserErrorMessage (raw: string | null | undefined): string {
  if (!raw?.trim()) {
    return 'Não foi possível consultar agora. Tente de novo.'
  }

  const known = rewriteKnownFiscalErrors(raw)
  if (known) return known

  const lower = raw.toLowerCase()
  if (TECHNICAL_MARKERS.some((marker) => lower.includes(marker))) {
    return 'Não foi possível consultar agora. Tente de novo.'
  }
  if (raw.length > 180) {
    return 'Não foi possível consultar agora. Tente de novo.'
  }
  return raw
}
