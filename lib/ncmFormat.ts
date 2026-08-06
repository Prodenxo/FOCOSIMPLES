export const NCM_HELP_TOOLTIP =
  'O NCM é o código fiscal do produto. Digite o nome do item (ex: Caderno) para selecionar o código correto automaticamente.'

export function normalizeNcmCode(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length !== 8) return digits.slice(0, 8)
  return digits
}

export function formatNcmCodeDisplay(raw: string): string {
  const code = normalizeNcmCode(raw)
  if (code.length !== 8) return code
  return `${code.slice(0, 4)}.${code.slice(4, 6)}.${code.slice(6, 8)}`
}

/** Remove tags HTML e normaliza texto vindo da BrasilAPI/Receita. */
export function stripNcmHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanNcmDescription(raw: string): string {
  const text = stripNcmHtml(raw)
  if (!text) return ''
  return text.replace(/^[-–—\s]+/, '').trim() || text
}

export function formatNcmLabel(code: string, description: string): string {
  const display = formatNcmCodeDisplay(code)
  const desc = cleanNcmDescription(description)
  if (!display) return desc
  return desc ? `${display} - ${desc}` : display
}
