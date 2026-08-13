/**
 * Repositório Postgres — configuração fiscal Phase 8C.
 * Tenant isolation obrigatório em todas as queries tenant-scoped.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPgPool } from '../../config/pg.js';
import { ACCOUNTANT_RULE_STATUS } from './constants.js';
import { assertValidAccountantRuleStatusTransition } from './accountant-rule-status-transitions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_FILENAME = '20260813180000_fiscal_configuration_phase8c.sql';

const MIGRATION_CANDIDATE_PATHS = [
  join(__dirname, '../../../supabase/migrations', MIGRATION_FILENAME),
  join(__dirname, '../../../../supabase/migrations', MIGRATION_FILENAME),
];

const jsonValue = (value) => {
  if (value == null) return null;
  return JSON.stringify(value);
};

/** Normaliza colunas date/timestamptz do PG para string ISO YYYY-MM-DD. */
const toIsoDateString = (value) => {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return text.slice(0, 10);
};

const mapAccountantRuleRow = (row) => (row ? {
  id: row.id,
  tenantId: row.tenant_id != null ? String(row.tenant_id) : null,
  version: row.version,
  establishmentId: row.establishment_id,
  status: row.status,
  conditions: row.conditions ?? {},
  approvedResult: row.approved_result ?? {},
  requiredFacts: row.required_facts ?? [],
  baseSpecificity: row.base_specificity ?? 0,
  validFrom: toIsoDateString(row.valid_from),
  validUntil: toIsoDateString(row.valid_until),
  configuredBy: row.configured_by,
  configuredAt: row.configured_at,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  suspendedBy: row.suspended_by,
  suspendedAt: row.suspended_at,
  revokedBy: row.revoked_by,
  revokedAt: row.revoked_at,
  justification: row.justification,
  legalSourceRefs: row.legal_source_refs ?? [],
  sourceLegalReference: row.source_legal_reference,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
} : null);

const mapCompanyFiscalProfileRow = (row) => (row ? {
  id: row.id,
  tenantId: row.tenant_id,
  companyId: row.company_id,
  establishmentId: row.establishment_id,
  crt: row.crt,
  taxRegime: row.tax_regime,
  issuerUf: row.issuer_uf,
  municipalityCode: row.municipality_code,
  stateRegistration: row.state_registration,
  stateRegistrationStatus: row.state_registration_status,
  mainCnae: row.main_cnae,
  secondaryCnaes: row.secondary_cnaes ?? [],
  isIcmsTaxpayer: row.is_icms_taxpayer,
  simplesNacionalSince: row.simples_nacional_since,
  simplesNacionalUntil: row.simples_nacional_until,
  specialTaxRegime: row.special_tax_regime,
  taxBenefitProfile: row.tax_benefit_profile ?? null,
  stateIncentives: row.state_incentives ?? null,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  status: row.status,
  configuredBy: row.configured_by,
  configuredAt: row.configured_at,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
} : null);

const mapProductFiscalProfileRow = (row) => (row ? {
  id: row.id,
  tenantId: row.tenant_id,
  productId: row.product_id,
  ncm: row.ncm,
  cest: row.cest,
  itemSource: row.item_source,
  taxClassificationStatus: row.tax_classification_status,
  pisCofinsClassification: row.pis_cofins_classification,
  monophaseClassification: row.monophase_classification,
  ipiClassification: row.ipi_classification,
  specialTaxClassification: row.special_tax_classification,
  taxCatalogRefs: row.tax_catalog_refs ?? [],
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  status: row.status,
  configuredBy: row.configured_by,
  configuredAt: row.configured_at,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
} : null);

const mapCustomerTaxProfileRow = (row) => (row ? {
  id: row.id,
  tenantId: row.tenant_id,
  customerId: row.customer_id,
  personType: row.person_type,
  country: row.country,
  uf: row.uf,
  municipalityCode: row.municipality_code,
  cpfCnpj: row.cpf_cnpj,
  stateRegistration: row.state_registration,
  stateRegistrationStatus: row.state_registration_status,
  taxpayerStatus: row.taxpayer_status,
  finalConsumerDefault: row.final_consumer_default,
  ruralProducer: row.rural_producer,
  publicEntity: row.public_entity,
  specialSituation: row.special_situation,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
} : null);

const mapFiscalRuleTemplateRow = (row) => (row ? {
  id: row.id,
  name: row.name,
  description: row.description,
  suggestedConditions: row.suggested_conditions ?? {},
  suggestedResult: row.suggested_result ?? {},
  productionReady: row.production_ready ?? false,
  authoritativeForTenant: row.authoritative_for_tenant ?? false,
  legalSourceRefs: row.legal_source_refs ?? [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
} : null);

const mapTaxCatalogEntryRow = (row) => (row ? {
  id: row.id,
  ncm: row.ncm,
  cest: row.cest,
  segment: row.segment,
  jurisdiction: row.jurisdiction,
  issuerUf: row.issuer_uf,
  destinationUf: row.destination_uf,
  taxClassification: row.tax_classification,
  stApplicabilityMetadata: row.st_applicability_metadata ?? null,
  pisCofinsClassification: row.pis_cofins_classification,
  ipiClassification: row.ipi_classification,
  ibsCbsClassification: row.ibs_cbs_classification,
  legalSourceRefs: row.legal_source_refs ?? [],
  effectiveFrom: row.effective_from,
  effectiveTo: row.effective_to,
  reviewStatus: row.review_status,
  productionReady: row.production_ready ?? false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
} : null);

const readPhase8cMigrationSql = () => {
  for (const path of MIGRATION_CANDIDATE_PATHS) {
    if (existsSync(path)) {
      return readFileSync(path, 'utf8');
    }
  }
  return null;
};

const MINIMAL_FISCAL_CONFIGURATION_SCHEMA_SQL = `
  create table if not exists public.company_fiscal_profiles (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    company_id uuid not null,
    establishment_id text not null default 'default',
    crt smallint,
    tax_regime text,
    issuer_uf char(2),
    municipality_code text,
    state_registration text,
    state_registration_status text,
    main_cnae text,
    secondary_cnaes jsonb default '[]'::jsonb,
    is_icms_taxpayer boolean,
    simples_nacional_since date,
    simples_nacional_until date,
    special_tax_regime text,
    tax_benefit_profile jsonb,
    state_incentives jsonb,
    valid_from date,
    valid_until date,
    status text not null default 'DRAFT',
    configured_by uuid,
    configured_at timestamptz,
    approved_by uuid,
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, establishment_id, valid_from)
  );

  create table if not exists public.product_fiscal_profiles (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    product_id uuid not null,
    ncm text,
    cest text,
    item_source text,
    tax_classification_status text,
    pis_cofins_classification text,
    monophase_classification text,
    ipi_classification text,
    special_tax_classification text,
    tax_catalog_refs jsonb default '[]'::jsonb,
    valid_from date,
    valid_until date,
    status text not null default 'DRAFT',
    configured_by uuid,
    configured_at timestamptz,
    approved_by uuid,
    approved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, product_id, valid_from)
  );

  create table if not exists public.customer_tax_profiles (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null,
    customer_id uuid not null,
    person_type text,
    country text default 'BR',
    uf char(2),
    municipality_code text,
    cpf_cnpj text,
    state_registration text,
    state_registration_status text,
    taxpayer_status text,
    final_consumer_default text,
    rural_producer boolean,
    public_entity boolean,
    special_situation text,
    valid_from date,
    valid_until date,
    status text not null default 'DRAFT',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_id, customer_id, valid_from)
  );

  create table if not exists public.accountant_approved_fiscal_rules (
    id text not null,
    tenant_id uuid not null,
    version integer not null default 1,
    establishment_id text,
    status text not null default 'DRAFT',
    conditions jsonb not null default '{}'::jsonb,
    approved_result jsonb not null default '{}'::jsonb,
    required_facts jsonb default '[]'::jsonb,
    base_specificity integer default 0,
    valid_from date,
    valid_until date,
    configured_by uuid,
    configured_at timestamptz,
    approved_by uuid,
    approved_at timestamptz,
    suspended_by uuid,
    suspended_at timestamptz,
    revoked_by uuid,
    revoked_at timestamptz,
    justification text,
    legal_source_refs jsonb default '[]'::jsonb,
    source_legal_reference text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (id, tenant_id, version)
  );

  create table if not exists public.fiscal_rule_templates (
    id text primary key,
    name text not null,
    description text,
    suggested_conditions jsonb default '{}'::jsonb,
    suggested_result jsonb default '{}'::jsonb,
    production_ready boolean not null default false,
    authoritative_for_tenant boolean not null default false,
    legal_source_refs jsonb default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table if not exists public.tax_catalog_entries (
    id text primary key,
    ncm text,
    cest text,
    segment text,
    jurisdiction text,
    issuer_uf char(2),
    destination_uf char(2),
    tax_classification text,
    st_applicability_metadata jsonb,
    pis_cofins_classification text,
    ipi_classification text,
    ibs_cbs_classification text,
    legal_source_refs jsonb default '[]'::jsonb,
    effective_from date,
    effective_to date,
    review_status text,
    production_ready boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
`;

/**
 * Transição atômica de status — SELECT FOR UPDATE + UPDATE com predicado de status.
 * @internal
 */
const transitionAccountantRulePg = async ({
  tenantId,
  ruleId,
  version,
  fromStatus,
  toStatus,
  setClauses = [],
  extraParams = [],
}) => {
  assertValidAccountantRuleStatusTransition(fromStatus, toStatus);

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const locked = await client.query(
      `SELECT * FROM accountant_approved_fiscal_rules
       WHERE tenant_id = $1 AND id = $2 AND version = $3
       FOR UPDATE`,
      [tenantId, ruleId, version],
    );

    if (!locked.rows.length) {
      throw new Error('Regra não encontrada');
    }

    const current = mapAccountantRuleRow(locked.rows[0]);
    if (current.status !== fromStatus) {
      throw new Error(`Status atual ${current.status} não corresponde a ${fromStatus}`);
    }

    const setParts = ['status = $4', 'updated_at = now()', ...setClauses];
    const params = [tenantId, ruleId, version, toStatus, fromStatus, ...extraParams];

    const result = await client.query(
      `UPDATE accountant_approved_fiscal_rules
       SET ${setParts.join(', ')}
       WHERE tenant_id = $1 AND id = $2 AND version = $3 AND status = $5
       RETURNING *`,
      params,
    );

    if (!result.rows.length) {
      throw new Error(`Transição ${fromStatus} → ${toStatus} falhou (concorrência ou status alterado)`);
    }

    await client.query('COMMIT');
    return mapAccountantRuleRow(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// --- Accountant Approved Rules ---

export const fetchAccountantRulesForTenantPg = async (tenantId) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM accountant_approved_fiscal_rules
     WHERE tenant_id = $1
     ORDER BY id, version`,
    [tenantId],
  );
  return result.rows.map(mapAccountantRuleRow);
};

export const fetchAccountantRulePg = async ({ tenantId, ruleId, version }) => {
  const pool = getPgPool();
  const params = [tenantId, ruleId];
  let sql = `SELECT * FROM accountant_approved_fiscal_rules
             WHERE tenant_id = $1 AND id = $2`;

  if (version != null) {
    sql += ' AND version = $3';
    params.push(version);
  } else {
    sql += ' ORDER BY version DESC LIMIT 1';
  }

  const result = await pool.query(sql, params);
  return result.rows[0] ? mapAccountantRuleRow(result.rows[0]) : null;
};

export const upsertAccountantRuleDraftPg = async (rule) => {
  const pool = getPgPool();
  const result = await pool.query(
    `INSERT INTO accountant_approved_fiscal_rules (
      id, tenant_id, version, establishment_id, status, conditions, approved_result,
      required_facts, base_specificity, valid_from, valid_until,
      configured_by, configured_at, approved_by, approved_at,
      suspended_by, suspended_at, revoked_by, revoked_at,
      justification, legal_source_refs, source_legal_reference, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,now()
    )
    ON CONFLICT (id, tenant_id, version) DO UPDATE SET
      establishment_id = EXCLUDED.establishment_id,
      conditions = EXCLUDED.conditions,
      approved_result = EXCLUDED.approved_result,
      required_facts = EXCLUDED.required_facts,
      base_specificity = EXCLUDED.base_specificity,
      valid_from = EXCLUDED.valid_from,
      valid_until = EXCLUDED.valid_until,
      configured_by = EXCLUDED.configured_by,
      configured_at = EXCLUDED.configured_at,
      justification = EXCLUDED.justification,
      legal_source_refs = EXCLUDED.legal_source_refs,
      source_legal_reference = EXCLUDED.source_legal_reference,
      updated_at = now()
    WHERE accountant_approved_fiscal_rules.status = 'DRAFT'
    RETURNING *`,
    [
      rule.id,
      rule.tenantId,
      rule.version ?? 1,
      rule.establishmentId ?? null,
      rule.status ?? ACCOUNTANT_RULE_STATUS.DRAFT,
      jsonValue(rule.conditions ?? {}),
      jsonValue(rule.approvedResult ?? {}),
      jsonValue(rule.requiredFacts ?? []),
      rule.baseSpecificity ?? 0,
      rule.validFrom ?? null,
      rule.validUntil ?? null,
      rule.configuredBy ?? null,
      rule.configuredAt ?? new Date().toISOString(),
      null,
      null,
      null,
      null,
      null,
      null,
      rule.justification ?? null,
      jsonValue(rule.legalSourceRefs ?? []),
      rule.sourceLegalReference ?? null,
    ],
  );

  if (!result.rows.length) {
    throw new Error('ACCOUNTANT_RULE_IMMUTABLE: apenas DRAFT pode ser alterado');
  }

  return mapAccountantRuleRow(result.rows[0]);
};

export const approveAccountantRulePg = async ({
  tenantId, ruleId, version, approvedBy, approvedAt, justification,
}) => {
  const existing = await fetchAccountantRulePg({ tenantId, ruleId, version });
  if (!existing) {
    throw new Error('Regra não encontrada ou não está em DRAFT');
  }

  return transitionAccountantRulePg({
    tenantId,
    ruleId,
    version,
    fromStatus: ACCOUNTANT_RULE_STATUS.DRAFT,
    toStatus: ACCOUNTANT_RULE_STATUS.APPROVED,
    setClauses: [
      'approved_by = $6',
      'approved_at = $7',
      'justification = COALESCE($8, justification)',
    ],
    extraParams: [
      approvedBy,
      approvedAt,
      justification ?? existing.justification ?? null,
    ],
  });
};

export const suspendAccountantRulePg = async ({
  tenantId, ruleId, version, suspendedBy, suspendedAt,
}) => {
  const existing = await fetchAccountantRulePg({ tenantId, ruleId, version });
  if (!existing) throw new Error('Regra não encontrada');

  return transitionAccountantRulePg({
    tenantId,
    ruleId,
    version: version ?? existing.version,
    fromStatus: ACCOUNTANT_RULE_STATUS.APPROVED,
    toStatus: ACCOUNTANT_RULE_STATUS.SUSPENDED,
    setClauses: ['suspended_by = $6', 'suspended_at = $7'],
    extraParams: [suspendedBy, suspendedAt],
  });
};

export const revokeAccountantRulePg = async ({
  tenantId, ruleId, version, revokedBy, revokedAt,
}) => {
  const existing = await fetchAccountantRulePg({ tenantId, ruleId, version });
  if (!existing) throw new Error('Regra não encontrada');

  return transitionAccountantRulePg({
    tenantId,
    ruleId,
    version: version ?? existing.version,
    fromStatus: ACCOUNTANT_RULE_STATUS.APPROVED,
    toStatus: ACCOUNTANT_RULE_STATUS.REVOKED,
    setClauses: ['revoked_by = $6', 'revoked_at = $7'],
    extraParams: [revokedBy, revokedAt],
  });
};

export const createAccountantRuleNewVersionPg = async (rule) => {
  const pool = getPgPool();
  const version = rule.version ?? 1;

  const duplicate = await fetchAccountantRulePg({
    tenantId: rule.tenantId,
    ruleId: rule.id,
    version,
  });
  if (duplicate) {
    throw new Error(`Versão ${version} já existe para regra ${rule.id}`);
  }

  const result = await pool.query(
    `INSERT INTO accountant_approved_fiscal_rules (
      id, tenant_id, version, establishment_id, status, conditions, approved_result,
      required_facts, base_specificity, valid_from, valid_until,
      configured_by, configured_at,
      approved_by, approved_at, suspended_by, suspended_at, revoked_by, revoked_at,
      justification, legal_source_refs, source_legal_reference, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,now()
    )
    RETURNING *`,
    [
      rule.id,
      rule.tenantId,
      version,
      rule.establishmentId ?? null,
      ACCOUNTANT_RULE_STATUS.DRAFT,
      jsonValue(rule.conditions ?? {}),
      jsonValue(rule.approvedResult ?? {}),
      jsonValue(rule.requiredFacts ?? []),
      rule.baseSpecificity ?? 0,
      rule.validFrom ?? null,
      rule.validUntil ?? null,
      rule.configuredBy ?? null,
      rule.configuredAt ?? new Date().toISOString(),
      null,
      null,
      null,
      null,
      null,
      null,
      rule.justification ?? null,
      jsonValue(rule.legalSourceRefs ?? []),
      rule.sourceLegalReference ?? null,
    ],
  );

  return mapAccountantRuleRow(result.rows[0]);
};

// --- Company Fiscal Profile ---

export const fetchCompanyFiscalProfilePg = async ({ tenantId, establishmentId = 'default' }) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM company_fiscal_profiles
     WHERE tenant_id = $1 AND establishment_id = $2
     ORDER BY valid_from DESC NULLS LAST
     LIMIT 1`,
    [tenantId, establishmentId],
  );
  return mapCompanyFiscalProfileRow(result.rows[0]);
};

export const upsertCompanyFiscalProfilePg = async (profile) => {
  const pool = getPgPool();
  const result = await pool.query(
    `INSERT INTO company_fiscal_profiles (
      id, tenant_id, company_id, establishment_id, crt, tax_regime, issuer_uf,
      municipality_code, state_registration, state_registration_status, main_cnae,
      secondary_cnaes, is_icms_taxpayer, simples_nacional_since, simples_nacional_until,
      special_tax_regime, tax_benefit_profile, state_incentives,
      valid_from, valid_until, status,
      configured_by, configured_at, approved_by, approved_at, updated_at
    ) VALUES (
      COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, now()
    )
    ON CONFLICT (tenant_id, establishment_id, valid_from) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      crt = EXCLUDED.crt,
      tax_regime = EXCLUDED.tax_regime,
      issuer_uf = EXCLUDED.issuer_uf,
      municipality_code = EXCLUDED.municipality_code,
      state_registration = EXCLUDED.state_registration,
      state_registration_status = EXCLUDED.state_registration_status,
      main_cnae = EXCLUDED.main_cnae,
      secondary_cnaes = EXCLUDED.secondary_cnaes,
      is_icms_taxpayer = EXCLUDED.is_icms_taxpayer,
      simples_nacional_since = EXCLUDED.simples_nacional_since,
      simples_nacional_until = EXCLUDED.simples_nacional_until,
      special_tax_regime = EXCLUDED.special_tax_regime,
      tax_benefit_profile = EXCLUDED.tax_benefit_profile,
      state_incentives = EXCLUDED.state_incentives,
      valid_until = EXCLUDED.valid_until,
      status = EXCLUDED.status,
      configured_by = EXCLUDED.configured_by,
      configured_at = EXCLUDED.configured_at,
      approved_by = EXCLUDED.approved_by,
      approved_at = EXCLUDED.approved_at,
      updated_at = now()
    RETURNING *`,
    [
      profile.id ?? null,
      profile.tenantId,
      profile.companyId ?? profile.tenantId,
      profile.establishmentId ?? 'default',
      profile.crt ?? null,
      profile.taxRegime ?? null,
      profile.issuerUf ?? null,
      profile.municipalityCode ?? null,
      profile.stateRegistration ?? null,
      profile.stateRegistrationStatus ?? null,
      profile.mainCnae ?? null,
      jsonValue(profile.secondaryCnaes ?? []),
      profile.isIcmsTaxpayer ?? null,
      profile.simplesNacionalSince ?? null,
      profile.simplesNacionalUntil ?? null,
      profile.specialTaxRegime ?? null,
      jsonValue(profile.taxBenefitProfile ?? null),
      jsonValue(profile.stateIncentives ?? null),
      profile.validFrom ?? null,
      profile.validUntil ?? null,
      profile.status ?? 'DRAFT',
      profile.configuredBy ?? null,
      profile.configuredAt ?? new Date().toISOString(),
      profile.approvedBy ?? null,
      profile.approvedAt ?? null,
    ],
  );
  return mapCompanyFiscalProfileRow(result.rows[0]);
};

// --- Product Fiscal Profile ---

export const fetchProductFiscalProfilePg = async ({ tenantId, productId }) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM product_fiscal_profiles
     WHERE tenant_id = $1 AND product_id = $2
     ORDER BY valid_from DESC NULLS LAST
     LIMIT 1`,
    [tenantId, productId],
  );
  return mapProductFiscalProfileRow(result.rows[0]);
};

export const listProductFiscalProfilesPg = async (tenantId) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM product_fiscal_profiles
     WHERE tenant_id = $1
     ORDER BY product_id, valid_from DESC NULLS LAST`,
    [tenantId],
  );
  return result.rows.map(mapProductFiscalProfileRow);
};

export const upsertProductFiscalProfilePg = async (profile) => {
  const pool = getPgPool();
  const result = await pool.query(
    `INSERT INTO product_fiscal_profiles (
      id, tenant_id, product_id, ncm, cest, item_source, tax_classification_status,
      pis_cofins_classification, monophase_classification, ipi_classification,
      special_tax_classification, tax_catalog_refs,
      valid_from, valid_until, status,
      configured_by, configured_at, approved_by, approved_at, updated_at
    ) VALUES (
      COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
      $13, $14, $15, $16, $17, $18, $19, now()
    )
    ON CONFLICT (tenant_id, product_id, valid_from) DO UPDATE SET
      ncm = EXCLUDED.ncm,
      cest = EXCLUDED.cest,
      item_source = EXCLUDED.item_source,
      tax_classification_status = EXCLUDED.tax_classification_status,
      pis_cofins_classification = EXCLUDED.pis_cofins_classification,
      monophase_classification = EXCLUDED.monophase_classification,
      ipi_classification = EXCLUDED.ipi_classification,
      special_tax_classification = EXCLUDED.special_tax_classification,
      tax_catalog_refs = EXCLUDED.tax_catalog_refs,
      valid_until = EXCLUDED.valid_until,
      status = EXCLUDED.status,
      configured_by = EXCLUDED.configured_by,
      configured_at = EXCLUDED.configured_at,
      approved_by = EXCLUDED.approved_by,
      approved_at = EXCLUDED.approved_at,
      updated_at = now()
    RETURNING *`,
    [
      profile.id ?? null,
      profile.tenantId,
      profile.productId,
      profile.ncm ?? null,
      profile.cest ?? null,
      profile.itemSource ?? null,
      profile.taxClassificationStatus ?? null,
      profile.pisCofinsClassification ?? null,
      profile.monophaseClassification ?? null,
      profile.ipiClassification ?? null,
      profile.specialTaxClassification ?? null,
      jsonValue(profile.taxCatalogRefs ?? []),
      profile.validFrom ?? null,
      profile.validUntil ?? null,
      profile.status ?? 'DRAFT',
      profile.configuredBy ?? null,
      profile.configuredAt ?? new Date().toISOString(),
      profile.approvedBy ?? null,
      profile.approvedAt ?? null,
    ],
  );
  return mapProductFiscalProfileRow(result.rows[0]);
};

// --- Customer Tax Profile ---

export const fetchCustomerTaxProfilePg = async ({ tenantId, customerId }) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM customer_tax_profiles
     WHERE tenant_id = $1 AND customer_id = $2
     ORDER BY valid_from DESC NULLS LAST
     LIMIT 1`,
    [tenantId, customerId],
  );
  return mapCustomerTaxProfileRow(result.rows[0]);
};

export const listCustomerTaxProfilesPg = async (tenantId) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM customer_tax_profiles
     WHERE tenant_id = $1
     ORDER BY customer_id, valid_from DESC NULLS LAST`,
    [tenantId],
  );
  return result.rows.map(mapCustomerTaxProfileRow);
};

export const upsertCustomerTaxProfilePg = async (profile) => {
  const pool = getPgPool();
  const result = await pool.query(
    `INSERT INTO customer_tax_profiles (
      id, tenant_id, customer_id, person_type, country, uf, municipality_code,
      cpf_cnpj, state_registration, state_registration_status, taxpayer_status,
      final_consumer_default, rural_producer, public_entity, special_situation,
      valid_from, valid_until, status, updated_at
    ) VALUES (
      COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, now()
    )
    ON CONFLICT (tenant_id, customer_id, valid_from) DO UPDATE SET
      person_type = EXCLUDED.person_type,
      country = EXCLUDED.country,
      uf = EXCLUDED.uf,
      municipality_code = EXCLUDED.municipality_code,
      cpf_cnpj = EXCLUDED.cpf_cnpj,
      state_registration = EXCLUDED.state_registration,
      state_registration_status = EXCLUDED.state_registration_status,
      taxpayer_status = EXCLUDED.taxpayer_status,
      final_consumer_default = EXCLUDED.final_consumer_default,
      rural_producer = EXCLUDED.rural_producer,
      public_entity = EXCLUDED.public_entity,
      special_situation = EXCLUDED.special_situation,
      valid_until = EXCLUDED.valid_until,
      status = EXCLUDED.status,
      updated_at = now()
    RETURNING *`,
    [
      profile.id ?? null,
      profile.tenantId,
      profile.customerId,
      profile.personType ?? null,
      profile.country ?? 'BR',
      profile.uf ?? null,
      profile.municipalityCode ?? null,
      profile.cpfCnpj ?? null,
      profile.stateRegistration ?? null,
      profile.stateRegistrationStatus ?? null,
      profile.taxpayerStatus ?? null,
      profile.finalConsumerDefault ?? null,
      profile.ruralProducer ?? null,
      profile.publicEntity ?? null,
      profile.specialSituation ?? null,
      profile.validFrom ?? null,
      profile.validUntil ?? null,
      profile.status ?? 'DRAFT',
    ],
  );
  return mapCustomerTaxProfileRow(result.rows[0]);
};

// --- Fiscal Rule Templates (global) ---

export const fetchFiscalRuleTemplatePg = async (id) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM fiscal_rule_templates WHERE id = $1 LIMIT 1`,
    [id],
  );
  return mapFiscalRuleTemplateRow(result.rows[0]);
};

export const listFiscalRuleTemplatesPg = async () => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM fiscal_rule_templates ORDER BY id`,
  );
  return result.rows.map(mapFiscalRuleTemplateRow);
};

export const upsertFiscalRuleTemplatePg = async (template) => {
  const pool = getPgPool();
  const result = await pool.query(
    `INSERT INTO fiscal_rule_templates (
      id, name, description, suggested_conditions, suggested_result,
      production_ready, authoritative_for_tenant, legal_source_refs, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      suggested_conditions = EXCLUDED.suggested_conditions,
      suggested_result = EXCLUDED.suggested_result,
      production_ready = EXCLUDED.production_ready,
      authoritative_for_tenant = EXCLUDED.authoritative_for_tenant,
      legal_source_refs = EXCLUDED.legal_source_refs,
      updated_at = now()
    RETURNING *`,
    [
      template.id,
      template.name,
      template.description ?? null,
      jsonValue(template.suggestedConditions ?? {}),
      jsonValue(template.suggestedResult ?? {}),
      template.productionReady ?? false,
      template.authoritativeForTenant ?? false,
      jsonValue(template.legalSourceRefs ?? []),
    ],
  );
  return mapFiscalRuleTemplateRow(result.rows[0]);
};

// --- Tax Catalog Entries (global) ---

export const fetchTaxCatalogEntryPg = async (id) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM tax_catalog_entries WHERE id = $1 LIMIT 1`,
    [id],
  );
  return mapTaxCatalogEntryRow(result.rows[0]);
};

export const listTaxCatalogEntriesPg = async () => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT * FROM tax_catalog_entries ORDER BY id`,
  );
  return result.rows.map(mapTaxCatalogEntryRow);
};

export const upsertTaxCatalogEntryPg = async (entry) => {
  const pool = getPgPool();
  const result = await pool.query(
    `INSERT INTO tax_catalog_entries (
      id, ncm, cest, segment, jurisdiction, issuer_uf, destination_uf,
      tax_classification, st_applicability_metadata, pis_cofins_classification,
      ipi_classification, ibs_cbs_classification, legal_source_refs,
      effective_from, effective_to, review_status, production_ready, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now()
    )
    ON CONFLICT (id) DO UPDATE SET
      ncm = EXCLUDED.ncm,
      cest = EXCLUDED.cest,
      segment = EXCLUDED.segment,
      jurisdiction = EXCLUDED.jurisdiction,
      issuer_uf = EXCLUDED.issuer_uf,
      destination_uf = EXCLUDED.destination_uf,
      tax_classification = EXCLUDED.tax_classification,
      st_applicability_metadata = EXCLUDED.st_applicability_metadata,
      pis_cofins_classification = EXCLUDED.pis_cofins_classification,
      ipi_classification = EXCLUDED.ipi_classification,
      ibs_cbs_classification = EXCLUDED.ibs_cbs_classification,
      legal_source_refs = EXCLUDED.legal_source_refs,
      effective_from = EXCLUDED.effective_from,
      effective_to = EXCLUDED.effective_to,
      review_status = EXCLUDED.review_status,
      production_ready = EXCLUDED.production_ready,
      updated_at = now()
    RETURNING *`,
    [
      entry.id,
      entry.ncm ?? null,
      entry.cest ?? null,
      entry.segment ?? null,
      entry.jurisdiction ?? null,
      entry.issuerUf ?? null,
      entry.destinationUf ?? null,
      entry.taxClassification ?? null,
      jsonValue(entry.stApplicabilityMetadata ?? null),
      entry.pisCofinsClassification ?? null,
      entry.ipiClassification ?? null,
      entry.ibsCbsClassification ?? null,
      jsonValue(entry.legalSourceRefs ?? []),
      entry.effectiveFrom ?? null,
      entry.effectiveTo ?? null,
      entry.reviewStatus ?? null,
      entry.productionReady ?? false,
    ],
  );
  return mapTaxCatalogEntryRow(result.rows[0]);
};

// --- Test helpers ---

/**
 * Advisory lock exclusivo Phase 8C test schema bootstrap.
 * Distinto de shadow/stock/emission (hashtext dedicado, test-only).
 * @internal
 */
export const FISCAL_CONFIGURATION_PHASE8C_TEST_SCHEMA_LOCK_LABEL = 'fiscal_configuration_phase8c_test_schema';

/** @internal testes — serializa bootstrap DDL entre test files paralelos */
export const __ensureFiscalConfigurationSchemaForTests = async () => {
  const pool = getPgPool();
  const client = await pool.connect();
  const migrationSql = readPhase8cMigrationSql() ?? MINIMAL_FISCAL_CONFIGURATION_SCHEMA_SQL;

  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [FISCAL_CONFIGURATION_PHASE8C_TEST_SCHEMA_LOCK_LABEL],
    );
    await client.query(migrationSql);
    await client.query(`
      ALTER TABLE accountant_approved_fiscal_rules
        ADD COLUMN IF NOT EXISTS suspended_by uuid,
        ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
        ADD COLUMN IF NOT EXISTS revoked_by uuid,
        ADD COLUMN IF NOT EXISTS revoked_at timestamptz
    `);
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure after connection error
    }
    throw error;
  } finally {
    client.release();
  }
};

/** @internal testes */
export const __deleteFiscalConfigurationForTenantTests = async (tenantId) => {
  const pool = getPgPool();
  await pool.query('DELETE FROM accountant_approved_fiscal_rules WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM company_fiscal_profiles WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM product_fiscal_profiles WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM customer_tax_profiles WHERE tenant_id = $1', [tenantId]);
};

/** @internal testes */
export const __deleteGlobalFiscalConfigurationForTests = async () => {
  const pool = getPgPool();
  await pool.query('DELETE FROM fiscal_rule_templates');
  await pool.query('DELETE FROM tax_catalog_entries');
};
