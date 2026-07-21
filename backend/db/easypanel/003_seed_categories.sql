-- Seed de categorias globais + cópia para todos os users
-- Rodar no PgWeb (banco postgres do focosimples-db)

BEGIN;

INSERT INTO public.categorias_id (nome, tipo, user_id)
SELECT v.nome, v.tipo, NULL
FROM (
  VALUES
    ('Salário', 'entrada'),
    ('Freelance', 'entrada'),
    ('Investimentos', 'entrada'),
    ('Outros (entrada)', 'entrada'),
    ('Alimentação', 'saida'),
    ('Moradia', 'saida'),
    ('Transporte', 'saida'),
    ('Saúde', 'saida'),
    ('Educação', 'saida'),
    ('Lazer', 'saida'),
    ('Assinaturas', 'saida'),
    ('Compras', 'saida'),
    ('Contas', 'saida'),
    ('Outros (saída)', 'saida')
) AS v(nome, tipo)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categorias_id c
  WHERE c.user_id IS NULL
    AND lower(c.nome) = lower(v.nome)
    AND lower(replace(c.tipo, 'í', 'i')) = lower(replace(v.tipo, 'í', 'i'))
);

-- Copia globais para cada usuário que ainda não tem
INSERT INTO public.categorias_id (user_id, nome, tipo)
SELECT u.id, g.nome, g.tipo
FROM public.users u
CROSS JOIN public.categorias_id g
WHERE g.user_id IS NULL
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.categorias_id c
    WHERE c.user_id = u.id
      AND lower(c.nome) = lower(g.nome)
      AND lower(replace(c.tipo, 'í', 'i')) = lower(replace(g.tipo, 'í', 'i'))
  );

COMMIT;

-- Conferência:
-- SELECT user_id, count(*) FROM public.categorias_id GROUP BY 1;
