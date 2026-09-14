/**
 * Traduz erros comuns do cadastro empresa PlugNotas para linguagem leiga.
 */
export function humanizePlugNotasEmpresaError(raw) {
  const text = String(raw || '').trim();
  if (!text) return text;

  const lower = text.toLowerCase();
  if (lower.includes('homologad')) {
    return (
      'A PlugNotas recusou o cadastro porque este município (IBGE) ainda não está homologado no sistema municipal deles. '
      + 'Para cidades no Padrão Nacional (como Aperibé/RJ), a solução é emitir pela NFS-e Nacional — o Foco Simples já envia '
      + 'a opção “NFS-e Nacional” ligada ao salvar. Confira CEP, logradouro, bairro e código IBGE (7 dígitos, ex.: 3300159) '
      + 'iguais à nota autorizada, preencha e-mail fiscal e inscrição municipal, escolha o CRT (Simples Nacional) e salve de novo. '
      + 'Se o erro continuar, encaminhe este detalhe ao suporte Foco Simples (pode ser ajuste na conta PlugNotas/Tecnospeed).'
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
