import fs from 'node:fs';

const path = new URL('../hooks/useAccountantFiscalProducts.js', import.meta.url);
let s = fs.readFileSync(path, 'utf8');

s = s.replace(/^import type .+\n/gm, '');
s = s.replace(/^export type .+\n/gm, '');
s = s.replace(/^type .+\n/gm, '');
s = s.replace(/: string \| null/g, '');
s = s.replace(/: string/g, '');
s = s.replace(/: boolean/g, '');
s = s.replace(/: Partial<[^>]+>/g, '');
s = s.replace(/: AccountantApprovedRule(\[\])?/g, '');
s = s.replace(/: FiscalProductGroup(\[\])?/g, '');
s = s.replace(/: NfseCatalogProduto(\[\])?/g, '');
s = s.replace(/: Record<[^>]+>/g, '');
s = s.replace(/: void \| Promise<void>/g, '');
s = s.replace(/: Promise<void>/g, '');
s = s.replace(/ as Partial<[^>]+>/g, '');
s = s.replace(/ as AccountantApprovedRule/g, '');
s = s.replace(/export function useProductFiscalConfiguration\(options: \{[\s\S]*?\}\) \{/m, 'export function useProductFiscalConfiguration(options) {');
s = s.replace(/export function useAccountantFiscalProducts\(options: \{[\s\S]*?\}\) \{/m, 'export function useAccountantFiscalProducts(options = {}) {');

fs.writeFileSync(path, s);
