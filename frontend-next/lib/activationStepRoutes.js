const ROUTE_TO_HREF = {
  'settings:profile': '/minha-conta',
  'settings:phone': '/minha-conta',
  'mei:certificate': '/notas/certificado',
  'mei:das': '/notas/das',
  'mei:nfse': '/notas/notas-fiscais',
};

export function activationRouteToHref(route) {
  return ROUTE_TO_HREF[route] ?? null;
}
