-- Fiscal Engine v3.1 — Fase 8A: tentativas authoritative (audit trail)
-- Não armazena XML integral — apenas metadados auditáveis

create table if not exists public.fiscal_v3_emission_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id text not null unique,
  empresa_id uuid not null,
  mei_nota_record_id uuid,
  id_integracao text,
  emission_stable_id text not null,
  document_type varchar(16) not null,
  authority_engine varchar(16) not null default 'LEGACY',
  rollout_mode varchar(32),
  canary_selected boolean,
  attempt_status varchar(32) not null,
  preflight_id text,
  allocation_request_ids jsonb not null default '[]'::jsonb,
  candidate_payload_hash text,
  authority_decision_json jsonb not null default '{}'::jsonb,
  preflight_result_json jsonb not null default '{}'::jsonb,
  issues_json jsonb not null default '[]'::jsonb,
  engine_version varchar(16) not null default '3.1.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_v3_emission_attempts_engine_check check (
    authority_engine in ('LEGACY', 'V3')
  ),
  constraint fiscal_v3_emission_attempts_status_check check (
    attempt_status in (
      'ROUTING_LEGACY',
      'PREFLIGHT_FAILED',
      'AUTHORITATIVE_NOT_ELIGIBLE',
      'PREPARED',
      'RESERVED',
      'AUTHORITY_ASSUMED_V3',
      'EMITTED',
      'REJECTED',
      'REQUEST_OUTCOME_UNKNOWN',
      'RELEASED',
      'CONSUMED'
    )
  )
);

create index if not exists idx_fiscal_v3_emission_attempts_empresa
  on public.fiscal_v3_emission_attempts (empresa_id, created_at desc);

create index if not exists idx_fiscal_v3_emission_attempts_mei_nota
  on public.fiscal_v3_emission_attempts (mei_nota_record_id)
  where mei_nota_record_id is not null;

create index if not exists idx_fiscal_v3_emission_attempts_stable
  on public.fiscal_v3_emission_attempts (empresa_id, emission_stable_id);

comment on table public.fiscal_v3_emission_attempts is
  'Audit trail de roteamento/preflight/reserva authoritative v3 — fail-open para legado.';
