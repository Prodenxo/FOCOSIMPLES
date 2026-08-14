-- Phase 8D — Grupos fiscais de produtos + metadata de cenário em AccountantApprovedFiscalRule
-- Contador define grupos manualmente; sem sugestão automática.

create table if not exists fiscal_product_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  description text,
  status text not null default 'ACTIVE',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (tenant_id, id)
);

create index if not exists idx_fiscal_product_groups_tenant
  on fiscal_product_groups (tenant_id, status);

create table if not exists fiscal_product_group_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid not null,
  fiscal_product_group_id uuid not null,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id),
  constraint fiscal_product_group_memberships_group_tenant_fkey
    foreign key (tenant_id, fiscal_product_group_id)
    references fiscal_product_groups (tenant_id, id)
);

create index if not exists idx_fpg_memberships_group
  on fiscal_product_group_memberships (tenant_id, fiscal_product_group_id);

alter table accountant_approved_fiscal_rules
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists authoring_type text default 'DIRECT_RULE';

comment on table fiscal_product_groups is 'Grupos fiscais manuais do contador — Phase 8D';
comment on table fiscal_product_group_memberships is 'Vínculo produto→grupo (1 produto = 1 grupo por tenant) — Phase 8D';
comment on column accountant_approved_fiscal_rules.authoring_type is 'DIRECT_RULE | FISCAL_SCENARIO';

-- Upgrade idempotente: instalações legadas com FK simples em fiscal_product_group_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'fiscal_product_group_memberships'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fiscal_product_group_memberships_group_tenant_fkey'
  ) THEN
    ALTER TABLE fiscal_product_group_memberships
      DROP CONSTRAINT IF EXISTS fiscal_product_group_memberships_fiscal_product_group_id_fkey;
    ALTER TABLE fiscal_product_groups
      DROP CONSTRAINT IF EXISTS fiscal_product_groups_tenant_id_id_key;
    ALTER TABLE fiscal_product_groups
      ADD CONSTRAINT fiscal_product_groups_tenant_id_id_key UNIQUE (tenant_id, id);
    ALTER TABLE fiscal_product_group_memberships
      ADD CONSTRAINT fiscal_product_group_memberships_group_tenant_fkey
      FOREIGN KEY (tenant_id, fiscal_product_group_id)
      REFERENCES fiscal_product_groups (tenant_id, id);
  END IF;
END $$;
