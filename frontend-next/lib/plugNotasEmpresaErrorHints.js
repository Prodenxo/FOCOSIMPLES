/**
 * Traduz erros comuns do cadastro empresa PlugNotas para linguagem leiga.
 */
export function humanizePlugNotasEmpresaError(raw) {
  const text = String(raw || '').trim();
  if (!text) return text;

  const lower = text.toLowerCase();
  if (lower.includes('homologad')) {
    return (
      'O emissor parceiro ainda não liberou emissão de NFS-e em produção para este município (código IBGE), '
      + 'mesmo que a nota já tenha saído pelo Emissor Nacional do governo. '
      + 'Confira se CEP, logradouro, bairro e IBGE estão iguais à nota autorizada e salve de novo. '
      + 'Se continuar, avise o suporte Foco Simples para verificar a homologação do município na PlugNotas.'
      + `\n\nDetalhe técnico: ${text}`
    );
  }

  if (lower.includes('codigoibgecidade') && lower.includes('tabela')) {
    return (
      'O código IBGE da cidade não foi aceito pelo emissor. Use os 7 dígitos oficiais (ex.: 3300159 para Aperibé/RJ) '
      + 'e busque o endereço pelo CEP correto da nota.'
      + `\n\nDetalhe técnico: ${text}`
    );
  }

  return text;
}
