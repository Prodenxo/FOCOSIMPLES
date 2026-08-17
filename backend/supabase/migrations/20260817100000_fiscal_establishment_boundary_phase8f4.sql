-- Phase 8F.4 — Fiscal establishment boundary (workspace multi-CNPJ)
-- Nullable establishment_id preserves legacy rows without invented backfill.

alter table if exists public.fiscal_purchase_invoices
  add column if not exists establishment_id text;

alter table if exists public.fiscal_stock_lots
  add column if not exists establishment_id text;

alter table if exists public.fiscal_stock_allocation_requests
  add column if not exists establishment_id text;

alter table if exists public.fiscal_stock_allocations
  add column if not exists establishment_id text;

alter table if exists public.fiscal_v3_emission_attempts
  add column if not exists establishment_id text;

alter table if exists public.fiscal_engine_v3_rollouts
  add column if not exists establishment_id text not null default 'default';

alter table if exists public.fiscal_engine_v3_rollouts
  drop constraint if exists fiscal_engine_v3_rollouts_empresa_id_key;

create unique index if not exists fiscal_engine_v3_rollouts_empresa_establishment_uidx
  on public.fiscal_engine_v3_rollouts (empresa_id, establishment_id);

create index if not exists fiscal_stock_lots_tenant_establishment_product_idx
  on public.fiscal_stock_lots (empresa_id, establishment_id, produto_catalogo_id, data_entrada);

create index if not exists fiscal_purchase_invoices_tenant_establishment_chave_idx
  on public.fiscal_purchase_invoices (empresa_id, establishment_id, chave_nfe);

create index if not exists fiscal_v3_emission_attempts_tenant_establishment_idx
  on public.fiscal_v3_emission_attempts (empresa_id, establishment_id, created_at desc);

create index if not exists fiscal_stock_allocation_requests_tenant_establishment_key_idx
  on public.fiscal_stock_allocation_requests (empresa_id, establishment_id, allocation_request_id);
