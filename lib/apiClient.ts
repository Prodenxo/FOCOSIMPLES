import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { supabase } from './supabase';
import { mimeFromFilename, persistBinaryDownload } from './platformDownload';
import { getMeiApiBaseUrl } from './runtimeEnv';

function resolveApiUrl(): string {
  return (getMeiApiBaseUrl() || Constants.expoConfig?.extra?.meiApiUrl || '').replace(/\/$/, '');
}

function logLocalhostBackendHint(apiUrl: string): void {
  if (typeof window === 'undefined' || !window.location?.hostname) return;
  if (!/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) return;
  console.log('[api] MEI backend:', apiUrl || '(não configurada)');
  if (apiUrl.includes('easypanel.host')) {
    console.error(
      '[api] ERRO: localhost apontou para Easypanel. Reinicie o Expo (npm start -c). ' +
        'Em dev local a API deve ser http://localhost:3333',
    );
  }
}

const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);

const resolveApiErrorMessage = (
  payload: { message?: string },
  statusText: string,
  fallback = 'Falha na requisição.',
): string => {
  const message = String(payload?.message ?? '').trim();
  if (message) return message;
  return statusText?.trim() || fallback;
};

const readApiErrorCode = (errors: unknown): string | undefined => {
  if (errors && typeof errors === 'object' && 'code' in errors) {
    const code = (errors as { code?: string }).code;
    return code ? String(code) : undefined;
  }
  return undefined;
};

const getBaseUrl = () => {
  const apiUrl = resolveApiUrl();
  logLocalhostBackendHint(apiUrl);
  if (!apiUrl) {
    throw new Error(
      'MEI API not configured. Set EXPO_PUBLIC_MEI_API_URL (e em dev opcional EXPO_PUBLIC_MEI_API_URL_DEV).'
    );
  }
  return `${apiUrl}/api`;
};

const getAccessToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
};

const buildAuthHeaders = async (extra?: Record<string, string>) => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('User not authenticated.');
  }
  return {
    Authorization: `Bearer ${token}`,
    ...(extra || {})
  };
};

const requestJson = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const url = `${getBaseUrl()}${normalizePath(path)}`;
  const headers = await buildAuthHeaders(
    options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : undefined
  );

  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  if (response.status === 304) {
    throw new Error(
      'Resposta em cache desatualizada (304). Recarregue a página ou clique em Atualizar novamente.',
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      const err = new Error(
        resolveApiErrorMessage(payload, response.statusText),
      ) as Error & { code?: string };
      err.code = readApiErrorCode(payload?.errors);
      throw err;
    }
    return payload?.data as T;
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || response.statusText || 'Falha na requisição.');
  }
  return text as unknown as T;
};

const requestJsonPublic = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const url = `${getBaseUrl()}${normalizePath(path)}`;
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 304) {
    throw new Error(
      'Resposta em cache desatualizada (304). Recarregue a página ou tente novamente.',
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      const err = new Error(
        resolveApiErrorMessage(payload, response.statusText),
      ) as Error & { code?: string };
      err.code = readApiErrorCode(payload?.errors);
      throw err;
    }
    return payload?.data as T;
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || response.statusText || 'Falha na requisição.');
  }
  return text as unknown as T;
};

const requestForm = async <T>(path: string, formData: FormData): Promise<T> => {
  const url = `${getBaseUrl()}${normalizePath(path)}`;
  const headers = await buildAuthHeaders();

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    cache: 'no-store',
    headers: {
      ...headers
      // Do not set Content-Type; browser/formData sets multipart boundary
    }
  });

  if (response.status === 304) {
    throw new Error(
      'Resposta em cache desatualizada (304). Recarregue a página ou tente novamente.',
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      const err = new Error(
        resolveApiErrorMessage(payload, response.statusText),
      ) as Error & { code?: string };
      err.code = readApiErrorCode(payload?.errors);
      throw err;
    }
    return payload?.data as T;
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || response.statusText || 'Falha na requisição.');
  }
  return text as unknown as T;
};

const extractFilenameFromContentDisposition = (contentDisposition?: string | null): string | null => {
  if (!contentDisposition) return null;
  const match =
    /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(contentDisposition);
  const filename = match?.[1] || match?.[2] || match?.[3];
  return filename ? decodeURIComponent(filename.trim()) : null;
};

const buildDownloadError = (message: string, code?: string) => {
  const err = new Error(message) as Error & { code?: string };
  if (code) err.code = code;
  return err;
};

const parseApiErrorPayload = (payload: unknown): { message: string; code?: string } => {
  if (!payload || typeof payload !== 'object') {
    return { message: 'Falha no download' };
  }
  const row = payload as { message?: string; errors?: { code?: string } | string };
  const errors = row.errors;
  const code =
    typeof errors === 'object' && errors && 'code' in errors
      ? String(errors.code || '')
      : undefined;
  return { message: row.message || 'Falha no download', code: code || undefined };
};

const assertPdfBytes = (bytes: Uint8Array) => {
  if (!bytes?.length) {
    throw buildDownloadError('O servidor retornou um arquivo vazio.');
  }
  const isPdf =
    bytes.length >= 4
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46;
  if (isPdf) return;
  const snippet = new TextDecoder().decode(bytes.slice(0, 400));
  try {
    const json = JSON.parse(snippet) as { message?: string; errors?: { code?: string } };
    const parsed = parseApiErrorPayload(json);
    throw buildDownloadError(parsed.message, parsed.code);
  } catch (parseErr) {
    if (parseErr instanceof Error && 'code' in parseErr) throw parseErr;
    throw buildDownloadError('A resposta não é um PDF válido. Tente novamente ou abra o PGMEI.');
  }
};

/** Download a GET endpoint to a local file (e.g. PDF/XML). Returns localUri and filename. */
export async function downloadToFile(
  path: string,
  defaultFilename: string
): Promise<{ localUri: string; filename: string }> {
  const url = `${getBaseUrl()}${normalizePath(path)}`;
  const headers = await getMeiApiAuthHeaders();

  const response = await expoFetch(url, { headers });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null);
      const parsed = parseApiErrorPayload(payload);
      throw buildDownloadError(
        parsed.message || `Falha no download (${response.status})`,
        parsed.code
      );
    }
    throw buildDownloadError(`Falha no download (${response.status}): ${response.statusText}`);
  }

  const contentDisposition = response.headers.get('content-disposition');
  const filename = extractFilenameFromContentDisposition(contentDisposition) || defaultFilename;
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (contentType.includes('application/json')) {
    const parsed = parseApiErrorPayload(JSON.parse(new TextDecoder().decode(bytes)));
    throw buildDownloadError(parsed.message, parsed.code);
  }

  assertPdfBytes(bytes);

  return persistBinaryDownload(bytes, filename, mimeFromFilename(filename));
}

export const apiClient = {
  get: <T>(path: string) => requestJson<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    requestJson<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined
    }),
  postPublic: <T>(path: string, body?: unknown) =>
    requestJsonPublic<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    requestJson<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined
    }),
  patch: <T>(path: string, body?: unknown) =>
    requestJson<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined
    }),
  delete: <T>(path: string) => requestJson<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, formData: FormData) => requestForm<T>(path, formData)
};

export const getMeiApiUrl = (path: string) => `${getBaseUrl()}${normalizePath(path)}`;

export const getMeiApiAuthHeaders = async (extra?: Record<string, string>) =>
  buildAuthHeaders(extra);
