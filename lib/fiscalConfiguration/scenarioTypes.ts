import type { ProductFiscalConfigForm, ProductFiscalUiStatus } from '@/lib/fiscalConfiguration/types'

export type FiscalScenarioDraftStatus = 'DRAFT' | 'APPROVED' | 'PENDING' | 'BLOCKED'

export type FiscalScenarioDraft = {
  id: string
  name: string
  form: ProductFiscalConfigForm
  status: FiscalScenarioDraftStatus
  uiStatus: ProductFiscalUiStatus
  ruleId?: string | null
}
