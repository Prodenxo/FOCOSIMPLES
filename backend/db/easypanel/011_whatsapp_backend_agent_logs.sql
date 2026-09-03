CREATE TABLE IF NOT EXISTS public.whatsapp_backend_agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user', 'assistant'])),
  content text NOT NULL,
  source text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_backend_agent_logs_phone_created
  ON public.whatsapp_backend_agent_logs (phone, created_at DESC);
