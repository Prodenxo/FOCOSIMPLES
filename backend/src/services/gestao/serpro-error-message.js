/**
 * Extrai mensagem legível de respostas de erro da SERPRO / Integra Contador.
 */
export const humanizeSerproForbiddenMessage = (rawMessage = '') => {
  const text = String(rawMessage || '').trim()
  const lower = text.toLowerCase()
  if (
    !text
    || lower === 'forbidden'
    || lower === 'access denied'
    || lower === 'acesso negado'
  ) {
    return (
      'A Receita negou a emissão da guia (acesso proibido). '
      + 'Confira se o certificado A1 desta empresa está na aba Certificado, '
      + 'se o contrato SERPRO inclui emissão PGDAS-D (GERARDAS) e tente de novo.'
    )
  }
  return text
}

export const extractSerproErrorMessage = (rawBody, statusText = '') => {
  if (rawBody == null) {
    return String(statusText || '').trim() || 'Falha na comunicação com a Receita Federal.'
  }
  if (typeof rawBody === 'string') {
    return rawBody.trim() || String(statusText || '').trim() || 'Falha na comunicação com a Receita Federal.'
  }

  let mensagemSerpro = ''
  const m = rawBody.mensagens
  if (Array.isArray(m) && m.length > 0) {
    mensagemSerpro = m
      .map((item) => {
        if (typeof item === 'string') return item
        return item?.texto ?? item?.mensagem ?? item?.descricao ?? item?.codigo ?? ''
      })
      .filter(Boolean)
      .join(' ')
      .trim()
  } else if (typeof m === 'string') {
    mensagemSerpro = m.trim()
  }

  return (
    rawBody.message
    || rawBody.error
    || mensagemSerpro
    || String(statusText || '').trim()
    || 'Falha na comunicação com a Receita Federal.'
  )
}
