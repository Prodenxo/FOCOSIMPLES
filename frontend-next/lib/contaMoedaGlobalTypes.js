export const POPULAR_MOEDAS = [
  'USD', 'EUR', 'GBP', 'JPY', 'ARS', 'CAD', 'CHF', 'AUD', 'CNY', 'MXN',
];

export function normalizeContaMoedaGlobalRow(row) {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    moeda: String(row.moeda || '').toUpperCase(),
    nome: row.nome != null ? String(row.nome) : null,
    valor: Number(row.valor) || 0,
    ativo: row.ativo !== false,
    criado_em: String(row.criado_em || ''),
    atualizado_em: String(row.atualizado_em || ''),
  };
}
