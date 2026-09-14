import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsPath = path.join(root, '..', 'frontend', 'hooks', 'useAccountantFiscalProducts.ts');
const outPath = path.join(root, 'hooks', 'useAccountantFiscalProducts.js');

let s = fs.readFileSync(tsPath, 'utf8');

if (!/^import \{ useCallback/m.test(s)) {
  s = `import { useCallback, useEffect, useMemo, useState } from 'react'\n${s}`;
}

s = s.replace(
  /import type \{ NfseCatalogProduto \} from '@\/services\/meiNotasService'\n/,
  '',
);
s = s.replace(
  /import \{[\s\S]*?\} from '@\/services\/accountantClientsService'/,
  `import {
  createAccountantClientProduct,
  listAccountantEstablishments,
  listAccountantProducts,
  listAccountantClients,
  updateAccountantClientProduct,
} from '@/lib/accountantFiscalApi'`,
);
s = s.replace(
  /} from '@\/services\/fiscalConfigurationService'/,
  `} from '@/lib/accountantFiscalApi'`,
);
s = s.replace(/import type \{[\s\S]*?\} from '@\/lib\/fiscalConfiguration\/types'\n\n/, '');

s = s.replace(/^type LoadState = .+\n\n/m, '');
s = s.replace(/^export type CommercialProductForm = \{[\s\S]*?\}\n\n/m, '');

s = s.replace(/: CommercialProductForm/g, '');
s = s.replace(/export function emptyCommercialProductForm\(\)/, 'export function emptyCommercialProductForm()');

s = s.replace(
  /export function useAccountantFiscalProducts\(options: \{[\s\S]*?\}\)/,
  'export function useAccountantFiscalProducts(options = {})',
);

s = s.replace(
  /export function useProductFiscalConfiguration\(options: \{[\s\S]*?\}\)/,
  'export function useProductFiscalConfiguration(options)',
);

s = s.replace(/useState<[^>]+>/g, 'useState');
s = s.replace(/useState>\(/g, 'useState(');
s = s.replace(/useCallback\(async \([^)]*\): [^)]+\) =>/g, (m) => m.replace(/: [^)]+\) =>/, ') =>'));
s = s.replace(/\): Promise<[^>]+>/g, ')');
s = s.replace(/: Partial<[^>]+>/g, '');
s = s.replace(/ as Partial<AccountantApprovedRule>/g, '');
s = s.replace(/ as AccountantApprovedRule/g, '');
s = s.replace(/: AccountantApprovedRule/g, '');
s = s.replace(/: FiscalProductListRow\[\]/g, '');
s = s.replace(/ as const/g, '');
s = s.replace(/: Record<string, \{ id: string; name: string \}>/g, '');
s = s.replace(/: Record<string, number>/g, '');
s = s.replace(/: string(\[\])?/g, '');
s = s.replace(/: boolean/g, '');
s = s.replace(/: string \| null/g, '');
s = s.replace(/\?: string/g, '');
s = s.replace(/\?: boolean/g, '');
s = s.replace(/\(clientKey: string \| null\)/, '(clientKey)');
s = s.replace(/\(clientId: string\)/g, '(clientId)');
s = s.replace(/\(nextId: string\)/, '(nextId)');
s = s.replace(/\(productId: string\)/g, '(productId)');
s = s.replace(/\(establishmentId: string\)/g, '(establishmentId)');
s = s.replace(/\(establishmentIdOverride\?: string\)/, '(establishmentIdOverride)');
s = s.replace(/\(justification\?: string\)/, '(justification)');
s = s.replace(/\(input: \{ name: string; description\?: string \}\)/, '(input)');
s = s.replace(
  /\(groupId: string,\s*input: \{ name\?: string; description\?: string \| null \},?\s*\)/,
  '(groupId, input)',
);
s = s.replace(/\(productIds: string\[\], groupId: string\)/, '(productIds, groupId)');
s = s.replace(
  /\(productId: string,\s*nextGroupId: string,\s*currentMap: Record<string, \{ id: string; name: string \}>,?\s*\)/,
  '(productId, nextGroupId, currentMap)',
);
s = s.replace(/\(productId\?: string \| null,\s*options\?: \{ keepOpen\?: boolean \},?\s*\)/, '(productId, options)');

s = s.replace(/listAccountantClientEstablishments/g, 'listAccountantEstablishments');
s = s.replace(/listAccountantClientProducts/g, 'listAccountantProducts');

s = s.replace(
  /listFiscalProductGroupProducts\(group\.id, clientId\)/g,
  'listFiscalProductGroupProducts(clientId, group.id)',
);
s = s.replace(
  /assignProductsToFiscalGroup\(nextGroupId, \[productId\], true, selectedClientId\)/g,
  'assignProductsToFiscalGroup(selectedClientId, nextGroupId, [productId], true)',
);
s = s.replace(
  /removeProductFromFiscalGroup\(currentGroupId, productId, selectedClientId\)/g,
  'removeProductFromFiscalGroup(selectedClientId, currentGroupId, productId)',
);
s = s.replace(
  /createFiscalProductGroup\(input, selectedClientId\)/g,
  'createFiscalProductGroup(selectedClientId, input)',
);
s = s.replace(
  /updateFiscalProductGroup\(groupId, input, selectedClientId\)/g,
  'updateFiscalProductGroup(selectedClientId, groupId, input)',
);
s = s.replace(
  /assignProductsToFiscalGroup\(groupId, productIds, true, selectedClientId\)/g,
  'assignProductsToFiscalGroup(selectedClientId, groupId, productIds, true)',
);
s = s.replace(
  /await assignProductsToFiscalGroup\(\s*commercialForm\.fiscalProductGroupId,\s*\[created\.id\],\s*true,\s*selectedClientId,\s*\)/g,
  `await assignProductsToFiscalGroup(
          selectedClientId,
          commercialForm.fiscalProductGroupId,
          [created.id],
          true,
        )`,
);

s = s.replace(
  /fetchProductFiscalProfile\(productId, options\.clientEmpresaId\)/g,
  'fetchProductFiscalProfile(options.clientEmpresaId, productId, establishmentId)',
);
s = s.replace(
  /previewAccountantRuleDraft\(\s*draft as Partial<AccountantApprovedRule>,\s*options\.clientEmpresaId,\s*\)/g,
  'previewAccountantRuleDraft(options.clientEmpresaId, draft)',
);
s = s.replace(
  /previewAccountantRuleDraft\(\s*draft,\s*options\.clientEmpresaId,\s*\)/g,
  'previewAccountantRuleDraft(options.clientEmpresaId, draft)',
);

s = s.replace(
  /await saveProductFiscalProfile\(\s*options\.productId,\s*\{[\s\S]*?\},\s*options\.clientEmpresaId,\s*\)/m,
  `await saveProductFiscalProfile(
        options.clientEmpresaId,
        options.productId,
        establishmentId,
        {
          productId: options.productId,
          ncm: meta.ncm,
          cest: meta.cest || undefined,
          itemSource: form.itemSource,
        },
      )`,
);

s = s.replace(
  /saved = await updateAccountantRuleDraft\(rule\.id, rule\.version, draftPayload, options\.clientEmpresaId\)/g,
  'saved = await updateAccountantRuleDraft(options.clientEmpresaId, rule.id, rule.version, draftPayload)',
);
s = s.replace(
  /saved = await createAccountantRuleDraft\(draftPayload, options\.clientEmpresaId\)/g,
  'saved = await createAccountantRuleDraft(options.clientEmpresaId, draftPayload)',
);
s = s.replace(
  /previewAccountantRuleDraft\(saved, options\.clientEmpresaId\)/g,
  'previewAccountantRuleDraft(options.clientEmpresaId, saved)',
);
s = s.replace(
  /approveAccountantRule\(rule\.id, justification, options\.clientEmpresaId\)/g,
  'approveAccountantRule(options.clientEmpresaId, rule.id, justification)',
);
s = s.replace(
  /createAccountantRuleNewVersion\(rule\.id, \{\}, options\.clientEmpresaId\)/g,
  'createAccountantRuleNewVersion(options.clientEmpresaId, rule.id, {})',
);

if (!s.includes('loadClients,')) {
  s = s.replace(
    /(\s+reload,\n)(\s+reloadProductGroups,)/,
    '$1    loadClients,\n$2',
  );
}

fs.writeFileSync(outPath, s);
console.log('Wrote', outPath);
