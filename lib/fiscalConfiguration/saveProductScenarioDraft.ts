import {
  createAccountantRuleDraft,
  fetchCompanyFiscalProfile,
  previewAccountantRuleDraft,
  saveProductFiscalProfile,
  updateAccountantRuleDraft,
} from '@/services/fiscalConfigurationService'
import { formToRuleDraft, readCatalogNcmCest } from '@/lib/fiscalConfiguration/ruleFormMapper'
import { deriveProductFiscalUiStatus } from '@/lib/fiscalConfiguration/productFiscalStatus'
import type {
  AccountantApprovedRule,
  ProductFiscalConfigForm,
  RulePreviewResult,
} from '@/lib/fiscalConfiguration/types'

export async function saveProductScenarioDraft(input: {
  clientEmpresaId: string
  productId: string
  establishmentId: string
  form: ProductFiscalConfigForm
  catalogMetadata?: Record<string, unknown> | null
  existingRule?: AccountantApprovedRule | null
  persistProductGroupMembership?: (productId: string, groupId: string) => Promise<void>
  fiscalProductGroupId?: string
}): Promise<{ rule: AccountantApprovedRule; preview: RulePreviewResult; uiStatus: ReturnType<typeof deriveProductFiscalUiStatus> }> {
  const meta = readCatalogNcmCest(input.catalogMetadata)
  const companyProfile = await fetchCompanyFiscalProfile(input.clientEmpresaId, input.establishmentId)

  await saveProductFiscalProfile(
    input.productId,
    {
      productId: input.productId,
      ncm: meta.ncm,
      cest: meta.cest || undefined,
      itemSource: input.form.itemSource,
    },
    input.clientEmpresaId,
  )

  const existingRule = input.existingRule ?? null
  const draftPayload = formToRuleDraft(input.form, {
    productId: input.productId,
    establishmentId: input.establishmentId,
    establishmentIssuerUf: companyProfile?.issuerUf,
    crt: companyProfile?.crt,
    ncm: meta.ncm,
    ruleId: existingRule?.status === 'DRAFT' ? existingRule.id : undefined,
    version: existingRule?.status === 'DRAFT' ? existingRule.version : undefined,
  }) as Partial<AccountantApprovedRule>

  let saved: AccountantApprovedRule
  if (existingRule?.status === 'DRAFT' && existingRule.id) {
    saved = await updateAccountantRuleDraft(
      existingRule.id,
      existingRule.version,
      draftPayload,
      input.clientEmpresaId,
    )
  } else if (!existingRule || existingRule.status === 'APPROVED') {
    saved = await createAccountantRuleDraft(draftPayload, input.clientEmpresaId)
  } else {
    saved = await createAccountantRuleDraft(draftPayload, input.clientEmpresaId)
  }

  if (input.persistProductGroupMembership) {
    await input.persistProductGroupMembership(input.productId, input.fiscalProductGroupId ?? '')
  }

  const preview = await previewAccountantRuleDraft(saved, input.clientEmpresaId)
  const uiStatus = deriveProductFiscalUiStatus([saved], preview)

  return { rule: saved, preview, uiStatus }
}
