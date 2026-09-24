-- Troca de e-mail de login: o novo endereço só passa a valer após clicar no link.
-- Guarda apenas o hash do token; o token em claro vive só no e-mail enviado.

CREATE TABLE IF NOT EXISTS public.email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  new_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_change_requests_user_id_idx
  ON public.email_change_requests (user_id);
