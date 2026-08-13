-- Phase 8C — Configuração fiscal aprovada pelo contador (schema only, sem seed inventado)
-- Dados históricos permanecem UNKNOWN/null até configuração explícita.

create table if not exists company_fiscal_profiles (
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

create index if not exists idx_company_fiscal_profiles_tenant
  on company_fiscal_profiles (tenant_id, status);

create table if not exists product_fiscal_profiles (
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

create index if not exists idx_product_fiscal_profiles_tenant
  on product_fiscal_profiles (tenant_id, product_id);

create table if not exists customer_tax_profiles (
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

create table if not exists accountant_approved_fiscal_rules (
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

create index if not exists idx_accountant_rules_tenant_status
  on accountant_approved_fiscal_rules (tenant_id, status, valid_from);

create table if not exists fiscal_rule_templates (
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

create table if not exists tax_catalog_entries (
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

comment on table company_fiscal_profiles is 'Perfil fiscal base aprovado pelo contador — Phase 8C';
comment on table accountant_approved_fiscal_rules is 'Regras tributárias aprovadas pelo contador por tenant — Phase 8C';
comment on table fiscal_rule_templates is 'Templates de sugestão — NÃO autoritativos para tenant';
comment on table tax_catalog_entries is 'Catálogo de apoio — NÃO ativa tributação sem aprovação do contador';
