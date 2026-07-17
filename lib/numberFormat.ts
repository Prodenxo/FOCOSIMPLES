/**
 * Funções utilitárias para formatação de números no padrão brasileiro
 * (vírgula como separador decimal)
 */

/**
 * Formata um número para exibição com vírgula como separador decimal
 * @param value - Número ou string numérica
 * @param decimals - Número de casas decimais (padrão: 2)
 * @returns String formatada (ex: "123,45")
 */
export function formatNumberBR(value: number | string, decimals: number = 2): string {
  if (value === '' || value === null || value === undefined) return '';
  
  const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  
  if (isNaN(numValue)) return '';
  
  return numValue.toFixed(decimals).replace('.', ',');
}

/**
 * Converte uma string com vírgula para número
 * @param value - String com vírgula como separador decimal (ex: "123,45")
 * @returns Número (ex: 123.45) ou NaN se inválido
 */
export function parseNumberBR(value: string): number {
  if (!value || value.trim() === '') return NaN;
  
  // Remove espaços e substitui vírgula por ponto
  const cleaned = value.trim().replace(/\./g, '').replace(',', '.');
  
  return parseFloat(cleaned);
}

/**
 * Formata um número como moeda brasileira
 * @param value - Número
 * @returns String formatada (ex: "R$ 123,45")
 */
export function formatCurrencyBR(value: number): string {
  if (isNaN(value)) return 'R$ 0,00';
  
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Valida e formata input de valor monetário
 * Permite apenas números e uma vírgula ou ponto como separador decimal
 * @param text - Texto digitado
 * @returns String formatada com vírgula
 */
export function formatCurrencyInput(text: string): string {
  if (!text) return '';
  
  // Remove tudo exceto números, vírgula e ponto
  let cleaned = text.replace(/[^\d,.]/g, '');
  
  // Substitui ponto por vírgula (padrão brasileiro)
  cleaned = cleaned.replace(/\./g, ',');
  
  // Permite apenas uma vírgula
  const parts = cleaned.split(',');
  if (parts.length > 2) {
    cleaned = parts[0] + ',' + parts.slice(1).join('');
  }
  
  // Limita a 2 casas decimais após a vírgula
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + ',' + parts[1].substring(0, 2);
  }
  
  return cleaned;
}

/**
 * Formata número de telefone celular brasileiro (11 dígitos)
 * @param value - Texto digitado
 * @returns String formatada (ex: "(11) 99999-9999")
 */
export function formatPhoneBrCell(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  const hasCountry = digits.startsWith('55');
  const localDigits = (hasCountry ? digits.slice(2) : digits).slice(0, 11);
  const countryPrefix = '55';

  if (localDigits.length <= 2) {
    return `${countryPrefix} (${localDigits}`;
  }
  if (localDigits.length <= 7) {
    return `${countryPrefix} (${localDigits.slice(0, 2)}) ${localDigits.slice(2)}`;
  }
  return `${countryPrefix} (${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
}

