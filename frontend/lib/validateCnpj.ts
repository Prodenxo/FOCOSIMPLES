const allSameDigits = (d: string) => /^(\d)\1+$/.test(d)

/** CPF: 11 dígitos com dígitos verificadores válidos. */
export function isValidCpfDigits (digits: string): boolean {
  if (digits.length !== 11 || allSameDigits(digits)) return false

  const dvFromWeights = (len: number, startWeight: number) => {
    let sum = 0
    for (let i = 0; i < len; i += 1) {
      sum += parseInt(digits[i]!, 10) * (startWeight - i)
    }
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }

  const d1 = dvFromWeights(9, 10)
  if (d1 !== parseInt(digits[9]!, 10)) return false
  const d2 = dvFromWeights(10, 11)
  return d2 === parseInt(digits[10]!, 10)
}

/** CNPJ: 14 dígitos com dígitos verificadores válidos. */
export function isValidCnpjDigits (digits: string): boolean {
  if (digits.length !== 14 || allSameDigits(digits)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const calc = (weights: number[]) => {
    let sum = 0
    for (let i = 0; i < weights.length; i += 1) {
      sum += parseInt(digits[i]!, 10) * weights[i]!
    }
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }

  const d1 = calc(weights1)
  if (d1 !== parseInt(digits[12]!, 10)) return false
  const d2 = calc(weights2)
  return d2 === parseInt(digits[13]!, 10)
}

export function isValidCpfOrCnpjDigits (digits: string): boolean {
  if (digits.length === 11) return isValidCpfDigits(digits)
  if (digits.length === 14) return isValidCnpjDigits(digits)
  return false
}
