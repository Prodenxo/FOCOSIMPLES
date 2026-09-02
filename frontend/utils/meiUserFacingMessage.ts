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
  'runtime error',
]

/**
 * Mensagens fiscais/ação do usuário que devem aparecer inteiras (ou reescritas),
 * mesmo quando longas ou com jargão técnico parcial.
 */
function rewriteKnownFiscalErrors (raw: string): string | null {
  const lower = raw.toLowerCase()

  // Só reescreve erro real Serpro (ICGERENCIADOR-022). Não confundir com empty-state
  // genérico que só menciona "procuração" de passagem.
  if (
    /icgerenciador-022/i.test(raw)
    || /n[aã]o\s+tem\s+procura[cç][aã]o\s+autorizada/i.test(raw)
    || /acesso\s+negado[\s\S]{0,80}procura[cç][aã]o[\s\S]{0,40}ecac/i.test(raw)
  ) {
    return (
      'A Receita negou o acesso (procuração e-CAC / Autentica Procurador). '
      + 'Confira se o certificado A1 desta empresa está na aba Certificado e atualize a lista.'
    )
  }

  if (/msg_e0139|sem valor devido|não foi gerado das|pgdasd_sem_debito|sem das neste período|declarado sem valor devido/i.test(raw)) {
    return 'Não há valor devido neste período. A Receita não emite DAS quando não há imposto a pagar.'
  }

  if (/pgdasd_not_configured|não configurada no servidor/i.test(raw)) {
    return 'Integração Simples Nacional (PGDAS-D) não configurada no servidor.'
  }

  if (/cert_required_for_pgdasd|certificado a1 da empresa|autentica procurador/i.test(raw)) {
    return 'Envie o certificado A1 da própria empresa (aba Certificado) para consultar e baixar o DAS.'
  }

  if (/pgdasd_cnpj_forbidden|outro cnpj/i.test(raw)) {
    return 'Não é permitido consultar ou emitir DAS de outro CNPJ.'
  }

  if (/cert_cnpj_mismatch/i.test(raw)) {
    return 'O CNPJ do certificado diverge do CNPJ da empresa cadastrada.'
  }

  return null
}

export function toFiscalUserErrorMessage (raw: string | null | undefined): string {
  return toMeiUserErrorMessage(raw);
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
