-- Permite ao usuário remover a própria integração Google Calendar (disconnect)
DROP POLICY IF EXISTS "Users can delete own tokens" ON google_tokens_id;

CREATE POLICY "Users can delete own tokens" ON google_tokens_id
  FOR DELETE
  USING (auth.uid() = user_id);
