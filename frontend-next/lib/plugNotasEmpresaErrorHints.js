/**
 * Mensagem curta para erros do cadastro empresa PlugNotas (sem textão repetitivo).
 */
export function shortPlugNotasEmpresaError(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'A PlugNotas recusou o cadastro.';

  const lower = text.toLowerCase();
  if (lower.includes('homologad')) {
    return 'PlugNotas: município (IBGE) ainda não homologado no cadastro municipal deles — com NFS-e Nacional marcado, o cadastro pode exigir ajuste na conta Tecnospeed.';
  }
  if (lower.includes('codigoibgecidade') && lower.includes('tabela')) {
    return 'PlugNotas: código IBGE da cidade não aceito. Confira os 7 dígitos (ex.: 3300159).';
  }
  if (text.length > 220) {
    return `${text.slice(0, 220)}…`;
  }
  return text;
}

/** @deprecated use shortPlugNotasEmpresaError */
export function humanizePlugNotasEmpresaError(raw) {
  return shortPlugNotasEmpresaError(raw);
}
