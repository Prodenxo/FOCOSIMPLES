-- Fiscal Engine v3.1 — Fase 8F.2: authority_engine aceita BLOCKED (fail-closed)

alter table public.fiscal_v3_emission_attempts
  drop constraint if exists fiscal_v3_emission_attempts_engine_check;

alter table public.fiscal_v3_emission_attempts
  add constraint fiscal_v3_emission_attempts_engine_check
  check (authority_engine in ('LEGACY', 'V3', 'BLOCKED'));

comment on column public.fiscal_v3_emission_attempts.authority_engine is
  'Decisão de roteamento authoritative persistida (LEGACY | V3 | BLOCKED). BLOCKED = outcome fail-closed, não engine computacional.';
