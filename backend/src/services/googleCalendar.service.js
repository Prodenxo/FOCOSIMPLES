import { env } from '../config/env.js';

export const proxyRequest = async ({ path, method, headers, query, body }) => {
  const baseUrl = `${env.SUPABASE_URL}/functions/v1/google-calendar`;
  const url = new URL(`${baseUrl}/${path}`);

  if (query && Object.keys(query).length) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const requestHeaders = {
    'Content-Type': 'application/json',
    apikey: env.SUPABASE_ANON_KEY
  };

  if (headers?.authorization) {
    requestHeaders.Authorization = headers.authorization;
  }

  const response = await fetch(url.toString(), {
    method,
    headers: requestHeaders,
    ...(method === 'GET' || method === 'HEAD' ? {} : { body: JSON.stringify(body || {}) })
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  return {
    status: response.status,
    contentType,
    body: text
  };
};
