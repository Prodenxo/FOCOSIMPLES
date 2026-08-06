/** Tipo de operação da empresa para finais de CFOP (comércio vs indústria). */
export type EmpresaBusinessType = 'RESELLER' | 'MANUFACTURER'

export const DEFAULT_EMPRESA_BUSINESS_TYPE: EmpresaBusinessType = 'RESELLER'

export const EMPRESA_BUSINESS_TYPE_OPTIONS: Array<{
  value: EmpresaBusinessType
  label: string
  hint: string
}> = [
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
]

export function normalizeEmpresaBusinessType(
  value: string | null | undefined,
): EmpresaBusinessType {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'MANUFACTURER') return 'MANUFACTURER'
  return 'RESELLER'
}

export function getEmpresaBusinessTypeLabel(value: string | null | undefined): string {
  const type = normalizeEmpresaBusinessType(value)
  return EMPRESA_BUSINESS_TYPE_OPTIONS.find((opt) => opt.value === type)?.label
    ?? EMPRESA_BUSINESS_TYPE_OPTIONS[0].label
}
