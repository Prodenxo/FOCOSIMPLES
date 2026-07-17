-- Permitir que service role insira/atualize tokens
-- Isso é necessário para o callback OAuth funcionar sem autenticação do usuário
-- A service role bypassa RLS, então não precisamos de política adicional
-- Mas vamos garantir que as políticas existentes não bloqueiem a service role

-- Nota: A service role (usada na Edge Function) bypassa RLS automaticamente
-- Esta migration é apenas para documentação - não é estritamente necessária
-- mas ajuda a entender o fluxo de segurança

