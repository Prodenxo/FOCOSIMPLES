import https from 'node:https';
import { URL } from 'node:url';

const normalizeRequestHeaders = (headers) => {
  const normalized = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    normalized[key] = value;
  });
  return normalized;
};

const normalizeResponseHeaders = (headers) => {
  const map = new Map();
  Object.entries(headers || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = Array.isArray(value) ? value.join(', ') : String(value);
    map.set(String(key).toLowerCase(), normalized);
  });
  return map;
};

const resolveBody = (body) => {
  if (body === undefined || body === null) return null;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof Uint8Array) return Buffer.from(body);
  return JSON.stringify(body);
};

const toArrayBuffer = (buffer) => {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
};

export const requestWithMtls = (url, options = {}) => {
  const {
    method = 'GET',
    headers = {},
    body,
    pfx,
    passphrase,
    signal
  } = options;

  const parsed = new URL(url);
  const resolvedBody = resolveBody(body);
  const requestHeaders = normalizeRequestHeaders(headers);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error('Request aborted');
      error.name = 'AbortError';
      reject(error);
      return;
    }

    const request = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: requestHeaders,
        pfx,
        passphrase,
        signal
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const headerMap = normalizeResponseHeaders(response.headers);
          const status = response.statusCode || 0;
          const statusText = response.statusMessage || '';

          resolve({
            ok: status >= 200 && status < 300,
            status,
            statusText,
            headers: {
              get: (name) => headerMap.get(String(name).toLowerCase()) || null,
              entries: function* entries() {
                yield* headerMap.entries();
              }
            },
            json: async () => JSON.parse(buffer.toString('utf8')),
            text: async () => buffer.toString('utf8'),
            arrayBuffer: async () => toArrayBuffer(buffer)
          });
        });
      }
    );

    request.on('error', reject);

    if (resolvedBody !== null) {
      request.write(resolvedBody);
    }

    request.end();
  });
};
