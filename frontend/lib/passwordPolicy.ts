/**
 * Política de senha forte — manter em sincronia com `backend/src/utils/passwordPolicy.js`
 * e Site/frontend/src/lib/passwordPolicy.ts.
 */
export const STRONG_PASSWORD_MIN_LENGTH = 8
export const STRONG_PASSWORD_MAX_LENGTH = 128

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/

export function validateStrongPassword (
  password: string,
): { ok: true } | { ok: false; message: string } {
  const p = String(password ?? '').trim()
  if (!p) {
    return { ok: false, message: 'Senha é obrigatória' }
  }
  if (p.length < STRONG_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `A senha deve ter no mínimo ${STRONG_PASSWORD_MIN_LENGTH} caracteres`,
    }
  }
  if (p.length > STRONG_PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      message: `A senha deve ter no máximo ${STRONG_PASSWORD_MAX_LENGTH} caracteres`,
    }
  }
  if (!/[A-Z]/.test(p)) {
    return { ok: false, message: 'Inclua pelo menos uma letra maiúscula (A-Z)' }
  }
  if (!SPECIAL_RE.test(p)) {
    return {
      ok: false,
      message: 'Inclua pelo menos um caractere especial (ex.: ! @ # $ % & * - _ = + )',
    }
  }
  return { ok: true }
}

/** Texto curto para labels / dicas de formulário */
export function strongPasswordRequirementsSummary (): string {
  return `Mínimo ${STRONG_PASSWORD_MIN_LENGTH} caracteres, com pelo menos uma maiúscula e um caractere especial.`
}

export function strongPasswordRequirementBullets (): string[] {
  return [
    `Pelo menos ${STRONG_PASSWORD_MIN_LENGTH} caracteres`,
    'Pelo menos uma letra maiúscula (A-Z)',
    'Pelo menos um caractere especial (! @ # $ % & * …)',
  ]
}

export type PasswordStrengthLevel = 'empty' | 'ruim' | 'media' | 'forte' | 'excelente'

export type PasswordCriterion = {
  id: string
  label: string
  met: boolean
  /** Exigido pelo backend para aceitar a senha. */
  required: boolean
}

export type PasswordStrengthResult = {
  level: PasswordStrengthLevel
  label: string
  /** 0–1 para a barra. */
  progress: number
  criteria: PasswordCriterion[]
  isAcceptable: boolean
}

const LEVEL_LABEL: Record<Exclude<PasswordStrengthLevel, 'empty'>, string> = {
  ruim: 'Ruim',
  media: 'Média',
  forte: 'Forte',
  excelente: 'Excelente',
}

/**
 * Avalia força visual + checklist (obrigatórios = política do servidor).
 */
export function evaluatePasswordStrength (password: string): PasswordStrengthResult {
  const p = String(password ?? '')
  const emptyCriteria: PasswordCriterion[] = [
    { id: 'len', label: `Mínimo ${STRONG_PASSWORD_MIN_LENGTH} caracteres`, met: false, required: true },
    { id: 'upper', label: 'Pelo menos uma letra maiúscula (A-Z)', met: false, required: true },
    { id: 'special', label: 'Pelo menos um caractere especial (! @ # $ % …)', met: false, required: true },
    { id: 'lower', label: 'Pelo menos uma letra minúscula (a-z)', met: false, required: false },
    { id: 'digit', label: 'Pelo menos um número (0-9)', met: false, required: false },
    { id: 'len12', label: '12+ caracteres (recomendado)', met: false, required: false },
  ]

  if (!p) {
    return {
      level: 'empty',
      label: '',
      progress: 0,
      criteria: emptyCriteria,
      isAcceptable: false,
    }
  }

  const hasLen = p.length >= STRONG_PASSWORD_MIN_LENGTH
  const hasUpper = /[A-Z]/.test(p)
  const hasSpecial = SPECIAL_RE.test(p)
  const hasLower = /[a-z]/.test(p)
  const hasDigit = /\d/.test(p)
  const hasLen12 = p.length >= 12
  const hasLen16 = p.length >= 16

  const criteria: PasswordCriterion[] = [
    { id: 'len', label: `Mínimo ${STRONG_PASSWORD_MIN_LENGTH} caracteres`, met: hasLen, required: true },
    { id: 'upper', label: 'Pelo menos uma letra maiúscula (A-Z)', met: hasUpper, required: true },
    { id: 'special', label: 'Pelo menos um caractere especial (! @ # $ % …)', met: hasSpecial, required: true },
    { id: 'lower', label: 'Pelo menos uma letra minúscula (a-z)', met: hasLower, required: false },
    { id: 'digit', label: 'Pelo menos um número (0-9)', met: hasDigit, required: false },
    { id: 'len12', label: '12+ caracteres (recomendado)', met: hasLen12, required: false },
  ]

  const isAcceptable = validateStrongPassword(p).ok === true

  let score = 0
  if (hasLen) score += 1
  if (hasUpper) score += 1
  if (hasSpecial) score += 1
  if (hasLower) score += 1
  if (hasDigit) score += 1
  if (hasLen12) score += 1
  if (hasLen16) score += 1

  let level: Exclude<PasswordStrengthLevel, 'empty'>
  if (!isAcceptable) {
    level = 'ruim'
  } else if (score >= 6 && hasLen16 && hasLower && hasDigit) {
    level = 'excelente'
  } else if (score >= 5 && hasLen12 && (hasLower || hasDigit)) {
    level = 'forte'
  } else {
    level = 'media'
  }

  const progressByLevel: Record<Exclude<PasswordStrengthLevel, 'empty'>, number> = {
    ruim: Math.max(0.15, Math.min(0.35, score / 7)),
    media: 0.55,
    forte: 0.78,
    excelente: 1,
  }

  return {
    level,
    label: LEVEL_LABEL[level],
    progress: progressByLevel[level],
    criteria,
    isAcceptable,
  }
}
