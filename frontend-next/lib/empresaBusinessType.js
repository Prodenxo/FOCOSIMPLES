/** Tipo de operação da empresa para finais de CFOP. */

export const DEFAULT_EMPRESA_BUSINESS_TYPE = 'RESELLER';

export const EMPRESA_BUSINESS_TYPE_OPTIONS = [
  {
    value: 'RESELLER',
    label: 'Comércio / Revenda',
    hint: 'CFOP 5102 (estadual) e 6102 (interestadual) quando não houver ST.',
  },
  {
    value: 'MANUFACTURER',
    label: 'Indústria / Produção própria',
    hint: 'CFOP 5101 (estadual) e 6101 (interestadual) quando não houver ST.',
  },
];

/** @param {string|null|undefined} value */
export function normalizeEmpresaBusinessType(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'MANUFACTURER') return 'MANUFACTURER';
  return 'RESELLER';
}
