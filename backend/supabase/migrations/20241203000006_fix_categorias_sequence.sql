-- Corrigir sequência SERIAL da tabela categorias
-- Esta migration garante que a sequência esteja sincronizada com o maior ID existente

-- Obter o maior ID atual da tabela (ou 0 se a tabela estiver vazia)
DO $$
DECLARE
    max_id INTEGER;
BEGIN
    -- Encontrar o maior ID existente
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM categorias;
    
    -- Atualizar a sequência para começar após o maior ID existente
    -- Isso garante que novos IDs sejam únicos
    PERFORM setval('categorias_id_seq', GREATEST(max_id, 1), true);
    
    RAISE NOTICE 'Sequência categorias_id_seq atualizada para começar em %', max_id + 1;
END $$;

