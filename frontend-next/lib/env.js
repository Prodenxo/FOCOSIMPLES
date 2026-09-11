const DEFAULT_LOCAL_API = 'http://localhost:3333';

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const fromWindow = window.__FOCO_SIMPLES_ENV__?.NEXT_PUBLIC_API_URL;
    if (fromWindow?.trim()) return fromWindow.trim().replace(/\/$/, '');
  }

  const production = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  const dev = (process.env.NEXT_PUBLIC_API_URL_DEV || '').trim().replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location?.hostname || '';
    if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
      return dev || DEFAULT_LOCAL_API;
    }
  }

  return production || dev || DEFAULT_LOCAL_API;
}

export function hasApiConfigured() {
  const url = getApiBaseUrl();
  return Boolean(url);
}
