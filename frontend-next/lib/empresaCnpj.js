import { isValidCnpjDigits } from '@/lib/validateCnpj';

export const onlyEmpresaCnpjDigits = (value) => String(value || '').replace(/\D/g, '').slice(0, 14);

export const isValidEmpresaCnpj = (cnpj) =>
  isValidCnpjDigits(onlyEmpresaCnpjDigits(cnpj || ''));

export const formatEmpresaCnpj = (value) => {
  const digits = onlyEmpresaCnpjDigits(value);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};
