-- Fiscal Engine v3.1 — Fase 8A: rollout por tenant (infraestrutura only)
-- Default operacional: ausência de linha = LEGACY (fail-safe)

create table if not exists public.fiscal_engine_v3_rollouts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  mode varchar(32) not null default 'LEGACY',
  canary_percentage smallint not null default 0,
  enabled boolean not null default false,
  engine_version varchar(16) not null default '3.1.0',
  minimum_shadow_samples integer not null default 0,
  readiness_required boolean not null default true,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_engine_v3_rollouts_empresa_unique unique (empresa_id),
  constraint fiscal_engine_v3_rollouts_mode_check check (
    mode in ('LEGACY', 'SHADOW', 'CANARY', 'AUTHORITATIVE', 'PAUSED')
  ),
  constraint fiscal_engine_v3_rollouts_canary_pct_check check (
    canary_percentage >= 0 and canary_percentage <= 100
  ),
  constraint fiscal_engine_v3_rollouts_min_samples_check check (
    minimum_shadow_samples >= 0
  )
);

create index if not exists idx_fiscal_engine_v3_rollouts_empresa
  on public.fiscal_engine_v3_rollouts (empresa_id);

comment on table public.fiscal_engine_v3_rollouts is
  'Política de rollout v3 por empresa — ausência de linha = LEGACY. Nunca authoritative por default.';

comment on column public.fiscal_engine_v3_rollouts.mode is
  'LEGACY | SHADOW | CANARY | AUTHORITATIVE | PAUSED — SHADOW não implica emissão authoritative.';
