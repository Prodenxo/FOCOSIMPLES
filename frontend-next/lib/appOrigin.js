export function resolveAppOrigin() {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_PRODUCT || '').trim().toLowerCase();
  if (fromEnv === 'focosimples' || fromEnv === 'focomei' || fromEnv === 'financeiro') {
    return fromEnv;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('focosimples')) return 'focosimples';
    if (host.includes('focomei')) return 'focomei';
    if (host.includes('meiinfinito') || host.includes('meufinanceiro')) return 'financeiro';
  }
  return 'focosimples';
}
