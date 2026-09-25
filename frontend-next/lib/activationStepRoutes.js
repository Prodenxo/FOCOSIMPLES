const ROUTE_TO_HREF = {
  'settings:profile': '/minha-conta',
  'settings:phone': '/minha-conta',
  'mei:certificate': '/notas/certificado',
  // 'mei:das' fica sem rota de propósito: o DAS do Simples ainda não foi liberado
  // para clientes, e o painel de ativação só mostra passos com rota.
  'mei:nfse': '/notas/notas-fiscais',
};

export function activationRouteToHref(route) {
  return ROUTE_TO_HREF[route] ?? null;
}
