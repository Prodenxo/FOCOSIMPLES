import { env } from '../../config/env.js';
import { badRequest } from '../../utils/errors.js';
import {
  obterTokenProcurador,
  armazenarTokenNoCache,
  autenticarViaCertificado,
  getSerproTokens
} from './authProcurador.service.js';

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const getDocTypeNumber = (numero) => {
  const digits = normalizeDoc(numero);
  if (digits.length === 11) return 1;
  if (digits.length === 14) return 2;
  return null;
};

const isAuthTokenError = (status, message) => {
  if (status === 401 || status === 403) return true;
  const normalized = String(message || '').toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('authorization')) {
    return normalized.includes('inválid')
      || normalized.includes('invalido')
      || normalized.includes('não')
      || normalized.includes('nao');
  }
  if (normalized.includes('token')) {
    return normalized.includes('inválid')
      || normalized.includes('invalido')
      || normalized.includes('expir');
  }
  return false;
};

const parseDados = (payload) => {
  if (!payload?.dados) return null;
  if (typeof payload.dados === 'object') return payload.dados;
  try {
    return JSON.parse(String(payload.dados));
  } catch {
    return payload.dados;
  }
};

const SERVICOS_SEM_DADOS = new Set([
  'PEDIDOSPARC163',
  'PEDIDOSPARC173',
  'PEDIDOSPARC183',
  'PEDIDOSPARC193',
  'PEDIDOSPARC203',
  'PEDIDOSPARC213',
  'PEDIDOSPARC223',
  'PEDIDOSPARC233',
  'PARCELASPARAGERAR162',
  'PARCELASPARAGERAR172',
  'PARCELASPARAGERAR202',
  'PARCELASPARAGERAR212'
]);

/** Extrai mensagem de erro do corpo da resposta da SERPRO (mensagens, message, error). */
const extractSerproErrorMessage = (rawBody, statusText) => {
  if (rawBody == null) return statusText || 'Falha ao consultar serviço';
  if (typeof rawBody === 'string') return rawBody.trim() || statusText || 'Falha ao consultar serviço';
  let mensagemSerpro = '';
  const m = rawBody.mensagens;
  if (Array.isArray(m) && m.length > 0) {
    mensagemSerpro = m
      .map((item) => (typeof item === 'string' ? item : (item?.texto ?? item?.mensagem ?? item?.descricao ?? '')))
      .filter(Boolean)
      .join(' ')
      .trim();
  } else if (typeof m === 'string') {
    mensagemSerpro = (m || '').trim();
  }
  return rawBody.message || rawBody.error || mensagemSerpro || statusText || 'Falha ao consultar serviço';
};

const MENSAGEM_GENERICA_400 = 'Não foi possível consultar o serviço. Verifique o CNPJ e tente novamente.';

/** Termo Integra Contador: procuração Receita (contrib ≠ autor) ou autor ≠ contratante (ICGERENCIADOR-019). */
const precisaAutenticarProcuradorToken = (contratanteLimpo, autorLimpo, contribuinteLimpo) =>
  Boolean(contratanteLimpo && autorLimpo && autorLimpo !== contratanteLimpo) ||
  contribuinteLimpo !== autorLimpo;

const buildSerproHeaders = async ({
  forceRefresh = false,
  contratanteLimpo,
  autorLimpo,
  contribuinteLimpo,
  userId = null,
  contribuinteTipo = null,
  autorTipo = null
}) => {
  const { accessToken, jwtToken } = await getSerproTokens({ forceRefresh });
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(jwtToken ? { jwt_token: jwtToken } : {}),
    'Content-Type': 'application/json'
  };

  if (!precisaAutenticarProcuradorToken(contratanteLimpo, autorLimpo, contribuinteLimpo)) {
    return headers;
  }

  const cacheKey = `procurador_token_${autorLimpo}`;
  let procuradorToken = obterTokenProcurador(autorLimpo);
  if (!procuradorToken) {
    if (userId) {
      const { obterAutenticaProcuradorTokenSerpro } = await import('../mei-guide.service.js');
      procuradorToken = await obterAutenticaProcuradorTokenSerpro(userId, {
        contribuinteNumero: contribuinteLimpo,
        contribuinteTipo: contribuinteTipo ?? getDocTypeNumber(contribuinteLimpo),
        autorPedidoNumero: autorLimpo,
        autorTipo: autorTipo ?? getDocTypeNumber(autorLimpo)
      });
    } else {
      const nomeAssinante = env.SERPRO_ASSINADO_POR_NOME || '';
      procuradorToken = await autenticarViaCertificado(
        contribuinteLimpo,
        autorLimpo,
        nomeAssinante,
        contratanteLimpo
      );
    }
    armazenarTokenNoCache(cacheKey, procuradorToken);
  }
  headers.autenticar_procurador_token = procuradorToken;
  if (env.NODE_ENV !== 'production') {
    console.info('[consultar] autenticar_procurador_token aplicado', {
      autor: autorLimpo,
      contratante: contratanteLimpo,
      contribuinte: contribuinteLimpo,
      viaCertificadoUsuario: Boolean(userId)
    });
  }

  return headers;
};

export const consultarServico = async ({
  contratanteNumero,
  autorPedidoNumero,
  contribuinteNumero,
  idSistema,
  idServico,
  dados = {},
  userId = null,
  contribuinteTipo = null,
  autorTipo = null
}) => {
  if (!env.SERPRO_API_BASE_URL) {
    throw badRequest('API Serpro não configurada');
  }
  if (!idSistema || !idServico) {
    throw badRequest('Serviço Serpro não informado');
  }

  const contratanteLimpo = normalizeDoc(contratanteNumero);
  const autorLimpo = normalizeDoc(autorPedidoNumero);
  const contribuinteLimpo = normalizeDoc(contribuinteNumero);

  if (!contratanteLimpo) {
    throw badRequest('Contratante inválido');
  }
  if (!autorLimpo) {
    throw badRequest('Autor do pedido inválido');
  }
  if (!contribuinteLimpo) {
    throw badRequest('Contribuinte inválido');
  }

  const dadosRequisicao = SERVICOS_SEM_DADOS.has(idServico)
    ? ''
    : JSON.stringify(dados);

  const requestBody = {
    contratante: { numero: contratanteLimpo, tipo: getDocTypeNumber(contratanteLimpo) || 2 },
    autorPedidoDados: { numero: autorLimpo, tipo: getDocTypeNumber(autorLimpo) || 2 },
    contribuinte: {
      numero: contribuinteLimpo,
      tipo: getDocTypeNumber(contribuinteLimpo) || 2
    },
    pedidoDados: {
      idSistema,
      idServico,
      versaoSistema: '1.0',
      dados: dadosRequisicao
    }
  };

  const baseUrl = String(env.SERPRO_API_BASE_URL).replace(/\/$/, '');
  const requestConsultar = async (forceRefresh = false) => {
    const headers = await buildSerproHeaders({
      forceRefresh,
      contratanteLimpo,
      autorLimpo,
      contribuinteLimpo,
      userId,
      contribuinteTipo,
      autorTipo
    });
    const response = await fetch(`${baseUrl}/Consultar`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
    if (response.ok) {
      return { response, message: null, rawBody: null };
    }
    const contentType = response.headers.get('content-type') || '';
    const rawBody = contentType.includes('application/json')
      ? await response.json()
      : await response.text();
    const message = extractSerproErrorMessage(rawBody, response.statusText);
    return { response, message, rawBody };
  };

  let result = await requestConsultar(false);
  if (!result.response.ok && isAuthTokenError(result.response.status, result.message)) {
    result = await requestConsultar(true);
  }

  if (!result.response.ok) {
    if (env.NODE_ENV !== 'production') {
      const rawBody = result.rawBody;
      const responseId = typeof rawBody === 'object' ? rawBody?.responseId : null;
      const mensagens = typeof rawBody === 'object' ? rawBody?.mensagens : null;
      console.warn('[consultar] erro Serpro', {
        status: result.response.status,
        url: `${baseUrl}/Consultar`,
        request: {
          contratante: contratanteLimpo,
          autor: autorLimpo,
          contribuinte: contribuinteLimpo,
          idSistema,
          idServico
        },
        headers: Object.fromEntries(result.response.headers.entries()),
        responseId,
        mensagens,
        bodyRaw: rawBody,
        bodyJson: typeof rawBody === 'object' ? JSON.stringify(rawBody) : null
      });
    }
    let finalMessage = result.message || 'Falha ao consultar serviço';
    const isGeneric =
      /^Bad Request$/i.test(finalMessage) ||
      (result.response.status === 400 && finalMessage === (result.response.statusText || ''));
    if (isGeneric) {
      finalMessage = MENSAGEM_GENERICA_400;
    }
    throw badRequest(finalMessage);
  }

  const payload = await result.response.json();
  return {
    status: result.response.status,
    headers: Object.fromEntries(result.response.headers.entries()),
    dados: parseDados(payload),
    raw: payload
  };
};
