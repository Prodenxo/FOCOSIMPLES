-- Preferência canário: qual motor atende o WhatsApp deste usuário.
-- Sem linha = OpenClaw (padrão). Só o superadmin altera pelo site.

CREATE TABLE IF NOT EXISTS public.whatsapp_agent_prefs (
  user_id uuid PRIMARY KEY,
  engine text NOT NULL DEFAULT 'openclaw'
    CHECK (engine = ANY (ARRAY['openclaw', 'backend'])),
  updated_at timestamptz NOT NULL DEFAULT now()
);
