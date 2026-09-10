export const CONTA_TIPO_LABELS = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  cartao_credito: 'Cartão de crédito',
  dinheiro: 'Dinheiro',
  outro: 'Outro',
};

export const CONTA_TIPO_OPTIONS = Object.entries(CONTA_TIPO_LABELS).map(([key, label]) => ({
  key,
  label,
}));

export const CONTA_COR_PRESETS = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F43F5E',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#14B8A6',
  '#0EA5E9',
  '#64748B',
];

const VALID_TIPOS = new Set(Object.keys(CONTA_TIPO_LABELS));

export function normalizeContaRow(row) {
  const rawTipo = String(row?.tipo ?? 'corrente');
  const tipo = VALID_TIPOS.has(rawTipo) ? rawTipo : 'corrente';

  return {
    id: String(row?.id ?? ''),
    user_id: String(row?.user_id ?? ''),
    nome: String(row?.nome ?? '').trim(),
    tipo,
    saldo_inicial:
      typeof row?.saldo_inicial === 'number'
        ? row.saldo_inicial
        : parseFloat(String(row?.saldo_inicial ?? 0)) || 0,
    limite_credito:
      row?.limite_credito == null
        ? null
        : typeof row.limite_credito === 'number'
          ? row.limite_credito
          : parseFloat(String(row.limite_credito)) || null,
    dia_fechamento: row?.dia_fechamento == null ? null : Number(row.dia_fechamento),
    dia_vencimento: row?.dia_vencimento == null ? null : Number(row.dia_vencimento),
    cor: row?.cor ? String(row.cor) : null,
    instituicao_id: row?.instituicao_id ? String(row.instituicao_id) : null,
    ativo: row?.ativo !== false,
    of_provider: row?.of_provider ? String(row.of_provider) : null,
    of_external_id: row?.of_external_id ? String(row.of_external_id) : null,
    of_last_synced_at: row?.of_last_synced_at ? String(row.of_last_synced_at) : null,
    criado_em: String(row?.criado_em ?? ''),
    atualizado_em: String(row?.atualizado_em ?? ''),
  };
}
