import { query } from '../../src/config/pg.js';
import { bootstrapFiscalEngineRepositoryMode } from '../../src/fiscal-engine/config/fiscal-repository-mode.js';
import { tryResolveAccountantTaxForNfeItem } from '../../src/lib/nfe-like-payload-accountant-tax.js';
import { loadAccountantApprovedRulesForTenant } from '../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-loader.js';
import { resolveAccountantApprovedFiscalRule } from '../../src/fiscal-engine/fiscal-configuration/approved-rule-matcher.js';
import { buildFiscalContextV31 } from '../../src/fiscal-engine/context/build-fiscal-context.js';
import { enrichMatchingFactsForContext } from '../../src/fiscal-engine/fiscal-configuration/matching-facts-enrichment.js';
import { filterAccountantRulesForEstablishment } from '../../src/fiscal-engine/establishment/fiscal-establishment-id.js';

const TENANT = 'ab799117-229d-46db-8ed6-7a2a91afb515';
const CNPJ = '35774511000145';
const CODIGO = 'asdasdasd';

bootstrapFiscalEngineRepositoryMode();
console.log('repository mode bootstrapped');

const empresa = await query(
  'SELECT id, cnpj, razao_social, empresa FROM empresas WHERE id = $1',
  [TENANT],
);
console.log('\nEMPRESA:', empresa.rows[0]);

const rules = await query(
  `SELECT id, version, status, establishment_id,
          conditions, approved_result, updated_at
   FROM accountant_approved_fiscal_rules
   WHERE tenant_id = $1
   ORDER BY updated_at DESC
   LIMIT 15`,
  [TENANT],
);
console.log('\nRULES COUNT:', rules.rows.length);
for (const r of rules.rows) {
  const cond = r.conditions ?? {};
  const res = r.approved_result ?? {};
  console.log({
    id: r.id,
    version: r.version,
    status: r.status,
    establishment_id: r.establishment_id,
    cfop: res.cfop,
    csosn: res.csosn,
    productId: cond.productId,
    operationScope: cond.operationScope,
    updated_at: r.updated_at,
  });
}

const prod = await query(
  `SELECT id, codigo, user_id, document_type, metadata_json
   FROM mei_nfse_produtos
   WHERE replace(lower(codigo), ' ', '') = $1
   LIMIT 10`,
  [CODIGO.toLowerCase()],
);
console.log('\nCATALOG PRODUCTS:', prod.rows.map((p) => ({
  id: p.id,
  codigo: p.codigo,
  user_id: p.user_id,
  document_type: p.document_type,
  ncm: p.metadata_json?.ncm,
})));

const approved = await loadAccountantApprovedRulesForTenant(TENANT);
console.log('\nLOADED APPROVED RULES:', approved.length);

const catalogProductId = prod.rows[0]?.id ?? '538a39e5-2b04-4cc9-b0dd-9296421ca169';
console.log('\nUSING catalogProductId:', catalogProductId);

const filtered = filterAccountantRulesForEstablishment(approved, CNPJ, { requireExact: true });
console.log('FILTERED RULES FOR CNPJ:', filtered.length);
for (const r of filtered) {
  console.log(' -', r.id, r.status, r.approvedResult?.cfop, r.approvedResult?.csosn);
}

const context = buildFiscalContextV31({
  emitente: { cpfCnpj: CNPJ, crt: 1, uf: 'RJ' },
  destinatario: { cpfCnpj: '11953257704', indIEDest: '9', uf: 'RJ' },
  produto: { ncm: '61091000', produtoCatalogoId: catalogProductId, id: catalogProductId },
  item: { itemSource: 'THIRD_PARTY' },
  estoque: { priorStStatus: 'UNKNOWN', origemMercadoria: '0' },
  operacao: { tipo: 'VENDA' },
});
context.empresaId = TENANT;
const facts = await enrichMatchingFactsForContext(context);
const match = resolveAccountantApprovedFiscalRule(context, filtered, { matchingFacts: facts });
console.log('\nMATCH STATUS:', match.status);
if (match.conflictingRuleIds) console.log('CONFLICT IDS:', match.conflictingRuleIds);
if (match.matchReasons) console.log('REASONS:', match.matchReasons);

const tax = await tryResolveAccountantTaxForNfeItem({
    tenantId: TENANT,
    emitente: { cpfCnpj: CNPJ, crt: 1 },
    destinatario: { cpfCnpj: '11953257704', indIEDest: '9' },
    item: { codigo: CODIGO, ncm: '61091000' },
    originUf: 'RJ',
    destinationUf: 'RJ',
    businessType: 'RESELLER',
    catalogProductId,
    approvedRulesCache: approved,
    legacyCfopCsosnOnly: true,
});
console.log('\nBRIDGE RESULT:', tax);

process.exit(0);
