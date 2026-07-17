export function humanizeCnpjLookupError (error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { message?: string }
      if (parsed.message) {
        if (/inválido/i.test(parsed.message)) {
          return 'CNPJ inválido. Verifique os dígitos e tente novamente.'
        }
        return parsed.message
      }
    } catch {
      // ignore parse errors
    }
  }

  if (/inválido/i.test(raw)) {
    return 'CNPJ inválido. Verifique os dígitos e tente novamente.'
  }
  if (/não encontrado|404/i.test(raw)) {
    return 'CNPJ não encontrado na Receita Federal.'
  }
  if (/403|bloqueio|indisponível/i.test(raw)) {
    return 'Consulta temporariamente indisponível. Tente em instantes.'
  }
  if (/429|muitas consultas/i.test(raw)) {
    return 'Muitas consultas. Aguarde alguns segundos e tente novamente.'
  }

  const stripped = raw.replace(/^Falha ao consultar CNPJ \(\d+\):\s*/i, '').trim()
  if (stripped && stripped !== raw && stripped.length <= 160 && !stripped.startsWith('{')) {
    return stripped
  }

  if (!raw || raw.length > 120) {
    return 'Não foi possível consultar o CNPJ. Tente novamente.'
  }

  return raw
}
