import {
  createAccountantRuleDraft,
  fetchCompanyFiscalProfile,
  previewAccountantRuleDraft,
  saveProductFiscalProfile,
  updateAccountantRuleDraft,
} from '@/lib/accountantFiscalApi';
import { formToRuleDraft, readCatalogNcmCest } from '@/lib/fiscalConfiguration/ruleFormMapper';
import { deriveProductFiscalUiStatus } from '@/lib/fiscalConfiguration/productFiscalStatus';

export async function saveProductScenarioDraft(input) {
  const meta = readCatalogNcmCest(input.catalogMetadata);
  const companyProfile = await fetchCompanyFiscalProfile(input.clientEmpresaId, input.establishmentId);

  await saveProductFiscalProfile(input.clientEmpresaId, input.productId, input.establishmentId, {
    productId: input.productId,
    ncm: meta.ncm,
    cest: meta.cest || undefined,
    itemSource: input.form.itemSource,
  });

  const existingRule = input.existingRule ?? null;
  const draftPayload = formToRuleDraft(input.form, {
    productId: input.productId,
    establishmentId: input.establishmentId,
    establishmentIssuerUf: companyProfile?.issuerUf,
    crt: companyProfile?.crt,
    ncm: meta.ncm,
    ruleId: existingRule?.status === 'DRAFT' ? existingRule.id : undefined,
    version: existingRule?.status === 'DRAFT' ? existingRule.version : undefined,
  });

  let saved;
  if (existingRule?.status === 'DRAFT' && existingRule.id) {
    saved = await updateAccountantRuleDraft(
      input.clientEmpresaId,
      existingRule.id,
      existingRule.version,
      draftPayload,
    );
  } else {
    saved = await createAccountantRuleDraft(input.clientEmpresaId, draftPayload);
  }

  if (input.persistProductGroupMembership) {
    await input.persistProductGroupMembership(input.productId, input.fiscalProductGroupId ?? '');
  }

  const preview = await previewAccountantRuleDraft(input.clientEmpresaId, saved);
  const uiStatus = deriveProductFiscalUiStatus([saved], preview);

  return { rule: saved, preview, uiStatus };
}
