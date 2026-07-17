import { badRequest } from '../utils/errors.js';
import { isValidCnpj } from '../utils/cpf-cnpj.js';
import { env } from '../config/env.js';
import { getPlugnotasRootUrl } from './plugnotas/root-url.js';
import { resolveIbgeCodigoFromMunicipio } from './ibge-municipios-lookup.service.js';

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

/** Endpoint público da BrasilAPI para consulta de CNPJ (v1). */
const BRASILAPI_URL = 'https://brasilapi.com.br/api/cnpj/v1';

const BRASILAPI_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'MeuFinanceiro/1.0 (+cnpj-lookup)'
};

const brasilApiStatusMessage = (status) => {
  if (status === 403) {
    return 'Consulta de CNPJ indisponível no servidor (bloqueio temporário). Tente novamente em instantes.';
  }
  if (status === 429) {
    return 'Muitas consultas de CNPJ. Aguarde alguns segundos e tente novamente.';
  }
  return `BrasilAPI retornou status ${status}.`;
};

const padZeros = (value, length) => {
  const str = String(value || '').replace(/\D/g, '');
  return str.padStart(length, '0').slice(-length);
};

const hasText = (value) => String(value || '').trim().length > 0;

/** Normaliza código CNAE para 7 dígitos. */
export const normalizeCnaeCodigo = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(7, '0').slice(-7);
};

/**
 * Extrai CNAEs secundários do payload BrasilAPI / variantes.
 * @returns {{ codigo: string, descricao: string|null }[]}
 */
export const extractCnaesSecundariosFromRaw = (raw) => {
  const list = raw?.cnaes_secundarios
    || raw?.cnaesSecundarios
    || raw?.atividade_principal_secundaria
    || [];
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const codigo = normalizeCnaeCodigo(item.codigo ?? item.code ?? item.cnae);
    if (!codigo || codigo.length !== 7 || seen.has(codigo)) continue;
    seen.add(codigo);
    out.push({
      codigo,
      descricao: item.descricao != null
        ? String(item.descricao)
        : (item.description != null ? String(item.description) : null),
    });
  }
  return out;
};

/**
 * Anexa cnaePrincipal, cnaesSecundarios e lista unificada `cnaes` (principal primeiro).
 */
export const attachNormalizedCnaes = (data) => {
  if (!data || typeof data !== 'object') return data;
  const principalRaw = data.cnaePrincipal;
  const principalCodigo = normalizeCnaeCodigo(principalRaw?.codigo);
  const principal = principalCodigo.length === 7
    ? {
        codigo: principalCodigo,
        descricao: principalRaw?.descricao != null ? String(principalRaw.descricao) : null,
      }
    : (
      data.raw?.cnae_fiscal
        ? {
            codigo: normalizeCnaeCodigo(data.raw.cnae_fiscal),
            descricao: data.raw?.cnae_fiscal_descricao
              ? String(data.raw.cnae_fiscal_descricao)
              : null,
          }
        : null
    );
  const secundarios = extractCnaesSecundariosFromRaw(data.raw)
    .filter((item) => !principal || item.codigo !== principal.codigo);
  const cnaes = [
    ...(principal && principal.codigo.length === 7
      ? [{ ...principal, principal: true }]
      : []),
    ...secundarios.map((item) => ({ ...item, principal: false })),
  ];
  return {
    ...data,
    cnaePrincipal: principal && principal.codigo.length === 7 ? principal : null,
    cnaesSecundarios: secundarios,
    cnaes,
  };
};


export const lookupCepBrasilApi = async (cepInput) => {
  const cep = normalizeDoc(cepInput).slice(0, 8);
  if (cep.length !== 8) return null;
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      method: 'GET',
      headers: BRASILAPI_HEADERS,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

/** Fallback quando BrasilAPI CEP v2 não traz IBGE (ex.: 21221300). */
export const lookupCepViaCep = async (cepInput) => {
  const cep = normalizeDoc(cepInput).slice(0, 8);
  if (cep.length !== 8) return null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      method: 'GET',
      headers: BRASILAPI_HEADERS,
    });
    if (!response.ok) return null;
    const raw = await response.json();
    if (!raw || raw.erro) return null;
    return raw;
  } catch {
    return null;
  }
};

const ibgeFromCepLookupPayload = async (cep, brasilApiRaw) => {
  const fromBrasilApi =
    brasilApiRaw?.city_ibge_code != null && String(brasilApiRaw.city_ibge_code).trim()
      ? padZeros(brasilApiRaw.city_ibge_code, 7)
      : null;
  if (fromBrasilApi) return fromBrasilApi;

  const viaCep = await lookupCepViaCep(cep);
  if (viaCep?.ibge != null && String(viaCep.ibge).trim()) {
    return padZeros(viaCep.ibge, 7);
  }

  const cidade = brasilApiRaw?.city || viaCep?.localidade || null;
  const uf = brasilApiRaw?.state || viaCep?.uf || null;
  return resolveIbgeCodigoFromMunicipio(cidade, uf);
};

/** Preenche logradouro/cidade/UF/IBGE faltantes via CEP quando a Receita retorna endereço incompleto. */
const enrichEnderecoFromCep = async (data) => {
  const endereco = data?.endereco || {};
  const cep = normalizeDoc(endereco.cep || '').slice(0, 8);
  const needsLogradouro = !hasText(endereco.logradouro);
  const needsBairro = !hasText(endereco.bairro);
  const needsCidade = !hasText(endereco.descricaoCidade);
  const needsUf = !hasText(endereco.estado);
  const needsIbge = normalizeDoc(endereco.codigoCidade || '').length !== 7;
  if (
    cep.length !== 8
    || (!needsLogradouro && !needsBairro && !needsCidade && !needsUf && !needsIbge)
  ) {
    return data;
  }

  const cepRaw = await lookupCepBrasilApi(cep);
  if (!cepRaw) return data;

  const ibgeFromCep = await ibgeFromCepLookupPayload(cep, cepRaw);

  return {
    ...data,
    endereco: {
      ...endereco,
      logradouro: hasText(endereco.logradouro) ? endereco.logradouro : (cepRaw.street || null),
      bairro: hasText(endereco.bairro) ? endereco.bairro : (cepRaw.neighborhood || null),
      descricaoCidade: hasText(endereco.descricaoCidade) ? endereco.descricaoCidade : (cepRaw.city || null),
      estado: hasText(endereco.estado) ? endereco.estado : (cepRaw.state || null),
      codigoCidade:
        normalizeDoc(endereco.codigoCidade || '').length === 7
          ? String(endereco.codigoCidade).replace(/\D/g, '').slice(0, 7)
          : ibgeFromCep,
      cep,
    },
  };
};

/**
 * Consulta dados cadastrais de um CNPJ via BrasilAPI (público, gratuito).
 * Retorna payload normalizado pronto para preencher formulário de empresa fiscal.
 *
 * @param {string} cnpjInput - CNPJ com ou sem máscara
 * @returns {Promise<object>} Dados normalizados (razao_social, nome_fantasia, endereco, telefone, email)
 */
export const lookupCnpjBrasilApi = async (cnpjInput) => {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) {
    throw badRequest('CNPJ inválido. Informe 14 dígitos.');
  }
  if (!isValidCnpj(cnpj)) {
    throw badRequest('CNPJ inválido. Verifique os dígitos informados.');
  }

  const url = `${BRASILAPI_URL}/${cnpj}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: BRASILAPI_HEADERS
    });
  } catch (err) {
    throw badRequest('Falha ao consultar BrasilAPI. Verifique sua conexão.');
  }

  if (response.status === 404) {
    throw badRequest('CNPJ não encontrado na base da Receita Federal.');
  }
  if (!response.ok) {
    throw badRequest(brasilApiStatusMessage(response.status));
  }

  const raw = await response.json();

  // Normalização para o formato do PlugNotasCompanyForm
  const ddd = padZeros(raw?.ddd_telefone_1, 2);
  const numero = String(raw?.ddd_telefone_1 || '').replace(/\D/g, '').slice(2);

  const data = {
    cpfCnpj: cnpj,
    razaoSocial: raw?.razao_social || null,
    nomeFantasia: raw?.nome_fantasia || null,
    email: raw?.email || null,
    telefone: ddd && numero ? { ddd, numero } : null,
    inscricaoMunicipal: null, // BrasilAPI não traz IM
    inscricaoEstadual: null, // BrasilAPI não traz IE
    endereco: {
      logradouro: raw?.logradouro || null,
      numero: raw?.numero || null,
      complemento: raw?.complemento || null,
      bairro: raw?.bairro || null,
      codigoCidade: raw?.codigo_municipio_ibge ? String(raw.codigo_municipio_ibge) : null,
      descricaoCidade: raw?.municipio || null,
      estado: raw?.uf || null,
      cep: raw?.cep ? String(raw.cep).replace(/\D/g, '') : null
    },
    situacaoCadastral: raw?.descricao_situacao_cadastral || null,
    porte: raw?.porte || null,
    codigoNaturezaJuridica: raw?.codigo_natureza_juridica != null
      ? Number(raw.codigo_natureza_juridica)
      : null,
    capitalSocial: raw?.capital_social || null,
    opcaoSimples: raw?.opcao_pelo_simples || null,
    opcaoMei: raw?.opcao_pelo_mei || null,
    cnaePrincipal: raw?.cnae_fiscal
      ? { codigo: String(raw.cnae_fiscal), descricao: raw?.cnae_fiscal_descricao || null }
      : null,
    raw // mantém payload original caso o front precise de algo extra
  };

  return attachNormalizedCnaes(data);
};

/**
 * Consulta dados cadastrais via PlugNotas. Requer `PLUGNOTAS_API_KEY` configurado.
 * PlugNotas geralmente traz IE/IM e outros campos que a BrasilAPI omite.
 * @param {string} cnpjInput
 */
export const lookupCnpjPlugnotas = async (cnpjInput) => {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) {
    throw badRequest('CNPJ inválido. Informe 14 dígitos.');
  }
  if (!isValidCnpj(cnpj)) {
    throw badRequest('CNPJ inválido. Verifique os dígitos informados.');
  }
  if (!env.PLUGNOTAS_API_KEY) {
    throw badRequest('PlugNotas não configurado.');
  }

  const url = `${getPlugnotasRootUrl()}/cnpj/${cnpj}`;
  const timeoutMs = Number(env.PLUGNOTAS_TIMEOUT_MS || 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': env.PLUGNOTAS_API_KEY
      },
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    throw badRequest('Falha ao consultar PlugNotas. Verifique sua conexão.');
  }
  clearTimeout(timer);

  if (response.status === 404) {
    throw badRequest('CNPJ não encontrado no PlugNotas.');
  }
  if (!response.ok) {
    throw badRequest(`PlugNotas retornou status ${response.status}.`);
  }

  const raw = await response.json();
  const root = raw?.data || raw; // alguns envelopes do PlugNotas vêm em { data: {...} }

  const ddd = padZeros(root?.telefone?.ddd, 2) || padZeros(String(root?.ddd_telefone_1 || '').slice(0, 2), 2);
  const numero =
    String(root?.telefone?.numero || '').replace(/\D/g, '') ||
    String(root?.ddd_telefone_1 || '').replace(/\D/g, '').slice(2);

  const enderecoSrc = root?.endereco || root?.address || {};

  const result = {
    cpfCnpj: cnpj,
    razaoSocial: root?.razaoSocial || root?.razao_social || root?.nome || null,
    nomeFantasia: root?.nomeFantasia || root?.nome_fantasia || null,
    email: root?.email || null,
    telefone: ddd && numero ? { ddd, numero } : null,
    inscricaoMunicipal: root?.inscricaoMunicipal || root?.inscricao_municipal || null,
    inscricaoEstadual: root?.inscricaoEstadual || root?.inscricao_estadual || null,
    endereco: {
      logradouro: enderecoSrc?.logradouro || null,
      numero: enderecoSrc?.numero || null,
      complemento: enderecoSrc?.complemento || null,
      bairro: enderecoSrc?.bairro || null,
      codigoCidade:
        enderecoSrc?.codigoCidade ||
        enderecoSrc?.codigo_municipio_ibge ||
        (enderecoSrc?.cidade?.codigoIbge ? String(enderecoSrc.cidade.codigoIbge) : null),
      descricaoCidade: enderecoSrc?.descricaoCidade || enderecoSrc?.municipio || enderecoSrc?.cidade?.descricao || null,
      estado: enderecoSrc?.estado || enderecoSrc?.uf || enderecoSrc?.cidade?.uf || null,
      cep: enderecoSrc?.cep ? String(enderecoSrc.cep).replace(/\D/g, '') : null
    },
    situacaoCadastral: root?.situacaoCadastral || root?.descricao_situacao_cadastral || null,
    porte: root?.porte || null,
    capitalSocial: root?.capitalSocial || root?.capital_social || null,
    opcaoSimples: root?.opcaoSimples ?? root?.opcao_pelo_simples ?? null,
    opcaoMei: root?.opcaoMei ?? root?.opcao_pelo_mei ?? null,
    cnaePrincipal: root?.cnaePrincipal
      ? {
          codigo: String(root.cnaePrincipal.codigo || ''),
          descricao: root.cnaePrincipal.descricao || null
        }
      : root?.cnae_fiscal
        ? { codigo: String(root.cnae_fiscal), descricao: root?.cnae_fiscal_descricao || null }
        : null,
    raw
  };

  return attachNormalizedCnaes(result);
};

/**
 * Tenta PlugNotas primeiro; se falhar (sem key, 404, timeout, etc.), cai pra BrasilAPI.
 * Enriquece CNAEs secundários via BrasilAPI quando o provedor principal não os trouxer.
 * @param {string} cnpjInput
 */
export const lookupCnpjCascade = async (cnpjInput) => {
  let data;
  let usedPlugnotas = false;
  if (env.PLUGNOTAS_API_KEY) {
    try {
      data = await lookupCnpjPlugnotas(cnpjInput);
      usedPlugnotas = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[cnpj-lookup] PlugNotas falhou, caindo para BrasilAPI:', err?.message);
      data = await lookupCnpjBrasilApi(cnpjInput);
    }
  } else {
    data = await lookupCnpjBrasilApi(cnpjInput);
  }
  data = await enrichEnderecoFromCep(data);
  data = attachNormalizedCnaes(data);

  const needsBrasilCnaes = usedPlugnotas
    && (!Array.isArray(data.cnaesSecundarios) || data.cnaesSecundarios.length === 0);
  if (needsBrasilCnaes) {
    try {
      const br = await lookupCnpjBrasilApi(cnpjInput);
      data = attachNormalizedCnaes({
        ...data,
        cnaePrincipal: data.cnaePrincipal || br.cnaePrincipal,
        raw: {
          ...(data.raw && typeof data.raw === 'object' ? data.raw : {}),
          cnaes_secundarios: br.raw?.cnaes_secundarios,
          cnae_fiscal: data.raw?.cnae_fiscal ?? br.raw?.cnae_fiscal,
          cnae_fiscal_descricao: data.raw?.cnae_fiscal_descricao ?? br.raw?.cnae_fiscal_descricao,
        },
      });
    } catch {
      /* best-effort: manter só o CNAE principal do PlugNotas */
    }
  }
  return data;
};
