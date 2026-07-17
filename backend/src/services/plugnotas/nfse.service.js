import { env } from '../../config/env.js';
import { HttpError, badRequest } from '../../utils/errors.js';
import { resolvePlugnotasRequestJsonError } from './plugnotas-emit-400-log.js';
import { getPlugnotasRootUrl } from './root-url.js';

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
      const message = await resolvePlugnotasRequestJsonError(response, { kind: 'NFSe', body });
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
      const message = await resolvePlugnotasRequestJsonError(response, { kind: 'NFSe', body: undefined });
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

export const emitirNfse = async (payload) => {
  return await requestJson('POST', '/nfse', [payload]);
};

export const consultarNfse = async (id) => {
  if (!id) throw badRequest('ID da NFSe é obrigatório');
  return await requestJson('GET', `/nfse/${encodeURIComponent(id)}`);
};

export const consultarNfsePorIntegracao = async (idIntegracao, cnpj) => {
  if (!idIntegracao || !cnpj) {
    throw badRequest('ID integração e CNPJ são obrigatórios');
  }
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  return await requestJson(
    'GET',
    `/nfse/consultar/${encodeURIComponent(idIntegracao)}/${encodeURIComponent(cleanCnpj)}`
  );
};

export const consultarNfsePorIdOuProtocolo = async (idOrProtocol) => {
  if (!idOrProtocol) throw badRequest('ID ou protocolo é obrigatório');
  return await requestJson('GET', `/nfse/consultar/${encodeURIComponent(idOrProtocol)}`);
};

/**
 * Lista NFS-e do prestador (paginada). Sem datas retorna todo o histórico (25/página).
 * @param {{ cpfCnpj: string, dataInicial?: string, dataFinal?: string, hashProximaPagina?: string }} params
 */
export const consultarNfsePorPeriodo = async ({
  cpfCnpj,
  dataInicial,
  dataFinal,
  hashProximaPagina
} = {}) => {
  const cleanCnpj = String(cpfCnpj || '').replace(/\D/g, '');
  if (cleanCnpj.length !== 14) {
    throw badRequest('CNPJ do prestador deve ter 14 dígitos');
  }
  const params = new URLSearchParams({ cpfCnpj: cleanCnpj });
  if (dataInicial) params.set('dataInicial', String(dataInicial));
  if (dataFinal) params.set('dataFinal', String(dataFinal));
  if (hashProximaPagina) params.set('hashProximaPagina', String(hashProximaPagina));
  return await requestJson('GET', `/nfse/consultar/periodo?${params.toString()}`);
};

/** Path Plugnotas: POST /nfse/cancelar/{idNota} — ver Central de Atendimento Tecnospeed. */
export const resolveNfseCancelPath = (id) => {
  const template = String(env.PLUGNOTAS_NFSE_CANCEL_PATH || '/nfse/cancelar/:id').trim();
  const safeId = encodeURIComponent(id);
  if (!template.includes(':id')) {
    return `${template.replace(/\/$/, '')}/${safeId}`;
  }
  return template.replace(':id', safeId);
};

/** Corpo esperado pela API Plugnotas (codigo + motivo; default código 9 = Outros). */
export const buildNfseCancelPayload = ({ reason, codigo } = {}) => ({
  codigo: String(codigo || '9').trim() || '9',
  motivo: String(
    reason || 'Cancelamento a pedido do Prestador via Meu Financeiro',
  ).trim(),
});

export const cancelarNfse = async (id, { reason, codigo } = {}) => {
  if (!id) throw badRequest('ID da NFSe é obrigatório');
  return await requestJson(
    'POST',
    resolveNfseCancelPath(id),
    buildNfseCancelPayload({ reason, codigo }),
  );
};

export const downloadNfsePdf = async (id) => {
  if (!id) throw badRequest('ID da NFSe é obrigatório');
  return await requestDownload(
    `/nfse/pdf/${encodeURIComponent(id)}`,
    'application/pdf',
    'PDF da NFSe não encontrado'
  );
};

export const downloadNfsePdfPorIntegracao = async (idIntegracao, cnpj) => {
  if (!idIntegracao || !cnpj) {
    throw badRequest('ID integração e CNPJ são obrigatórios');
  }
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  return await requestDownload(
    `/nfse/pdf/${encodeURIComponent(idIntegracao)}/${encodeURIComponent(cleanCnpj)}`,
    'application/pdf',
    'PDF da NFSe não encontrado'
  );
};

export const downloadNfseXml = async (id) => {
  if (!id) throw badRequest('ID da NFSe é obrigatório');
  return await requestDownload(
    `/nfse/xml/${encodeURIComponent(id)}`,
    'application/xml',
    'XML da NFSe não encontrado'
  );
};

export const downloadNfseXmlPorIntegracao = async (idIntegracao, cnpj) => {
  if (!idIntegracao || !cnpj) {
    throw badRequest('ID integração e CNPJ são obrigatórios');
  }
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  return await requestDownload(
    `/nfse/xml/${encodeURIComponent(idIntegracao)}/${encodeURIComponent(cleanCnpj)}`,
    'application/xml',
    'XML da NFSe não encontrado'
  );
};
