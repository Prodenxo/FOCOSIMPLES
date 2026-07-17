/** Situação de Inscrição Estadual do destinatário (tag SEFAZ indIEDest). */

export type DestinatarioIndIeDest = '1' | '2' | '9'

export const DEFAULT_DESTINATARIO_IND_IE_DEST: DestinatarioIndIeDest = '9'

/** Texto de ajuda na secção de IE do destinatário (não confundir com IE do emitente MEI). */
export const DESTINATARIO_IE_SECTION_HINT =
  'IE do cliente (destinatário), não a IE do seu MEI. Condomínios e consumidores = não contribuinte.'

export const DESTINATARIO_IE_OPTIONS: ReadonlyArray<{
  value: DestinatarioIndIeDest
  label: string
  hint: string
}> = [
  {
    value: '9',
    label: 'Não contribuinte',
    hint: 'Consumidor, condomínio ou pessoa física — não use a IE do seu MEI aqui',
  },
  {
    value: '2',
    label: 'Isento de IE',
    hint: 'Pessoa jurídica isenta de Inscrição Estadual do cliente',
  },
  {
    value: '1',
    label: 'Contribuinte ICMS',
    hint: 'Informe a IE do destinatário (cliente) — não a IE do emitente',
  },
]

export function normalizeDestinatarioIndIeDest(value: unknown): DestinatarioIndIeDest {
  const raw = String(value ?? '').trim()
  if (raw === '1' || raw === '2' || raw === '9') return raw
  return DEFAULT_DESTINATARIO_IND_IE_DEST
}

export function buildDestinatarioIePayload(
  indIEDest: DestinatarioIndIeDest,
  inscricaoEstadual?: string,
): { indIEDest: DestinatarioIndIeDest; inscricaoEstadual?: string } {
  if (indIEDest === '1') {
    const ie = String(inscricaoEstadual ?? '').trim().replace(/\D/g, '')
    return ie ? { indIEDest, inscricaoEstadual: ie } : { indIEDest }
  }
  return { indIEDest }
}

export function getDestinatarioIeValidationMessage(
  indIEDest: DestinatarioIndIeDest,
  inscricaoEstadual: string,
  label = 'NF-e',
): string | null {
  if (indIEDest !== '1') return null
  const ie = String(inscricaoEstadual ?? '').trim().replace(/\D/g, '')
  if (!ie) {
    return `Informe a Inscrição Estadual do destinatário da ${label} (contribuinte ICMS).`
  }
  return null
}

export function humanizeFiscalEmitError(
  message: string,
  context: { nfeAtivo?: boolean; nfceAtivo?: boolean; documentType?: 'NFE' | 'NFCE' | 'NFSE' } = {},
): string {
  const raw = String(message ?? '').trim()
  if (!raw) return 'Falha ao emitir nota. Tente novamente.'

  const lower = raw.toLowerCase()

  if (
    (lower.includes('localizamos') && lower.includes('empresa'))
    || lower.includes('não há cadastro desta empresa no emissor')
    || lower.includes('nao ha cadastro desta empresa no emissor')
    || lower.includes('ainda não está cadastrada no emissor fiscal')
    || lower.includes('ainda nao esta cadastrada no emissor fiscal')
  ) {
    return 'Empresa não cadastrada no emissor fiscal. Abra Certificado → Empresa, envie o certificado (.pfx) se necessário e grave o cadastro antes de emitir.'
  }

  if (
    lower.includes('rps')
    && (lower.includes('duplic') || lower.includes('já utiliz') || lower.includes('ja utiliz') || lower.includes('em uso'))
  ) {
    return 'Numeração RPS/DPS em conflito: esse número já foi usado na PlugNotas (pode estar Pendente/Processando/Cancelado). Aguarde ou aumente o próximo número em Certificado → Empresa.'
  }

  if (
    (lower.includes('id_integracao') || lower.includes('idintegracao') || lower.includes('já foi registrad'))
    && (lower.includes('duplic') || lower.includes('unique') || lower.includes('23505'))
  ) {
    return 'Esta emissão já foi enviada. Confira a lista de notas ou aguarde alguns segundos e tente novamente.'
  }

  if (
    lower.includes('email') && lower.includes('obrigat')
  ) {
    if (context.documentType === 'NFSE') {
      return 'E-mail do prestador é obrigatório na NFS-e. Preencha em Certificado → Empresa (dados fiscais) ou confira o e-mail do tomador no catálogo de clientes.'
    }
    return 'E-mail é obrigatório para esta emissão. Verifique os dados do emitente e do destinatário.'
  }

  if (/erro interno/i.test(raw)) {
    const hints: string[] = [
      'A emissora fiscal (Plugnotas/SEFAZ) recusou a nota com erro genérico.',
    ]
    if (context.documentType === 'NFE' && context.nfeAtivo === false) {
      hints.push('Sua empresa pode não ter NF-e activa no Plugnotas — verifique em Certificado → Empresa.')
    }
    if (context.documentType === 'NFCE' && context.nfceAtivo === false) {
      hints.push('Sua empresa pode não ter NFC-e activa no Plugnotas — verifique em Certificado → Empresa.')
    }
    hints.push(
      'Revise CPF/CNPJ, razão social, endereço completo do destinatário (CEP, logradouro, IBGE), situação de IE, NCM, CFOP, quantidade e valor unitário.',
    )
    hints.push(`Detalhe: ${raw}`)
    return hints.join(' ')
  }

  return raw
}
