import { createSupabaseClient } from '../../config/supabase.js';
import { badRequest } from '../../utils/errors.js';
import { lookupCepBrasilApi, lookupCepViaCep, lookupCnpjCascade } from '../cnpj-lookup.service.js';
import { resolveIbgeCodigoFromMunicipio } from '../ibge-municipios-lookup.service.js';
import { getEmitenteNfseSnapshot } from '../mei-certificate-store.js';
import { unwrapPlugnotasEmpresaRecord } from '../mei-emitente-empresa-sync.js';
import { consultarEmpresaPlugNotas } from './empresa.service.js';

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLIENTS_TABLE = 'mei_nfse_clientes';

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const padZeros = (value, length) => {
  const str = String(value || '').replace(/\D/g, '');
  return str.padStart(length, '0').slice(-length);
};

const resolveIbgeFromCepPayload = (cidade, uf, brasilIbge, viaIbge) => {
  if (brasilIbge != null && String(brasilIbge).trim()) {
    return padZeros(brasilIbge, 7);
  }
  if (viaIbge != null && String(viaIbge).trim()) {
    return padZeros(viaIbge, 7);
  }
  return resolveIbgeCodigoFromMunicipio(cidade, uf);
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const pruneEndereco = (endereco) => {
  if (!isPlainObject(endereco)) return null;
  const cep = normalizeDoc(endereco.cep).slice(0, 8);
  const codigoCidade = String(endereco.codigoCidade || '').trim();
  const logradouro = String(endereco.logradouro || '').trim();
  const numero = String(endereco.numero || '').trim();
  const bairro = String(endereco.bairro || '').trim();
  const descricaoCidade = String(endereco.descricaoCidade || '').trim();
  const estado = String(endereco.estado || '').trim().toUpperCase().slice(0, 2);
  const complemento = String(endereco.complemento || '').trim();
  const next = {
    ...(cep.length === 8 ? { cep } : {}),
    ...(logradouro ? { logradouro } : {}),
    ...(numero ? { numero } : {}),
    ...(bairro ? { bairro } : {}),
    ...(codigoCidade ? { codigoCidade } : {}),
    ...(descricaoCidade ? { descricaoCidade } : {}),
    ...(estado.length === 2 ? { estado, uf: estado } : {}),
    ...(complemento ? { complemento } : {}),
  };
  return Object.keys(next).length ? next : null;
};

export const mergeEnderecoLayers = (...layers) => {
  const merged = {};
  for (const layer of layers) {
    const pruned = pruneEndereco(isPlainObject(layer) ? layer : null);
    if (pruned) Object.assign(merged, pruned);
  }
  return Object.keys(merged).length ? pruneEndereco(merged) : null;
};

const isEmitPayloadLike = (value) => (
  isPlainObject(value)
  && (
    value.tomadorCep !== undefined
    || value.tomadorEndereco !== undefined
    || value.tomador?.endereco !== undefined
    || value.endereco !== undefined
    || value.tomadorLogradouro !== undefined
    || value.tomadorBairro !== undefined
    || value.tomadorCodigoCidade !== undefined
    || value.tomadorIbge !== undefined
    || value.tomadorCidade !== undefined
    || value.tomadorUf !== undefined
  )
);

/**
 * Aceita tomadorEndereco aninhado ou campos planos do OpenClaw (tomadorCep, tomadorLogradouro, …).
 * @param {Record<string, unknown>|null|undefined} payload
 * @returns {Record<string, string>|null}
 */
export const normalizeTomadorEnderecoFromEmitPayload = (payload) => {
  if (!isPlainObject(payload)) return null;

  const nested = isPlainObject(payload.tomadorEndereco)
    ? payload.tomadorEndereco
    : (
        isPlainObject(payload.endereco)
          ? payload.endereco
          : (isPlainObject(payload.tomador?.endereco) ? payload.tomador.endereco : null)
      );

  const flat = {
    cep: payload.tomadorCep ?? payload.cep,
    logradouro: payload.tomadorLogradouro ?? payload.logradouro,
    numero: payload.tomadorNumero ?? payload.numero,
    bairro: payload.tomadorBairro ?? payload.bairro,
    codigoCidade:
      payload.tomadorCodigoCidade
      ?? payload.tomadorIbge
      ?? payload.codigoIbge
      ?? payload.codigoCidade
      ?? payload.ibge,
    descricaoCidade:
      payload.tomadorCidade
      ?? payload.tomadorDescricaoCidade
      ?? payload.cidade
      ?? payload.descricaoCidade,
    estado: payload.tomadorUf ?? payload.tomadorEstado ?? payload.uf ?? payload.estado,
    complemento: payload.tomadorComplemento ?? payload.complemento,
  };

  return mergeEnderecoLayers(flat, nested);
};

const pruneEnderecoFromEmitArg = (payloadOrEndereco) => {
  if (isEmitPayloadLike(payloadOrEndereco)) {
    return normalizeTomadorEnderecoFromEmitPayload(payloadOrEndereco);
  }
  return pruneEndereco(isPlainObject(payloadOrEndereco) ? payloadOrEndereco : null);
};

export const hasCompleteTomadorEndereco = (endereco) => {
  const e = pruneEndereco(endereco);
  if (!e) return false;
  return (
    normalizeDoc(e.cep).length === 8
    && Boolean(String(e.logradouro || '').trim())
    && Boolean(String(e.numero || '').trim())
    && Boolean(String(e.bairro || '').trim())
    && Boolean(String(e.codigoCidade || '').trim())
    && Boolean(String(e.descricaoCidade || '').trim())
    && String(e.estado || '').trim().length === 2
  );
};

/** Campos obrigatórios do endereço PJ ainda ausentes (ordem de coleta no WhatsApp). */
export const listMissingTomadorEnderecoFields = (endereco) => {
  const e = pruneEndereco(endereco);
  const missing = [];
  if (!e || normalizeDoc(e.cep).length !== 8) missing.push('cep');
  if (!String(e?.logradouro || '').trim()) missing.push('logradouro');
  if (!String(e?.numero || '').trim()) missing.push('numero');
  if (!String(e?.bairro || '').trim()) missing.push('bairro');
  if (normalizeDoc(e?.codigoCidade || '').length !== 7) missing.push('codigoCidade');
  if (!String(e?.descricaoCidade || '').trim()) missing.push('descricaoCidade');
  if (String(e?.estado || '').trim().length !== 2) missing.push('estado');
  return missing;
};

const ENDERECO_FIELD_PAYLOAD_KEYS = {
  cep: 'tomadorCep',
  logradouro: 'tomadorLogradouro',
  numero: 'tomadorNumero',
  bairro: 'tomadorBairro',
  codigoCidade: 'tomadorIbge',
  descricaoCidade: 'tomadorCidade',
  estado: 'tomadorUf',
};

const buildEnderecoFieldUserPrompt = (field, nome, endereco) => {
  const e = pruneEndereco(endereco);
  const cidade = String(e?.descricaoCidade || '').trim();
  switch (field) {
    case 'cep':
      return `Para emitir a nota para **${nome}**, preciso do **CEP** do endereço fiscal (8 dígitos).`;
    case 'logradouro':
      return `Preciso do **logradouro** (rua/avenida) do endereço de **${nome}**.`;
    case 'numero':
      return `CEP já salvo para **${nome}**. Qual o **número** do endereço? (pode responder *S/N* se não houver).`;
    case 'bairro':
      return `Preciso do **bairro** do endereço de **${nome}**.`;
    case 'codigoCidade':
      return cidade
        ? `Quase lá! Para **${nome}**, falta só o **código IBGE** de ${cidade} (7 dígitos).`
        : `Para **${nome}**, preciso do **código IBGE** da cidade (7 dígitos).`;
    case 'descricaoCidade':
      return `Preciso da **cidade** do endereço fiscal de **${nome}**.`;
    case 'estado':
      return `Preciso da **UF** (estado) do endereço de **${nome}**.`;
    default:
      return `Falta completar o endereço fiscal de **${nome}** para emitir a nota.`;
  }
};

/** Mensagem WhatsApp para o utilizador — só o próximo campo em falta. */
export const buildTomadorEnderecoMissingUserMessage = (nome, endereco) => {
  const missing = listMissingTomadorEnderecoFields(endereco);
  if (!missing.length) return null;
  return buildEnderecoFieldUserPrompt(missing[0], nome, endereco);
};

/** Instrução interna ao agente — pedir um campo e gravar com register_nfse_cliente. */
export const buildTomadorEnderecoMissingBotHint = (nome, endereco) => {
  const missing = listMissingTomadorEnderecoFields(endereco);
  if (!missing.length) return null;
  const field = missing[0];
  const payloadKey = ENDERECO_FIELD_PAYLOAD_KEYS[field] || field;
  return (
    `Endereço PJ incompleto — falta só "${field}". Repita APENAS message (pergunta ao utilizador). `
    + `Quando o utilizador responder, chame register_nfse_cliente com tomadorNome="${nome}" `
    + `e ${payloadKey}=valor da resposta (mantenha documento se já souber). `
    + `Não peça campos já gravados. Se enderecoIncomplete continuar, repita com o próximo campo. `
    + `Quando completo, siga preview_nfse → emit_nfse.`
  );
};

export const resolveTomadorEnderecoPayloadKey = (field) => (
  ENDERECO_FIELD_PAYLOAD_KEYS[field] || null
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export const isValidPlugnotasEmitEmail = (value) => (
  EMAIL_LIKE.test(String(value || '').trim())
);

/**
 * @param {...unknown} candidates
 * @returns {string|null}
 */
export const pickFirstValidEmitEmail = (...candidates) => {
  for (const candidate of candidates) {
    const email = String(candidate ?? '').trim();
    if (isValidPlugnotasEmitEmail(email)) return email;
  }
  return null;
};

/**
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export const resolveAuthUserEmail = async (userId) => {
  if (!userId) return null;
  try {
    const admin = createSupabaseClient({ useServiceRole: true });
    const { data: authData, error } = await admin.auth.admin.getUserById(userId);
    if (error || !authData?.user?.email) return null;
    return pickFirstValidEmitEmail(authData.user.email);
  } catch {
    return null;
  }
};

/**
 * @param {string} userId
 * @param {string} documento
 * @param {string} [documentType]
 * @returns {Promise<string|null>}
 */
export const resolveCatalogClienteEmail = async (userId, documento, documentType = 'NFSE') => {
  const record = await resolveCatalogClienteRecord(userId, documento, documentType);
  return pickFirstValidEmitEmail(record?.email);
};

/**
 * @param {string} userId
 * @param {string} documento
 * @param {string} [documentType]
 * @returns {Promise<{ email?: string|null, metadata_json?: Record<string, unknown>|null }|null>}
 */
export const resolveCatalogClienteRecord = async (userId, documento, documentType = 'NFSE') => {
  const doc = normalizeDoc(documento);
  if (!userId || !doc) return null;
  try {
    const db = createSupabaseClient({ useServiceRole: true });
    const { data, error } = await db
      .from(CLIENTS_TABLE)
      .select('email, metadata_json')
      .eq('user_id', userId)
      .eq('document_type', documentType)
      .eq('documento', doc)
      .maybeSingle();
    if (error) return null;
    if (!data) return null;
    const meta = data.metadata_json;
    if (meta && typeof meta === 'object' && !Array.isArray(meta) && meta.catalogActive === false) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const resolveCatalogClienteEndereco = async (userId, documento, documentType = 'NFSE') => {
  const record = await resolveCatalogClienteRecord(userId, documento, documentType);
  if (!record?.metadata_json || typeof record.metadata_json !== 'object') return null;
  const rawEndereco = record.metadata_json.endereco;
  return pruneEndereco(isPlainObject(rawEndereco) ? rawEndereco : null);
};

/**
 * @param {Record<string, unknown>|null|undefined} lookup
 * @returns {Record<string, string>|null}
 */
export const enderecoFromCnpjLookupNfse = (lookup) => {
  const end = lookup?.endereco;
  if (!isPlainObject(end)) return null;
  const mapped = pruneEndereco({
    cep: end.cep,
    logradouro: end.logradouro,
    numero: String(end.numero || '').trim() || 'S/N',
    bairro: end.bairro,
    codigoCidade: end.codigoCidade,
    descricaoCidade: end.descricaoCidade || end.cidade,
    estado: end.estado || end.uf,
    complemento: end.complemento,
  });
  return hasCompleteTomadorEndereco(mapped) ? mapped : null;
};

/**
 * Preenche logradouro, bairro, cidade, UF e IBGE via BrasilAPI CEP v2.
 * @param {string} cepInput
 * @param {Record<string, unknown>|null|undefined} partialEndereco
 * @returns {Promise<Record<string, string>|null>}
 */
export const enderecoFromCepLookupNfse = async (cepInput, partialEndereco = null) => {
  const cep = normalizeDoc(cepInput).slice(0, 8);
  if (cep.length !== 8) return null;

  const partial = pruneEndereco(isPlainObject(partialEndereco) ? partialEndereco : null);
  const cepRaw = await lookupCepBrasilApi(cep);
  if (!cepRaw) {
    const viaOnly = await lookupCepViaCep(cep);
    if (!viaOnly) return partial;
    const descricaoCidade = partial?.descricaoCidade || viaOnly.localidade || null;
    const estado = partial?.estado || viaOnly.uf || null;
    return pruneEndereco({
      cep,
      logradouro: partial?.logradouro || viaOnly.logradouro || null,
      numero: partial?.numero || null,
      bairro: partial?.bairro || viaOnly.bairro || null,
      codigoCidade: partial?.codigoCidade || resolveIbgeFromCepPayload(
        descricaoCidade,
        estado,
        null,
        viaOnly.ibge,
      ),
      descricaoCidade,
      estado,
      complemento: partial?.complemento || viaOnly.complemento || null,
    });
  }

  const viaCep = await lookupCepViaCep(cep);
  const descricaoCidade = partial?.descricaoCidade || cepRaw.city || viaCep?.localidade || null;
  const estado = partial?.estado || cepRaw.state || viaCep?.uf || null;
  const ibgeFromCep = resolveIbgeFromCepPayload(
    descricaoCidade,
    estado,
    cepRaw.city_ibge_code,
    viaCep?.ibge,
  );

  return pruneEndereco({
    cep,
    logradouro: partial?.logradouro || cepRaw.street || viaCep?.logradouro || null,
    numero: partial?.numero || null,
    bairro: partial?.bairro || cepRaw.neighborhood || viaCep?.bairro || null,
    codigoCidade: partial?.codigoCidade || ibgeFromCep,
    descricaoCidade,
    estado,
    complemento: partial?.complemento || viaCep?.complemento || null,
  });
};

/**
 * Completa metadata_json.endereco via CEP (BrasilAPI/ViaCEP + tabela IBGE local).
 * @param {Record<string, unknown>|null|undefined} metadata
 * @returns {Promise<Record<string, unknown>|null|undefined>}
 */
export const enrichCatalogClienteMetadataFromCep = async (metadata) => {
  if (!isPlainObject(metadata)) return metadata;
  const endereco = metadata.endereco;
  if (!isPlainObject(endereco)) return metadata;

  const cep = normalizeDoc(endereco.cep).slice(0, 8);
  if (cep.length !== 8) return metadata;
  if (normalizeDoc(endereco.codigoCidade).length === 7) return metadata;

  const fromCep = await enderecoFromCepLookupNfse(cep, endereco);
  if (!fromCep) return metadata;

  return {
    ...metadata,
    endereco: mergeEnderecoLayers(endereco, fromCep),
  };
};

const applyTomadorNumeroDefault = (endereco) => {
  const pruned = pruneEndereco(endereco);
  if (!pruned || String(pruned.numero || '').trim()) return pruned;
  return pruneEndereco({ ...pruned, numero: 'S/N' });
};

/**
 * Catálogo → consulta CNPJ (Receita/Plugnotas) antes da validação do payload.
 * @param {string} userId
 * @param {string} tomadorDoc
 * @param {unknown} payloadEndereco
 * @returns {Promise<Record<string, string>|null>}
 */
export const resolveTomadorEmitEndereco = async (userId, tomadorDoc, payloadOrEndereco) => {
  const fromPayload = pruneEnderecoFromEmitArg(payloadOrEndereco);
  if (hasCompleteTomadorEndereco(fromPayload)) return fromPayload;

  const catalogEndereco = await resolveCatalogClienteEndereco(userId, tomadorDoc);

  let fromLookup = null;
  if (tomadorDoc.length === 14) {
    try {
      const lookup = await lookupCnpjCascade(tomadorDoc);
      fromLookup = enderecoFromCnpjLookupNfse(lookup);
    } catch {
      /* consulta opcional — validação final informa campos faltantes */
    }
  }

  let merged = mergeEnderecoLayers(fromPayload, catalogEndereco, fromLookup);

  if (!hasCompleteTomadorEndereco(merged)) {
    const cepCandidate = normalizeDoc(
      merged?.cep
      || fromPayload?.cep
      || fromPayload?.tomadorCep,
    ).slice(0, 8);
    if (cepCandidate.length === 8) {
      const fromCep = await enderecoFromCepLookupNfse(cepCandidate, merged);
      if (fromCep) merged = mergeEnderecoLayers(merged, fromCep);
    }
  }

  if (!hasCompleteTomadorEndereco(merged)) {
    const withNumero = applyTomadorNumeroDefault(merged);
    if (hasCompleteTomadorEndereco(withNumero)) return withNumero;
  }

  if (hasCompleteTomadorEndereco(merged)) return merged;

  return merged || fromPayload;
};

/**
 * E-mail do prestador: formulário → espelho local → Plugnotas → conta Auth.
 * @param {string} userId
 * @param {string} [cnpj14]
 * @param {unknown} payloadEmail
 */
export const resolvePrestadorEmitEmail = async (userId, cnpj14, payloadEmail) => {
  const fromPayload = pickFirstValidEmitEmail(payloadEmail);
  if (fromPayload) return fromPayload;

  let emitente = null;
  try {
    emitente = await getEmitenteNfseSnapshot(userId);
  } catch {
    emitente = null;
  }
  const fromMirror = pickFirstValidEmitEmail(emitente?.email);
  if (fromMirror) return fromMirror;

  const cnpj = normalizeDoc(cnpj14);
  if (cnpj.length === 14) {
    try {
      const empresaJson = await consultarEmpresaPlugNotas(cnpj);
      const empresa = unwrapPlugnotasEmpresaRecord(empresaJson);
      const fromPlugnotas = pickFirstValidEmitEmail(empresa?.email);
      if (fromPlugnotas) return fromPlugnotas;
    } catch {
      /* empresa pode não existir ainda */
    }
  }

  return await resolveAuthUserEmail(userId);
};

/**
 * Completa e-mails no payload NFS-e antes do POST Plugnotas.
 * @param {string} userId
 * @param {Record<string, unknown>} payload
 * @param {{ prestadorDoc?: string, tomadorDoc?: string }} [options]
 */
export const enrichNfseEmitPayloadEmails = async (userId, payload, options = {}) => {
  if (!payload || typeof payload !== 'object') return payload;

  const prestadorDoc = normalizeDoc(
    options.prestadorDoc || payload?.prestador?.cpfCnpj || '',
  );
  const tomadorDoc = normalizeDoc(
    options.tomadorDoc || payload?.tomador?.cpfCnpj || '',
  );

  const prestador = payload.prestador && typeof payload.prestador === 'object'
    ? { ...payload.prestador }
    : {};
  const tomador = payload.tomador && typeof payload.tomador === 'object'
    ? { ...payload.tomador }
    : {};

  const prestadorEmail = await resolvePrestadorEmitEmail(
    userId,
    prestadorDoc,
    prestador.email,
  );
  if (prestadorEmail) prestador.email = prestadorEmail;

  if (!isValidPlugnotasEmitEmail(tomador.email) && tomadorDoc) {
    const tomadorEmail = await resolveCatalogClienteEmail(userId, tomadorDoc);
    if (tomadorEmail) tomador.email = tomadorEmail;
  }

  if (tomadorDoc.length === 14) {
    const tomadorEndereco = await resolveTomadorEmitEndereco(
      userId,
      tomadorDoc,
      options.emitInput || tomador.endereco,
    );
    if (tomadorEndereco) tomador.endereco = tomadorEndereco;
  }

  return {
    ...payload,
    prestador,
    tomador,
  };
};

/**
 * @param {Record<string, unknown>} payload
 */
export const assertNfsePrestadorEmailOrThrow = (payload) => {
  const email = payload?.prestador?.email;
  if (isValidPlugnotasEmitEmail(email)) return;
  throw badRequest(
    'E-mail do prestador é obrigatório para emitir NFS-e. '
    + 'Preencha em Certificado → Empresa ou use o e-mail da sua conta de login.',
    { plugnotasCode: 'nfse_prestador_email_ausente' },
  );
};
