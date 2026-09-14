/**
 * Rótulos de listagem do catálogo fiscal (API usa `discriminacao`, não `nome`).
 * @param {Record<string, unknown>|null|undefined} item
 */
export function catalogProdutoTitle(item) {
  if (!item || typeof item !== 'object') return '—';
  const meta = item.metadata_json && typeof item.metadata_json === 'object'
    ? item.metadata_json
    : {};
  const text = [
    item.discriminacao,
    item.descricao,
    item.nome,
    item.titulo,
    meta.cnaeDescricao,
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
