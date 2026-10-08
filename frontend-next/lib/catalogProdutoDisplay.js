/** Descrição do serviço (CNAE / nome). Não usa o texto do corpo da nota. */
export function catalogProdutoServicoDescricao(item) {
  if (!item || typeof item !== 'object') return '';
  const meta = item.metadata_json && typeof item.metadata_json === 'object'
    ? item.metadata_json
    : {};
  return [
    meta.nome,
    meta.cnaeDescricao,
    item.nome,
    item.titulo,
  ].map((v) => String(v ?? '').trim()).find(Boolean) || '';
}

export function catalogProdutoTitle(item) {
  if (!item || typeof item !== 'object') return '—';
  const servico = catalogProdutoServicoDescricao(item);
  if (servico) return servico;
  const text = [
    item.discriminacao,
    item.descricao,
  ].map((v) => String(v ?? '').trim()).find(Boolean);
  if (text) return text;
  const cnae = String(item.cnae ?? '').replace(/\D/g, '');
  if (cnae) return `Serviço — CNAE ${cnae}`;
  return '—';
}

/** @param {Record<string, unknown>|null|undefined} item */
export function catalogProdutoSubtitle(item) {
  if (!item || typeof item !== 'object') return '—';
  const codigo = String(item.codigo ?? item.codigoServico ?? '').trim();
  if (codigo) return `Cód. serviço ${codigo}`;
  const cnae = String(item.cnae ?? '').replace(/\D/g, '');
  if (cnae) return `CNAE ${cnae}`;
  const ncm = String(item.ncm ?? '').replace(/\D/g, '');
  if (ncm) return `NCM ${ncm}`;
  const meta = item.metadata_json && typeof item.metadata_json === 'object'
    ? item.metadata_json
    : {};
  if (meta.needsServicoCodigo) return 'Completar código LC 116';
  return '—';
}

/** @param {unknown} value */
export function catalogProdutoValorSugerido(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Valor do catálogo no formato de input BR (`1234,56`).
 * `numeric` do Postgres chega como string — nunca chamar `.toFixed()` no valor cru.
 * @param {unknown} value
 * @returns {string} vazio quando não há valor
 */
export function formatValorSugeridoBR(value) {
  const n = catalogProdutoValorSugerido(value);
  if (n === null || n === 0) return '';
  return n.toFixed(2).replace('.', ',');
}
