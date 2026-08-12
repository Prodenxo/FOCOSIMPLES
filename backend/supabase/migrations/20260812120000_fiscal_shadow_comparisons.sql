-- Fiscal Engine v3.1 — shadow comparisons (Fase 7A hardening)
-- Observabilidade only — não altera emissão legada

create table if not exists public.fiscal_shadow_comparisons (
  id uuid primary key default gen_random_uuid(),
  comparison_id text not null unique,
  empresa_id uuid not null,
  user_id uuid,
  correlation_id text not null,
  emission_attempt_id text not null,
  execution_status varchar(32) not null,
  engine_schema_version varchar(16) not null default '3.1.0',
  legacy_version varchar(64),
  v3_version varchar(16),
  legacy_snapshot_json jsonb not null default '{}'::jsonb,
  v3_snapshot_json jsonb not null default '{}'::jsonb,
  differences_json jsonb not null default '[]'::jsonb,
  summary_json jsonb not null default '{}'::jsonb,
  issues_json jsonb not null default '[]'::jsonb,
  audit_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fiscal_shadow_comparisons_idempotency
    unique (empresa_id, correlation_id, emission_attempt_id)
);

create index if not exists idx_fiscal_shadow_comparisons_empresa
  on public.fiscal_shadow_comparisons (empresa_id, created_at desc);

comment on table public.fiscal_shadow_comparisons is
  'Comparações shadow legado × v3 — fail-open, sem impacto na emissão.';
