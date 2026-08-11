-- Fiscal Engine v3.1 — audit e override (Fase 1)
-- Não altera emissão legada; tabelas usadas quando FISCAL_ENGINE_V3=true

create table if not exists public.fiscal_decision_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  user_id uuid,
  nfe_emission_id uuid,
  commercial_line_id text,
  nfe_item_index integer,
  engine_schema_version varchar(16) not null default '3.1.0',
  status varchar(32) not null,
  context_json jsonb,
  automatic_result_json jsonb,
  final_result_json jsonb,
  issues_json jsonb not null default '[]'::jsonb,
  audit_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_fiscal_decision_logs_empresa
  on public.fiscal_decision_logs (empresa_id, created_at desc);

comment on table public.fiscal_decision_logs is
  'Audit trail de decisões do Fiscal Engine v3.1 (automático e override).';

create table if not exists public.fiscal_emission_overrides (
  id uuid primary key default gen_random_uuid(),
  fiscal_decision_log_id uuid references public.fiscal_decision_logs(id) on delete set null,
  empresa_id uuid,
  user_id uuid not null,
  permission varchar(64) not null default 'FISCAL_REVIEW_OVERRIDE',
  original_decision_json jsonb not null,
  final_decision_json jsonb not null,
  justification text not null,
  rules_involved_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_fiscal_emission_overrides_empresa
  on public.fiscal_emission_overrides (empresa_id, created_at desc);

comment on table public.fiscal_emission_overrides is
  'Override manual de NEEDS_REVIEW — proibido para RULE_CONFLICT e erros bloqueantes.';
