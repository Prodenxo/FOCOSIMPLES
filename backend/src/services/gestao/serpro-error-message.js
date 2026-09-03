/**
 * Extrai mensagem legível de respostas de erro da SERPRO / Integra Contador.
 */
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
