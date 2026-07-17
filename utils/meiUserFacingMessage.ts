const TECHNICAL_MARKERS = [
  'serpro',
  'backend',
  'modalidade',
  'acionamento',
  'destinatario',
  'integra contador',
  'termo de autorização',
]

export function toMeiUserErrorMessage (raw: string | null | undefined): string {
  if (!raw?.trim()) {
    return 'Não foi possível consultar agora. Tente de novo.'
  }
  const lower = raw.toLowerCase()
  if (TECHNICAL_MARKERS.some((marker) => lower.includes(marker))) {
    return 'Não foi possível consultar agora. Tente de novo.'
  }
  if (raw.length > 120) {
    return 'Não foi possível consultar agora. Tente de novo.'
  }
  return raw
}
