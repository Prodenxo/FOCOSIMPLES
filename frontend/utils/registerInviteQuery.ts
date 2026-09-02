/**
 * US-INV-05: lê o token bruto do query `convite` (sem validar).
 * Não logar o valor completo em produção.
 *
 * Aceita tanto search string com prefixo "?" quanto sem.
 */
export function getConviteTokenFromSearch(search: string): string {
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  return params.get('convite')?.trim() ?? '';
}

export function inviteStatusUserMessage(status: string): string {
  switch (status) {
    case 'valid':
      return 'Convite válido. Complete o cadastro para entrar na empresa.';
    case 'expired':
      return 'Este convite expirou. Peça um novo link ao administrador.';
    case 'revoked':
      return 'Este convite foi cancelado.';
    case 'used':
      return 'Este convite já foi utilizado.';
    case 'invalid':
      return 'Link de convite inválido.';
    case 'network_error':
      return 'Não foi possível verificar o convite. Tente novamente.';
    default:
      return 'Não foi possível verificar o convite.';
  }
}
