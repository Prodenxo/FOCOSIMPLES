import { getApiBaseUrl } from './env';
import { getLocalAccessToken } from './authSession';

const DEFAULT_FETCH_TIMEOUT_MS = 8000;
/** Emissão fiscal (Plugnotas + validações) pode levar dezenas de segundos. */
export const EMIT_FETCH_TIMEOUT_MS = 120000;

const normalizePath = (path) => (path.startsWith('/') ? path : `/${path}`);

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Tempo esgotado ao conectar ao servidor.');
    }
    const message = error instanceof Error ? error.message : 'Falha na requisição.';
    throw new Error(message.includes('fetch') ? 'Não foi possível conectar ao servidor.' : message);
  } finally {
    clearTimeout(timeoutId);
  }
}

const getBaseUrl = () => {
  const apiUrl = getApiBaseUrl();
  if (!apiUrl) {
    throw new Error(
      'API não configurada. Defina NEXT_PUBLIC_API_URL (ou NEXT_PUBLIC_API_URL_DEV em localhost).',
    );
  }
  return `${apiUrl}/api`;
};

const resolveApiErrorMessage = (payload, statusText, fallback = 'Falha na requisição.') => {
  const message = String(payload?.message ?? '').trim();
  if (message) return message;
  return statusText?.trim() || fallback;
};

async function buildAuthHeaders(extra) {
  const token = getLocalAccessToken();
  if (!token) throw new Error('Usuário não autenticado.');
  return {
    Authorization: `Bearer ${token}`,
    ...(extra || {}),
  };
}

async function requestJson(path, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const url = `${getBaseUrl()}${normalizePath(path)}`;
  const headers = await buildAuthHeaders(
    options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : undefined,
  );

  let response;
  try {
    response = await fetchWithTimeout(url, {
      ...options,
      cache: 'no-store',
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    }, timeoutMs);
  } catch (error) {
    throw error instanceof Error ? error : new Error('Falha na requisição.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw new Error(resolveApiErrorMessage(payload, response.statusText));
    }
    return payload?.data;
  }

  const text = await response.text();
  if (!response.ok) throw new Error(text || response.statusText || 'Falha na requisição.');
  return text;
}

async function downloadBinary(path, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const url = `${getBaseUrl()}${normalizePath(path)}`;
  const headers = await buildAuthHeaders();

  let response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'GET',
      cache: 'no-store',
      headers,
    }, timeoutMs);
  } catch (error) {
    throw error instanceof Error ? error : new Error('Falha no download.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      throw new Error(resolveApiErrorMessage(payload, response.statusText, 'Falha no download.'));
    }
    throw new Error(response.statusText || 'Falha no download.');
  }

  return response.blob();
}

async function requestJsonPublic(path, options = {}) {
  const url = `${getBaseUrl()}${normalizePath(path)}`;
  const response = await fetchWithTimeout(url, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw new Error(resolveApiErrorMessage(payload, response.statusText));
    }
    return payload?.data;
  }

  const text = await response.text();
  if (!response.ok) throw new Error(text || response.statusText || 'Falha na requisição.');
  return text;
}

export const apiClient = {
  get: (path, { timeoutMs } = {}) => requestJson(path, { method: 'GET' }, timeoutMs),
  post: (path, body, { timeoutMs } = {}) =>
    requestJson(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, timeoutMs),
  postPublic: (path, body) =>
    requestJsonPublic(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: (path, body, { timeoutMs } = {}) =>
    requestJson(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, timeoutMs),
  delete: (path, { timeoutMs } = {}) => requestJson(path, { method: 'DELETE' }, timeoutMs),
  download: (path, { timeoutMs } = {}) => downloadBinary(path, timeoutMs),
};
