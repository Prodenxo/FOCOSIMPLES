-- Agenda checklist Fase 2 — conclusões manuais (WhatsApp)
-- Executar no Supabase → SQL Editor se o redeploy não criar a tabela automaticamente.

create table if not exists public.calendar_checklist_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_date date not null,
  event_id text null,
  event_key text not null,
  title text not null default '',
  completed_at timestamptz not null default now(),
  constraint calendar_checklist_completions_user_key unique (user_id, event_date, event_key)
);

create index if not exists idx_calendar_checklist_completions_user_date
  on public.calendar_checklist_completions (user_id, event_date);
