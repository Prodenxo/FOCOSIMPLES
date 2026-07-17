import { env } from '../../config/env.js';
import { HttpError, badRequest } from '../../utils/errors.js';
import { resolvePlugnotasRequestJsonError } from './plugnotas-emit-400-log.js';
import { getPlugnotasRootUrl } from './root-url.js';
import { normalizePlugnotasNfePayload } from './plugnotas-nfe-payload.js';

const ensureConfigured = () => {
  if (!env.PLUGNOTAS_API_BASE_URL) {
    throw badRequest('Serviço de emissão fiscal não configurado');
  }
  if (!env.PLUGNOTAS_API_KEY) {
    throw badRequest('Token do serviço de emissão fiscal não configurado');
  }
};

const withTimeout = (ms) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
};

const buildHeaders = (accept = 'application/json') => ({
  Accept: accept,
  'Content-Type': 'application/json',
  'x-api-key': env.PLUGNOTAS_API_KEY
});

const plugnotasRequestErrors = (method, path) => ({
  plugnotasRequest: { method, path }
});

const requestJson = async (method, path, body) => {
  ensureConfigured();
  const timeoutMs = Number(env.PLUGNOTAS_TIMEOUT_MS || 15000);
  const { controller, timeout } = withTimeout(timeoutMs);
  const baseUrl = getPlugnotasRootUrl();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: buildHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await resolvePlugnotasRequestJsonError(response, { kind: 'NFCe', body });
      if (response.status === 401) {
        throw new HttpError(
          401,
          message || 'Token do serviço de emissão fiscal inválido',
          plugnotasRequestErrors(method, path)
        );
      }
      if (response.status === 403) {
        throw new HttpError(
          403,
          message || 'Acesso negado pelo serviço de emissão fiscal',
          plugnotasRequestErrors(method, path)
        );
      }
      if (response.status === 404) {
        throw new HttpError(404, message || 'Registro NFC-e não encontrado', plugnotasRequestErrors(method, path));
      }
      throw badRequest(message || 'Erro no serviço de emissão fiscal', plugnotasRequestErrors(method, path));
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const requestDownload = async (path, accept, notFoundMessage) => {
  ensureConfigured();
  const timeoutMs = Number(env.PLUGNOTAS_TIMEOUT_MS || 15000);
  const { controller, timeout } = withTimeout(timeoutMs);
  const baseUrl = getPlugnotasRootUrl();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: buildHeaders(accept),
      signal: controller.signal
    });

    if (!response.ok) {
      const message = await resolvePlugnotasRequestJsonError(response, { kind: 'NFCe', body: undefined });
      if (response.status === 401) {
        throw new HttpError(
          401,
          message || 'Token do serviço de emissão fiscal inválido',
          plugnotasRequestErrors('GET', path)
        );
      }
      if (response.status === 403) {
        throw new HttpError(
          403,
          message || 'Acesso negado pelo serviço de emissão fiscal',
          plugnotasRequestErrors('GET', path)
        );
      }
      if (response.status === 404) {
        throw new HttpError(404, message || notFoundMessage, plugnotasRequestErrors('GET', path));
      }
      throw badRequest(
        message || 'Erro ao baixar arquivo do serviço de emissão fiscal',
        plugnotasRequestErrors('GET', path)
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      throw badRequest(
        payload?.message || payload?.error?.message || 'Erro ao baixar arquivo do serviço de emissão fiscal',
        plugnotasRequestErrors('GET', path)
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: contentType || accept
    };
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const collectCandidates = (response) => {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [response];
  const list = [response];
  if (Array.isArray(response.documents)) list.push(...response.documents);
  if (Array.isArray(response.documentos)) list.push(...response.documentos);
  return list;
};

const extractId = (response) => {
  const candidates = collectCandidates(response);
  for (const candidate of candidates) {
    if (candidate?.id) return candidate.id;
  }
  return null;
};

const resolveCancelPath = (id) => {
  const template = String(env.PLUGNOTAS_NFCE_CANCEL_PATH || '/nfce/:id/cancelamento').trim();
  const safeId = encodeURIComponent(id);
  if (!template.includes(':id')) {
    return `${template.replace(/\/$/, '')}/${safeId}`;
  }
  return template.replace(':id', safeId);
};

export const emitirNfce = async (payload) => {
  return await requestJson('POST', '/nfce', [normalizePlugnotasNfePayload(payload)]);
};

export const consultarNfce = async (idOrChaveOrProtocol) => {
  if (!idOrChaveOrProtocol) throw badRequest('ID da NFC-e é obrigatório');
  return await requestJson('GET', `/nfce/${encodeURIComponent(idOrChaveOrProtocol)}/resumo`);
};

export const consultarNfcePorIntegracao = async (idIntegracao, cnpj) => {
  if (!idIntegracao || !cnpj) {
    throw badRequest('ID integração e CNPJ são obrigatórios');
  }
  const cleanCnpj = normalizeDoc(cnpj);
  return await requestJson(
    'GET',
    `/nfce/${encodeURIComponent(cleanCnpj)}/${encodeURIComponent(idIntegracao)}/resumo`
  );
};

export const consultarNfcePorIdOuProtocolo = async (idOrProtocol) => {
  if (!idOrProtocol) throw badRequest('ID ou protocolo é obrigatório');
  return await requestJson('GET', `/nfce/${encodeURIComponent(idOrProtocol)}/resumo`);
};

export const cancelarNfce = async (id, { reason } = {}) => {
  if (!id) throw badRequest('ID da NFC-e é obrigatório');
  const payload = reason ? { justificativa: reason, reason } : {};
  return await requestJson('POST', resolveCancelPath(id), payload);
};

export const downloadNfcePdf = async (id) => {
  if (!id) throw badRequest('ID da NFC-e é obrigatório');
  return await requestDownload(
    `/nfce/${encodeURIComponent(id)}/pdf`,
    'application/pdf',
    'PDF da NFC-e não encontrado'
  );
};

export const downloadNfcePdfPorIntegracao = async (idIntegracao, cnpj) => {
  const resumo = await consultarNfcePorIntegracao(idIntegracao, cnpj);
  const id = extractId(resumo);
  if (!id) throw notFound('NFC-e não encontrada para gerar PDF');
  return await downloadNfcePdf(id);
};

export const downloadNfceXml = async (id) => {
  if (!id) throw badRequest('ID da NFC-e é obrigatório');
  return await requestDownload(
    `/nfce/${encodeURIComponent(id)}/xml`,
    'application/xml',
    'XML da NFC-e não encontrado'
  );
};

export const downloadNfceXmlPorIntegracao = async (idIntegracao, cnpj) => {
  const resumo = await consultarNfcePorIntegracao(idIntegracao, cnpj);
  const id = extractId(resumo);
  if (!id) throw notFound('NFC-e não encontrada para gerar XML');
  return await downloadNfceXml(id);
};
