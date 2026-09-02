import { isValidCnpjDigits } from './validateCnpj'

export const onlyEmpresaCnpjDigits = (value: string) => value.replace(/\D/g, '').slice(0, 14)

export const isValidEmpresaCnpj = (cnpj?: string | null) =>
  isValidCnpjDigits(onlyEmpresaCnpjDigits(cnpj || ''))

export const formatEmpresaCnpj = (value: string) => {
  const digits = onlyEmpresaCnpjDigits(value)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}
