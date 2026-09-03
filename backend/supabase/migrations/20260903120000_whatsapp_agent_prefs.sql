create table if not exists public.whatsapp_agent_prefs (
  user_id uuid primary key,
  engine text not null default 'openclaw'
    check (engine = any (array['openclaw', 'backend'])),
  updated_at timestamptz not null default now()
);
