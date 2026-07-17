import { env } from '../config/env.js';
import { badRequest, forbidden, notFound, unauthorized } from '../utils/errors.js';
import { requestWithMtls } from '../utils/http-mtls.js';
import { createRequire } from 'module';
import { consultarServico } from './gestao/consultar.service.js';
import { emitirServico } from './gestao/emitir.service.js';
import {
  encryptPassphrase,
  decryptPassphrase,
  saveCertificate,
  saveCertificateDocument,
  loadCertificate,
  deleteCertificate,
  getCertificateDocument,
  getCertificateValidity,
  patchEmitenteNfseFields,
  getEmitenteNfseSnapshot,
  getDocumentosAtivosMirror,
  savePlugNotasCertId,
  hasCertificatePfx,
  countOtherUsersWithPlugnotasCertId,
  getPlugNotasCertId
} from './mei-certificate-store.js';
import { syncEmitenteMirrorAfterCertificateUpload } from './mei-emitente-empresa-sync.js';
import {
  cadastrarCertificadoPlugNotas,
  resolverCertificadoIdPorCnpj,
  excluirCertificadoPlugNotas
} from './plugnotas/empresa.service.js';
import { assertMeiCertificateEligible } from './mei-certificate-eligibility.service.js';
import {
  isCompetenciaPaid,
  listPaidCompetencias,
  markCompetenciaAsPaid,
  periodoApuracaoToCompetencia,
  getKnownCompetenciaPeriodStatus,
} from './mei-period-status.service.js';
import {
  deleteDasBase64,
  getDasBase64,
  upsertDasBase64,
} from './mei-guide-das-base64.service.js';
import {
  deleteStoredDasPdf,
  downloadStoredDasPdfBuffer,
} from './mei-guide-storage.service.js';
import { clearCompetenciaPaidStatus } from './mei-period-status.service.js';
import {
  assertSerproDasPeriodoDisponivel,
  competenciaLabelFromPeriod,
  isPeriodoIndisponivelSerproError,
  isPeriodoIndisponivelSerproMessage,
  isPeriodoPagoSerproError,
  isPeriodoPagoSerproMessage,
  periodoIndisponivelError,
  isSerproUnavailableError,
} from './mei-guide-serpro-period-guard.js';
import {
  enrichDasPeriodWithVencimento,
  isDasCompetenciaVencida,
} from './mei-das-vencimento.js';

const MEI_DAS_PAID_NO_PDF_CODE = 'MEI_DAS_PAID_NO_PDF';
import * as parcelamentoPdfService from './mei-guide-parcelamento-pdf.service.js';

const require = createRequire(import.meta.url);
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');
const forge = require('node-forge');

const normalizeBaseUrl = (value) => value.replace(/\/$/, '');

const ensureConfigured = () => {
  if (!env.SERPRO_API_BASE_URL || !env.SERPRO_OAUTH_TOKEN_URL) {
    throw badRequest('Integração MEI não configurada');
  }
  if (!env.SERPRO_CONSUMER_KEY || !env.SERPRO_CONSUMER_SECRET) {
    throw badRequest('Credenciais Serpro não configuradas');
  }
  if (!isNoMtlsEnabled() && !env.SERPRO_CERT_PFX_BASE64) {
    throw badRequest('Certificado Serpro não configurado');
  }
};

const ensureTokenConfigured = () => {
  if (!env.SERPRO_API_BASE_URL || !env.SERPRO_OAUTH_TOKEN_URL) {
    throw badRequest('Integração MEI não configurada');
  }
  if (!env.SERPRO_CONSUMER_KEY || !env.SERPRO_CONSUMER_SECRET) {
    throw badRequest('Credenciais Serpro não configuradas');
  }
};

const isNoMtlsEnabled = () => String(env.SERPRO_OAUTH_TOKEN_NO_MTLS || '').toLowerCase() === 'true';

const normalizeCnpj = (value) => String(value || '').replace(/\D/g, '');

const validateCnpj = (cnpj) => {
  if (!cnpj) return false;
  const digits = normalizeCnpj(cnpj);
  return digits.length === 14;
};

const validateCompetencia = (mes, ano) => {
  const month = Number(mes);
  const year = Number(ano);
  if (!Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (month < 1 || month > 12) return false;
  if (year < 2000 || year > 2100) return false;
  return true;
};

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const getDocType = (value) => {
  const digits = normalizeDoc(value);
  if (digits.length === 11) return 1;
  if (digits.length === 14) return 2;
  return null;
};

const validateDoc = (value) => {
  const digits = normalizeDoc(value);
  return digits.length === 11 || digits.length === 14;
};

const getDocTypeLabel = (value) => {
  if (value === 1 || value === 2) return value === 1 ? 'PF' : 'PJ';
  const text = String(value || '').toUpperCase();
  if (text === '1') return 'PF';
  if (text === '2') return 'PJ';
  if (text === 'PF' || text === 'PJ') return text;
  const type = getDocType(value);
  if (type === 1) return 'PF';
  if (type === 2) return 'PJ';
  return null;
};

const normalizeDocTypeNumber = (tipo, docNumero) => {
  const numeric = Number(tipo);
  if (numeric === 1 || numeric === 2) return numeric;

  const text = String(tipo || '').toUpperCase();
  if (text === 'PF') return 1;
  if (text === 'PJ') return 2;

  return getDocType(docNumero);
};

const SAN_OID_CNPJ = '2.16.76.1.3.3';
const SAN_OID_CPF = '2.16.76.1.3.1';

const collectStringCandidates = (value, candidates) => {
  if (!value) return;
  if (typeof value === 'string') {
    candidates.push(value);
    return;
  }
  if (Buffer.isBuffer(value)) {
    candidates.push(value.toString('utf8'));
    candidates.push(value.toString('binary'));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringCandidates(item, candidates));
    return;
  }
  if (typeof value === 'object') {
    if (typeof value.getBytes === 'function') {
      candidates.push(value.getBytes());
      return;
    }
    if (value.value !== undefined) {
      collectStringCandidates(value.value, candidates);
    }
    if (value.bytes !== undefined) {
      collectStringCandidates(value.bytes, candidates);
    }
  }
};

const extractDocFromCandidates = (candidates, length) => {
  const pattern = new RegExp(`\\d{${length}}`);
  for (const candidate of candidates) {
    const match = String(candidate).match(pattern);
    if (match) return match[0];
  }
  return null;
};

const toDerBytes = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('binary');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('binary');
  if (typeof value.getBytes === 'function') return value.getBytes();
  if (typeof value.value === 'string') return value.value;
  return null;
};

const extractDocFromOtherNameValue = (value, length) => {
  const candidates = [];
  collectStringCandidates(value, candidates);
  const direct = extractDocFromCandidates(candidates, length);
  if (direct) return direct;

  const derBytes = toDerBytes(value);
  if (!derBytes) return null;
  try {
    const asn1 = forge.asn1.fromDer(derBytes);
    const fromDer = [];
    collectStringCandidates(asn1, fromDer);
    return extractDocFromCandidates(fromDer, length);
  } catch {
    return null;
  }
};

const extractDocFromSubjectAltName = (cert) => {
  const extension = (cert.extensions || [])
    .find((item) => item.name === 'subjectAltName' || item.id === '2.5.29.17');
  if (!extension?.altNames?.length) return null;

  const extractByOid = (oid, length) => {
    for (const altName of extension.altNames) {
      if (altName.type !== 0 || altName.oid !== oid) continue;
      const doc = extractDocFromOtherNameValue(altName.value, length);
      if (doc) return doc;
    }
    return null;
  };

  return extractByOid(SAN_OID_CNPJ, 14) || extractByOid(SAN_OID_CPF, 11);
};

const toIsoOrNull = (value) => {
  if (value == null) return null;
  try {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
};

/** Nome do titular no CN ICP-Brasil (ex.: "65 805 583 RAZAO:65805583000173"). */
const extractHolderNameFromCn = (cnValue) => {
  const cn = String(cnValue || '').trim();
  if (!cn) return '';
  const beforeColon = cn.includes(':') ? cn.split(':')[0] : cn;
  const name = beforeColon.replace(/^[\d\s./-]+/, '').trim();
  return name || beforeColon.trim();
};

const extractCertInfo = (cert) => {
  const subjectAttrs = cert.subject?.attributes || [];
  const subjectValues = subjectAttrs
    .map((attr) => String(attr.value || ''))
    .filter(Boolean);
  const cnpjMatches = subjectValues
    .flatMap((value) => value.match(/\d{14}/g) || []);
  const cnValue = subjectAttrs.find((attr) => attr.shortName === 'CN')?.value || '';
  const holderName = extractHolderNameFromCn(cnValue);
  const cnCnpj = String(cnValue).match(/:(\d{14})/)?.[1] || null;
  const cnpjFromSan = extractDocFromSubjectAltName(cert);
  const cnpjFromSubject = Array.from(new Set(cnpjMatches));
  const doc = cnpjFromSan || cnCnpj || cnpjFromSubject[0] || null;
  const docSource = cnpjFromSan ? 'san' : (cnCnpj ? 'cn' : (cnpjFromSubject[0] ? 'subject' : null));

  const validity = cert.validity;
  const validFrom = validity ? toIsoOrNull(validity.notBefore) : null;
  const validTo = validity ? toIsoOrNull(validity.notAfter) : null;

  return {
    doc,
    docSource,
    cnpjFromSan,
    cnpjFromSubject,
    cnpjFromCN: cnCnpj,
    holderName,
    subject: subjectAttrs,
    serialNumber: cert.serialNumber,
    validFrom,
    validTo
  };
};

const escapeXmlAttr = (value) => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const formatDateYYYYMMDD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const normalizePeriodoApuracao = (periodo, mes, ano) => {
  if (periodo) {
    const value = String(periodo).replace(/\D/g, '');
    if (value.length === 6) return value;
  }

  if (validateCompetencia(mes, ano)) {
    return `${Number(ano)}${String(Number(mes)).padStart(2, '0')}`;
  }

  return null;
};

const PAID_PERIOD_BUSINESS_MESSAGE =
  'Este mês já está pago na Receita e ela não devolveu um novo PDF aqui. Abra o PGMEI (gov.br) → competência 02/2026 → comprovante/DAS, ou peça suporte para reimportar o arquivo.';
const paidPeriodNoPdfError = () =>
  badRequest(PAID_PERIOD_BUSINESS_MESSAGE, { code: MEI_DAS_PAID_NO_PDF_CODE });
const HISTORICO_DAS_ERROR_FALLBACK = 'Falha técnica ao consultar período no Serpro.';
const SERPRO_SEM_PDF_PATTERNS = [
  /pdf\s+do\s+das\s+n[aã]o\s+retornado/i,
  /arquivo\s+da\s+guia\s+mei\s+n[aã]o\s+dispon[íi]vel/i
];

const isPeriodoSemPdfError = (error) => {
  const message = String(error?.message || '').trim();
  if (!message) return false;
  return SERPRO_SEM_PDF_PATTERNS.some((pattern) => pattern.test(message));
};

const shouldMarkCompetenciaAsPaid = (error) => {
  if (isPeriodoPagoSerproError(error)) return true;
  if (isPeriodoIndisponivelSerproError(error)) return false;
  return isPeriodoSemPdfError(error);
};

const getPeriodHistoryErrorMessage = (error) => {
  const message = String(error?.message || '').trim();
  if (!message) return HISTORICO_DAS_ERROR_FALLBACK;
  return message.slice(0, 220);
};

const normalizeDocumentoFiscalForStatus = (value) => {
  const digits = normalizeDoc(value);
  return digits.length === 14 ? digits : null;
};

const persistPaidCompetenciaSafely = async ({
  userId,
  competencia,
  documentoFiscal,
  source,
  markCompetenciaAsPaidFn = markCompetenciaAsPaid
}) => {
  if (!userId || !competencia) return;
  try {
    await markCompetenciaAsPaidFn({
      userId,
      competencia,
      documentoFiscal,
      source
    });
    invalidatePeriodsListCache(userId, documentoFiscal);
  } catch (error) {
    if (env.NODE_ENV !== 'production') {
      console.warn('[mei-guide] Falha ao persistir competência paga', {
        userId,
        competencia,
        message: error instanceof Error ? error.message : String(error || '')
      });
    }
  }
};

const tokenCache = new Map();
const procuradorTokenCache = new Map();
/** Evita 8 POSTs simultâneos em Apoiar quando listParcelamentos consulta modalidades em paralelo. */
const procuradorTokenInFlight = new Map();
const certInfoCache = new Map();
const userCertCache = new Map();

const getUserCacheKey = (userId) => `user:${userId}`;

const getUserCert = (userId) => {
  if (!userId) return null;
  const cacheKey = getUserCacheKey(userId);
  const cached = userCertCache.get(cacheKey);
  if (!cached) return null;
  return { ...cached, cacheKey };
};

const setUserCert = (userId, cert) => {
  if (!userId || !cert?.pfx) return null;
  const cacheKey = getUserCacheKey(userId);
  userCertCache.set(cacheKey, { ...cert });
  return cacheKey;
};

const getUserCertDocument = (userId) => {
  const cert = getUserCert(userId);
  const doc = cert?.certInfo?.doc || null;
  return doc ? normalizeDoc(doc) : null;
};

const clearUserCaches = (userId) => {
  if (!userId) {
    tokenCache.clear();
    procuradorTokenCache.clear();
    certInfoCache.clear();
    userCertCache.clear();
    return;
  }
  const cacheKey = getUserCacheKey(userId);
  tokenCache.delete(cacheKey);
  certInfoCache.delete(cacheKey);
  userCertCache.delete(cacheKey);
  procuradorTokenCache.clear();
};

const hasUserCertificate = (userId) => Boolean(getUserCert(userId));

/** Certificado na sessão ou persistido no Supabase (carrega PFX se necessário). */
export const userHasMeiCertificate = async (userId) => {
  if (!userId) return false;
  await ensureUserCertLoaded(userId);
  if (hasUserCertificate(userId)) return true;
  try {
    // Baseado no .pfx persistido — NÃO em cert_document, que é preservado após a
    // exclusão (senão a remoção do certificado nunca refletiria no status/UI).
    return await hasCertificatePfx(userId);
  } catch {
    return false;
  }
};

const resolveMeiCnpjForUser = async (userId, cnpj) => {
  const fromPayload = normalizeDoc(cnpj || '');
  if (validateDoc(fromPayload)) return fromPayload;
  if (!userId) return '';
  await ensureUserCertLoaded(userId);
  const fromCache = normalizeDoc(getUserCertDocument(userId) || '');
  if (validateDoc(fromCache)) return fromCache;
  try {
    const doc = await getCertificateDocument(userId);
    const fromDb = normalizeDoc(doc || '');
    if (validateDoc(fromDb)) return fromDb;
  } catch {
    /* ignora */
  }
  return '';
};

/** Carrega certificado do banco para o cache quando não está em memória. */
const ensureUserCertLoaded = async (userId) => {
  if (getUserCert(userId)) return;
  if (!env.MEI_CERT_ENCRYPTION_KEY) return;
  let loaded;
  try {
    loaded = await loadCertificate(userId);
  } catch {
    return;
  }
  if (!loaded) return;
  if (!loaded.pfxBase64 || !loaded.passphraseEnc || !loaded.passphraseIv) {
    return;
  }
  const pfx = Buffer.from(loaded.pfxBase64, 'base64');
  let passphrase;
  try {
    passphrase = decryptPassphrase(loaded.passphraseEnc, loaded.passphraseIv);
  } catch {
    return;
  }
  let certInfo;
  try {
    certInfo = extractPfxKeyAndCert(pfx, passphrase).certInfo;
  } catch {
    return;
  }
  setUserCert(userId, { pfx, passphrase, certInfo });
};

const ensureClientCertificate = async (userId) => {
  await ensureUserCertLoaded(userId);
  if (!getUserCert(userId)) {
    throw badRequest('Certificado do cliente não configurado');
  }
};

const getOauthContext = () => {
  if (env.SERPRO_CERT_PFX_BASE64) {
    return { source: 'env', cacheKey: 'env', cert: null };
  }
  return { source: 'none', cacheKey: 'env', cert: null };
};

const getProcuradorContext = (userId) => {
  const userCert = getUserCert(userId);
  if (userCert) {
    return { source: 'user', cacheKey: userCert.cacheKey, cert: userCert };
  }
  return { source: 'none', cacheKey: getUserCacheKey(userId), cert: null };
};

const loadEnvPfx = () => {
  if (!env.SERPRO_CERT_PFX_BASE64) {
    return { pfx: null, passphrase: undefined };
  }
  const buffer = Buffer.from(env.SERPRO_CERT_PFX_BASE64, 'base64');
  return { pfx: buffer, passphrase: env.SERPRO_CERT_PFX_PASS || undefined };
};

const getOauthTlsConfig = () => {
  const context = getOauthContext();
  if (context.source === 'none') {
    return null;
  }

  const loaded = loadEnvPfx();
  if (!loaded.pfx) {
    return null;
  }

  return { pfx: loaded.pfx, passphrase: loaded.passphrase };
};

const requestWithOptionalMtls = async (url, options, tlsConfig) => {
  if (tlsConfig?.pfx) {
    return requestWithMtls(url, { ...options, ...tlsConfig });
  }
  return fetch(url, options);
};

const getSerproToken = async (_userId) => {
  if (String(env.SERPRO_OAUTH_TOKEN_NO_MTLS).toLowerCase() === 'true') {
    return await getSerproTokenWithoutCert();
  }
  ensureConfigured();
  const context = getOauthContext();

  const now = Date.now();
  const cached = tokenCache.get(context.cacheKey);
  if (cached?.accessToken && cached?.jwtToken && cached?.expiresAt > now + 60000) {
    return { accessToken: cached.accessToken, jwtToken: cached.jwtToken };
  }

  const credentials = Buffer.from(`${env.SERPRO_CONSUMER_KEY}:${env.SERPRO_CONSUMER_SECRET}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'client_credentials' }).toString();
  const tlsConfig = getOauthTlsConfig();

  const response = await requestWithOptionalMtls(env.SERPRO_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Role-Type': env.SERPRO_ROLE_TYPE
    },
    body
  }, tlsConfig);

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    console.warn('[mei-guide] Serpro auth error', {
      status: response.status,
      url: env.SERPRO_OAUTH_TOKEN_URL,
      message
    });
    throw badRequest(message || 'Erro ao autenticar com a Serpro');
  }

  const payload = await response.json();
  console.info('[mei-guide] Serpro token ok', {
    hasAccessToken: Boolean(payload?.access_token),
    hasJwtToken: Boolean(payload?.jwt_token),
    expiresIn: payload?.expires_in
  });
  const expiresIn = Number(payload?.expires_in || 0);
  const accessToken = payload?.access_token || null;
  const jwtToken = payload?.jwt_token || null;

  tokenCache.set(context.cacheKey, {
    accessToken,
    jwtToken,
    expiresAt: now + (expiresIn * 1000)
  });

  if (!accessToken) {
    throw badRequest('Token Serpro não retornado');
  }

  return { accessToken, jwtToken };
};

const getAutenticaProcuradorUrl = () => {
  if (env.SERPRO_AUTENTICA_PROCURADOR_URL) return env.SERPRO_AUTENTICA_PROCURADOR_URL;
  if (env.SERPRO_AUTENTICA_PROCURADOR_PATH) {
    return `${getBaseUrl()}${env.SERPRO_AUTENTICA_PROCURADOR_PATH}`;
  }
  return '';
};

/**
 * Tag XML `<destinatario papel="contratante">` — NI deve ser o mesmo `contratante` do JSON Apoiar
 * (erro AUTENTICAPROCURADOR-012 se divergir de SERPRO_CONTRATANTE_NUMERO).
 */
const resolveTermoDestinatario = () => {
  const numero = normalizeDoc(env.SERPRO_CONTRATANTE_NUMERO);
  const nome = String(env.SERPRO_CONTRATANTE_NOME || '').trim();
  const tipo =
    getDocTypeLabel(env.SERPRO_CONTRATANTE_TIPO || numero) || env.SERPRO_DESTINATARIO_TIPO || 'PJ';
  return { numero, nome, tipo };
};

const getAutenticaProcuradorCacheKey = (userId, authContext) => {
  const autor = authContext?.autorPedidoDados || {};
  const contribuinte = authContext?.contribuinte || {};
  const autorTipo = normalizeDocTypeNumber(autor.tipo, autor.numero);
  const contribTipo = normalizeDocTypeNumber(contribuinte.tipo, contribuinte.numero);
  const dest = resolveTermoDestinatario();
  return [
    `autor:${normalizeDoc(autor.numero || '')}:${autorTipo || ''}`,
    `contribuinte:${normalizeDoc(contribuinte.numero || '')}:${contribTipo || ''}`,
    `destinatario:${dest.numero || ''}:${dest.tipo || ''}`
  ].join('|');
};

const getNextMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(now.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
};

const AUTORIZACAO_TERMO = 'Autorizo a empresa CONTRATANTE, identificada neste termo de autorização como DESTINATÁRIO, a executar as requisições dos serviços web disponibilizados pela API INTEGRA CONTADOR, onde terei o papel de AUTOR PEDIDO DE DADOS no corpo da mensagem enviada na requisição do serviço web. Esse termo de autorização está assinado digitalmente com o certificado digital do PROCURADOR ou OUTORGADO DO CONTRIBUINTE responsável, identificado como AUTOR DO PEDIDO DE DADOS.';
const AUTORIZACAO_AVISO = 'O acesso a estas informações foi autorizado pelo próprio PROCURADOR ou OUTORGADO DO CONTRIBUINTE, responsável pela informação, via assinatura digital. É dever do destinatário da autorização e consumidor deste acesso observar a adoção de base legal para o tratamento dos dados recebidos conforme artigos 7º ou 11º da LGPD (Lei n.º 13.709, de 14 de agosto de 2018), aos direitos do titular dos dados (art. 9º, 17 e 18, da LGPD) e aos princípios que norteiam todos os tratamentos de dados no Brasil (art. 6º, da LGPD).';
const AUTORIZACAO_FINALIDADE = 'A finalidade única e exclusiva desse TERMO DE AUTORIZAÇÃO, é garantir que o CONTRATANTE apresente a API INTEGRA CONTADOR esse consentimento do PROCURADOR ou OUTORGADO DO CONTRIBUINTE assinado digitalmente, para que possa realizar as requisições dos serviços web da API INTEGRA CONTADOR em nome do AUTOR PEDIDO DE DADOS (PROCURADOR ou OUTORGADO DO CONTRIBUINTE).';

const buildAutorizacaoXml = (authContext, options = {}) => {
  const autor = authContext?.autorPedidoDados || {};
  const autorNumero = normalizeDoc(
    autor.numero || env.SERPRO_AUTOR_NUMERO || env.SERPRO_CONTRATANTE_NUMERO
  );
  const autorTipo = getDocTypeLabel(
    autor.tipo || env.SERPRO_AUTOR_TIPO || env.SERPRO_CONTRATANTE_TIPO || autorNumero
  );

  const { numero: destinatarioNumero, nome: destinatarioNome, tipo: destinatarioTipo } =
    resolveTermoDestinatario();
  const assinadoPorNome =
    options.assinadoPorNome || env.SERPRO_ASSINADO_POR_NOME || '';

  if (!destinatarioNumero) {
    throw badRequest('SERPRO_CONTRATANTE_NUMERO não configurado para o termo de autorização');
  }
  if (!destinatarioNome) {
    throw badRequest(
      'SERPRO_CONTRATANTE_NOME não configurado (razão social do CNPJ contratante no XML do termo)'
    );
  }
  if (!assinadoPorNome) {
    throw badRequest('Nome do assinante não configurado para autenticação do procurador');
  }
  if (!autorNumero || !autorTipo) {
    throw badRequest('Autor do pedido não configurado');
  }
  const dataAssinatura = formatDateYYYYMMDD(new Date());
  const vigencia = env.SERPRO_AUTORIZACAO_VIGENCIA
    ? String(env.SERPRO_AUTORIZACAO_VIGENCIA)
    : formatDateYYYYMMDD(addDays(new Date(), Number(env.SERPRO_AUTORIZACAO_VIGENCIA_DIAS || 180)));

  if (env.SERPRO_AUTENTICA_PROCURADOR_XML_TEMPLATE) {
    return env.SERPRO_AUTENTICA_PROCURADOR_XML_TEMPLATE
      .replace(/\{\{DESTINATARIO_NUMERO\}\}/g, destinatarioNumero)
      .replace(/\{\{DESTINATARIO_NOME\}\}/g, escapeXmlAttr(destinatarioNome))
      .replace(/\{\{DESTINATARIO_TIPO\}\}/g, destinatarioTipo)
      .replace(/\{\{AUTOR_NUMERO\}\}/g, autorNumero)
      .replace(/\{\{AUTOR_TIPO\}\}/g, autorTipo)
      .replace(/\{\{ASSINADO_POR_NOME\}\}/g, escapeXmlAttr(assinadoPorNome))
      .replace(/\{\{DATA_ASSINATURA\}\}/g, dataAssinatura)
      .replace(/\{\{VIGENCIA\}\}/g, vigencia)
      .replace(/\{\{TERMO\}\}/g, escapeXmlAttr(AUTORIZACAO_TERMO))
      .replace(/\{\{AVISO\}\}/g, escapeXmlAttr(AUTORIZACAO_AVISO))
      .replace(/\{\{FINALIDADE\}\}/g, escapeXmlAttr(AUTORIZACAO_FINALIDADE));
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<termoDeAutorizacao>',
    '  <dados>',
    '    <sistema id="API Integra Contador" />',
    `    <termo texto="${escapeXmlAttr(AUTORIZACAO_TERMO)}" />`,
    `    <avisoLegal texto="${escapeXmlAttr(AUTORIZACAO_AVISO)}" />`,
    `    <finalidade texto="${escapeXmlAttr(AUTORIZACAO_FINALIDADE)}" />`,
    `    <dataAssinatura data="${dataAssinatura}"/>`,
    `    <vigencia data="${vigencia}"/>`,
    `    <destinatario numero="${destinatarioNumero}" nome="${escapeXmlAttr(destinatarioNome)}" tipo="${destinatarioTipo}" papel="contratante"/>`,
    `    <assinadoPor numero="${autorNumero}" nome="${escapeXmlAttr(assinadoPorNome)}" tipo="${autorTipo}" papel="autor pedido de dados"/>`,
    '  </dados>',
    '</termoDeAutorizacao>'
  ].join('');
};

export const MEI_CERT_INVALID_PASSWORD = 'MEI_CERT_INVALID_PASSWORD';

const isInvalidPfxPasswordError = (error) => {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('mac could not be verified') ||
    msg.includes('mac verify failure') ||
    msg.includes('invalid password') ||
    msg.includes('password may be incorrect') ||
    msg.includes('unable to decrypt')
  );
};

const extractPfxKeyAndCert = (pfxBuffer, passphrase) => {
  const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'));
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, passphrase || '');
  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBagsPlain = pfx.getBags({ bagType: forge.pki.oids.keyBag });
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    || keyBagsPlain[forge.pki.oids.keyBag]?.[0];
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!keyBag?.key || !certBag?.cert) {
    throw badRequest('Não foi possível extrair chave/certificado do PFX');
  }
  const certInfo = extractCertInfo(certBag.cert);
  if (env.NODE_ENV !== 'production') {
    console.info('[mei-guide] Cert subject/serial', {
      subject: certInfo.subject,
      serialNumber: certInfo.serialNumber,
      cnpjFromSan: certInfo.cnpjFromSan,
      cnpjFromSubject: certInfo.cnpjFromSubject,
      cnpjFromCN: certInfo.cnpjFromCN,
      docSource: certInfo.docSource
    });
  }
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    certificatePem: forge.pki.certificateToPem(certBag.cert),
    certInfo
  };
};

const signAutorizacaoXml = (xml, pfxBuffer, passphrase) => {
  const { privateKeyPem, certificatePem } = extractPfxKeyAndCert(pfxBuffer, passphrase);
  const x509B64 = certificatePem.replace(/-----(BEGIN|END) CERTIFICATE-----|\s+/g, '');
  const xmlCompact = String(xml || '').replace(/>\s+</g, '><').trim();
  const sig = new SignedXml();
  sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  // Serpro/eSocial: Reference URI="" (documento inteiro), não URI="#_0".
  sig.addReference({
    xpath: '/*',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    isEmptyUri: true
  });
  sig.privateKey = privateKeyPem;
  // xml-crypto v6: getKeyInfoContent (não usar keyInfoProvider legado + publicCert — duplica X509Data).
  sig.getKeyInfoContent = () =>
    `<X509Data><X509Certificate>${x509B64}</X509Certificate></X509Data>`;
  sig.computeSignature(xmlCompact, {
    location: { reference: '/*', action: 'append' }
  });
  const signed = sig.getSignedXml();
  if (env.NODE_ENV !== 'production') {
    const x509DataCount = (signed.match(/<(?:\w+:)?X509Data\b/gi) || []).length;
    const keyInfoCount = (signed.match(/<(?:\w+:)?KeyInfo\b/gi) || []).length;
    if (!/<Reference[^>]*URI=""/.test(signed)) {
      console.warn('[mei-guide] Assinatura XML sem Reference URI="" — Serpro pode rejeitar');
    }
    if (x509DataCount !== 1 || keyInfoCount !== 1) {
      console.warn('[mei-guide] Assinatura XML KeyInfo/X509Data', { keyInfoCount, x509DataCount });
    }
  }
  return signed;
};

const fetchAutenticaProcuradorTokenOnce = async (userId, authContext) => {
  const url = getAutenticaProcuradorUrl();
  if (!url) {
    throw badRequest('Endpoint Autentica Procurador não configurado');
  }

  const context = getProcuradorContext(userId);
  if (context.source !== 'user' || !context.cert?.pfx) {
    throw badRequest('Certificado do cliente não configurado para o procurador');
  }
  const contrib = authContext?.contribuinte || {};
  const resolvedAuthContext = {
    ...(authContext || {}),
    contribuinte: contrib,
    autorPedidoDados: authContext?.autorPedidoDados ?? contrib
  };

  const cacheKey = getAutenticaProcuradorCacheKey(userId, resolvedAuthContext);
  const cached = procuradorTokenCache.get(cacheKey);
  const now = Date.now();
  if (cached?.token && cached?.expiresAt > now + 60000) {
    return cached.token;
  }

  const pfx = context.cert.pfx;
  const passphrase = context.cert.passphrase;

  if (!pfx) {
    throw badRequest('Certificado Serpro não configurado para o procurador');
  }

  const assinadoPorNomeCert = context.cert?.certInfo?.holderName || '';
  const xml = buildAutorizacaoXml(resolvedAuthContext, {
    assinadoPorNome: assinadoPorNomeCert || undefined
  });
  const signedXml = signAutorizacaoXml(xml, pfx, passphrase);
  const encoded = Buffer.from(signedXml, 'utf-8').toString('base64');

  const autor = resolvedAuthContext?.autorPedidoDados || {};
  const autorNumero = normalizeDoc(autor.numero);
  const contribNumero = normalizeDoc(contrib.numero);

  if (!validateDoc(autorNumero)) {
    throw badRequest('Autor do pedido inválido');
  }
  if (!validateDoc(contribNumero)) {
    throw badRequest('Contribuinte inválido');
  }

  const contratanteNumero = normalizeDoc(env.SERPRO_CONTRATANTE_NUMERO || contribNumero);
  const contratanteTipo = normalizeDocTypeNumber(env.SERPRO_CONTRATANTE_TIPO, contratanteNumero);
  const autorTipo = normalizeDocTypeNumber(autor.tipo, autorNumero);
  const contribTipo = normalizeDocTypeNumber(contrib.tipo, contribNumero);
  if (!contratanteTipo) {
    throw badRequest('Tipo do contratante inválido');
  }
  if (!autorTipo) {
    throw badRequest('Tipo do autor do pedido inválido');
  }
  if (!contribTipo) {
    throw badRequest('Tipo do contribuinte inválido');
  }
  const requestBody = {
    contratante: {
      numero: contratanteNumero,
      tipo: contratanteTipo
    },
    autorPedidoDados: {
      numero: autorNumero,
      tipo: autorTipo
    },
    contribuinte: {
      numero: contribNumero,
      tipo: contribTipo
    },
    pedidoDados: {
      idSistema: 'AUTENTICAPROCURADOR',
      idServico: 'ENVIOXMLASSINADO81',
      versaoSistema: '1.0',
      dados: JSON.stringify({ xml: encoded })
    }
  };

  if (env.NODE_ENV !== 'production') {
    const termoDest = resolveTermoDestinatario();
    const contratanteJson = normalizeDoc(requestBody.contratante?.numero || '');
    console.info('[mei-guide] AutenticaProcurador payload', {
      contratante: requestBody.contratante,
      autorPedidoDados: requestBody.autorPedidoDados,
      contribuinte: requestBody.contribuinte,
      destinatarioXmlContratante: termoDest.numero,
      destinatarioXmlNome: termoDest.nome ? `${termoDest.nome.slice(0, 40)}…` : '(vazio)',
      contratanteAlinhado: contratanteJson === termoDest.numero,
      assinadoPorNome: assinadoPorNomeCert || env.SERPRO_ASSINADO_POR_NOME || '(env)',
      pedidoDados: {
        idSistema: requestBody.pedidoDados.idSistema,
        idServico: requestBody.pedidoDados.idServico,
        versaoSistema: requestBody.pedidoDados.versaoSistema,
        xmlSize: encoded.length
      }
    });
  }

  const headers = await buildHeaders(userId, null);
  const tlsConfig = isNoMtlsEnabled() ? null : getOauthTlsConfig();
  const response = await requestWithOptionalMtls(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  }, tlsConfig);

  const persistProcuradorToken = async (token) => {
    procuradorTokenCache.set(cacheKey, {
      token,
      expiresAt: getNextMidnight()
    });
    const autorCacheKey = normalizeDoc(resolvedAuthContext?.autorPedidoDados?.numero);
    if (autorCacheKey) {
      const { armazenarTokenNoCache } = await import('./gestao/authProcurador.service.js');
      armazenarTokenNoCache(`procurador_token_${autorCacheKey}`, token);
    }
    return token;
  };

  const getTokenFromEtagHeader = (etagValue) => {
    if (!etagValue) return null;
    const cleaned = String(etagValue).replace(/"/g, '');
    if (cleaned.startsWith('autenticar_procurador_token:')) {
      return cleaned.split(':')[1] || null;
    }
    return null;
  };

  const resolveTokenFromEtagOrCache = async () => {
    const etagToken = getTokenFromEtagHeader(response.headers.get('etag'));
    if (etagToken) return etagToken;
    const { obterTokenProcurador } = await import('./gestao/authProcurador.service.js');
    const legado = obterTokenProcurador(autorNumero);
    if (legado) return legado;
    const cached = procuradorTokenCache.get(cacheKey);
    if (cached?.token && cached.expiresAt > Date.now() + 60000) {
      return cached.token;
    }
    return null;
  };

  /** 304 = termo já aceito; token vem no ETag ou no cache (mesmo fluxo do auth-procurador). */
  if (response.status === 304) {
    const token = await resolveTokenFromEtagOrCache();
    if (!token) {
      throw badRequest(
        'Termo já aceito pela SERPRO (304), mas o token não foi encontrado. Clique em Atualizar lista novamente.'
      );
    }
    if (env.NODE_ENV !== 'production') {
      console.info('[mei-guide] AutenticaProcurador 304 — token reutilizado (ETag/cache)');
    }
    return persistProcuradorToken(token);
  }

  if (!response.ok) {
    const { message, bodyRaw } = await parseSerproErrorResponse(response);
    if (env.NODE_ENV !== 'production') {
      console.warn('[mei-guide] AutenticaProcurador error', {
        status: response.status,
        url,
        contentType: response.headers.get('content-type') || '',
        message,
        mensagens: typeof bodyRaw === 'object' ? bodyRaw?.mensagens : null,
        responseId: typeof bodyRaw === 'object' ? bodyRaw?.responseId : null
      });
    }
    logSerproError('autentica-procurador', {
      status: response.status,
      url,
      message
    });
    const hint =
      response.status === 403
        ? 'Termo recusado (403). O CNPJ em <destinatario papel="contratante"> deve ser SERPRO_CONTRATANTE_NUMERO (e SERPRO_CONTRATANTE_NOME). URI="" na assinatura, um X509Data (EndCertOnly), certificado A1 do contribuinte em assinadoPor.'
        : '';
    throw badRequest(
      [message || 'Erro ao autenticar termo de autorização', hint].filter(Boolean).join(' ')
    );
  }

  const etagToken = getTokenFromEtagHeader(response.headers.get('etag'));
  if (etagToken) {
    return persistProcuradorToken(etagToken);
  }

  const responseText = await readHttpResponseText(response);
  const payload = parseJsonFromResponseText(responseText);
  if (!payload) {
    throw badRequest(
      `SERPRO retornou resposta vazia no termo de autorização (HTTP ${response.status}). Aguarde alguns segundos e clique em Atualizar lista.`
    );
  }
  const parsedDados = (() => {
    if (!payload?.dados) return null;
    if (Array.isArray(payload.dados)) return payload.dados[0] || null;
    if (typeof payload.dados === 'object') return payload.dados;
    try {
      return JSON.parse(String(payload.dados));
    } catch {
      return null;
    }
  })();
  const token = parsedDados?.autenticar_procurador_token
    || parsedDados?.autenticarProcuradorToken
    || payload?.autenticar_procurador_token
    || payload?.autenticarProcuradorToken
    || payload?.token
    || payload?.access_token
    || null;

  if (!token) {
    throw badRequest('Token do procurador não retornado');
  }

  return persistProcuradorToken(token);
};

const getAutenticaProcuradorToken = async (userId, authContext) => {
  const contrib = authContext?.contribuinte || {};
  const cacheKey = getAutenticaProcuradorCacheKey(userId, {
    ...(authContext || {}),
    contribuinte: contrib,
    autorPedidoDados: authContext?.autorPedidoDados ?? contrib
  });
  const inflight = procuradorTokenInFlight.get(cacheKey);
  if (inflight) return inflight;

  const promise = fetchAutenticaProcuradorTokenOnce(userId, authContext);
  procuradorTokenInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    procuradorTokenInFlight.delete(cacheKey);
  }
};

const getSerproTokenWithoutCert = async () => {
  ensureTokenConfigured();

  const credentials = Buffer.from(`${env.SERPRO_CONSUMER_KEY}:${env.SERPRO_CONSUMER_SECRET}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'client_credentials' }).toString();

  const response = await fetch(env.SERPRO_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Role-Type': env.SERPRO_ROLE_TYPE
    },
    body
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw badRequest(message || 'Erro ao autenticar com a Serpro');
  }

  const payload = await response.json();
  const accessToken = payload?.access_token || null;
  const jwtToken = payload?.jwt_token || null;

  if (!accessToken) {
    throw badRequest('Token Serpro não retornado');
  }

  return { accessToken, jwtToken };
};

/** Termo Integra Contador (ex.: ICGERENCIADOR-019 quando autor ≠ contratante). */
export const obterAutenticaProcuradorTokenSerpro = async (userId, params = {}) => {
  const contribNumero = normalizeDoc(params.contribuinteNumero);
  const autorNumero = normalizeDoc(params.autorPedidoNumero ?? contribNumero);
  if (!userId || !contribNumero || !validateDoc(contribNumero)) {
    throw badRequest('Dados inválidos para termo de autorização Serpro');
  }
  if (!validateDoc(autorNumero)) {
    throw badRequest('Autor do pedido inválido para termo Serpro');
  }
  const contribTipo =
    normalizeDocTypeNumber(params.contribuinteTipo, contribNumero) || getDocType(contribNumero);
  const autorTipo =
    normalizeDocTypeNumber(params.autorTipo, autorNumero) || getDocType(autorNumero);
  return getAutenticaProcuradorToken(userId, {
    contribuinte: { numero: contribNumero, tipo: contribTipo },
    autorPedidoDados: { numero: autorNumero, tipo: autorTipo }
  });
};

const buildHeaders = async (userId, authContext) => {
  const useNoMtls = isNoMtlsEnabled();
  const { accessToken, jwtToken } = useNoMtls
    ? await getSerproTokenWithoutCert()
    : await getSerproToken(userId);
  const procuradorToken = authContext
    ? await getAutenticaProcuradorToken(userId, authContext)
    : null;
  if (env.NODE_ENV !== 'production') {
    console.info('[mei-guide] SERPRO_ROLE_TYPE', env.SERPRO_ROLE_TYPE);
  }
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    ...(jwtToken ? { jwt_token: jwtToken } : {}),
    ...(procuradorToken ? { autenticar_procurador_token: procuradorToken } : {}),
    'Role-Type': env.SERPRO_ROLE_TYPE
  };
};

const withTimeout = (ms) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
};

const getBaseUrl = () => normalizeBaseUrl(env.SERPRO_API_BASE_URL || '');

const buildCreateUrl = () => `${getBaseUrl()}${env.MEI_API_CREATE_PATH}`;

const buildDownloadUrl = (id) => {
  const path = env.MEI_API_DOWNLOAD_PATH.replace('{id}', encodeURIComponent(id));
  return `${getBaseUrl()}${path}`;
};

const readHttpResponseText = async (response) => {
  try {
    return String(await response.text());
  } catch {
    return '';
  }
};

const parseJsonFromResponseText = (text) => {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const extractSerproMessageFromPayload = (payload, statusText = '') => {
  if (payload == null) return statusText || '';
  if (typeof payload === 'string') return payload.trim() || statusText || '';
  let mensagemSerpro = '';
  const m = payload.mensagens;
  if (Array.isArray(m) && m.length > 0) {
    mensagemSerpro = m
      .map((item) =>
        typeof item === 'string' ? item : (item?.texto ?? item?.mensagem ?? item?.descricao ?? '')
      )
      .filter(Boolean)
      .join(' ')
      .trim();
  } else if (typeof m === 'string') {
    mensagemSerpro = (m || '').trim();
  }
  return payload.message || payload.error || mensagemSerpro || statusText || '';
};

const parseSerproErrorResponse = async (response) => {
  const text = await readHttpResponseText(response);
  const bodyRaw = parseJsonFromResponseText(text);
  const status = response.status || 0;
  const message =
    extractSerproMessageFromPayload(bodyRaw, response.statusText) ||
    text.trim() ||
    response.statusText ||
    (status ? `Erro HTTP ${status} na SERPRO` : 'Erro na SERPRO');
  return { message, bodyRaw: bodyRaw ?? text };
};

const parseErrorMessage = async (response) => {
  const { message } = await parseSerproErrorResponse(response);
  return message;
};

const logSerproError = (context, { status, url, message }) => {
  if (env.NODE_ENV === 'production') return;
  console.warn('[mei-guide] Serpro error', {
    context,
    status,
    url,
    message
  });
};

const requestJson = async (url, body, userId, authContext) => {
  const timeoutMs = Number(env.MEI_API_TIMEOUT_MS || 15000);
  const { controller, timeout } = withTimeout(timeoutMs);

  try {
    const headers = await buildHeaders(userId, authContext);
    const tlsConfig = isNoMtlsEnabled() ? null : getOauthTlsConfig();
    const response = await requestWithOptionalMtls(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    }, tlsConfig);

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      logSerproError('request-json', {
        status: response.status,
        url,
        message
      });
      if (response.status === 401) {
        throw unauthorized(message || 'Não autorizado pela Serpro');
      }
      if (response.status === 403) {
        throw forbidden(message || 'Acesso negado pela Serpro');
      }
      throw badRequest(message || 'Erro ao gerar guia MEI');
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const requestGetJson = async (url, userId, authContext) => {
  const timeoutMs = Number(env.MEI_API_TIMEOUT_MS || 15000);
  const { controller, timeout } = withTimeout(timeoutMs);

  try {
    const headers = await buildHeaders(userId, authContext);
    const tlsConfig = isNoMtlsEnabled() ? null : getOauthTlsConfig();
    const response = await requestWithOptionalMtls(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    }, tlsConfig);

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      logSerproError('request-get-json', {
        status: response.status,
        url,
        message
      });
      if (response.status === 401) {
        throw unauthorized(message || 'Não autorizado pela Serpro');
      }
      if (response.status === 403) {
        throw forbidden(message || 'Acesso negado pela Serpro');
      }
      throw badRequest(message || 'Erro ao consultar períodos MEI');
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const requestDownload = async (url, userId, authContext) => {
  const timeoutMs = Number(env.MEI_API_TIMEOUT_MS || 15000);
  const { controller, timeout } = withTimeout(timeoutMs);

  try {
    const headers = await buildHeaders(userId, authContext);
    const tlsConfig = isNoMtlsEnabled() ? null : getOauthTlsConfig();
    const response = await requestWithOptionalMtls(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    }, tlsConfig);

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      logSerproError('request-download', {
        status: response.status,
        url,
        message
      });
      if (response.status === 401) {
        throw unauthorized(message || 'Não autorizado pela Serpro');
      }
      if (response.status === 403) {
        throw forbidden(message || 'Acesso negado pela Serpro');
      }
      throw notFound(message || 'Guia MEI não encontrada');
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: contentType || 'application/pdf',
      filename: `guia-mei-${Date.now()}.pdf`
    };
  } finally {
    clearTimeout(timeout);
  }
};

const ensureDownloadBuffer = async (payload, userId, authContext) => {
  if (payload?.buffer) {
    return payload;
  }

  if (payload?.pdfBase64) {
    return {
      buffer: Buffer.from(payload.pdfBase64, 'base64'),
      contentType: payload.contentType || 'application/pdf',
      filename: payload.filename || `guia-mei-${Date.now()}.pdf`
    };
  }

  if (payload?.downloadUrl) {
    return await requestDownload(payload.downloadUrl, userId, authContext);
  }

  throw notFound('Arquivo da guia MEI não disponível');
};

const parseSerproDados = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
};

const resolveContribuinte = (userId, contrib, cnpj) => {
  const fromRequest = normalizeDoc(contrib?.numero || cnpj);
  const fromCert = getUserCertDocument(userId);
  const numero = fromRequest || fromCert;
  if (!numero) {
    throw badRequest('Documento do certificado não identificado');
  }
  if (!validateDoc(numero)) {
    throw badRequest('Contribuinte inválido');
  }
  const tipo = normalizeDocTypeNumber(contrib?.tipo, numero) || getDocType(numero);
  return { numero, tipo };
};

/**
 * Extrai objeto emitente NFS-e de body multipart/JSON (campos opcionais).
 */
const parseEmitenteFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const keys = [
    'razaoSocial', 'nomeFantasia', 'email', 'inscricaoMunicipal', 'regimeTributario',
    'cep', 'tipoLogradouro', 'logradouro', 'numero', 'complemento', 'bairro',
    'codigoCidade', 'descricaoCidade', 'estado', 'simplesNacional'
  ];
  const has = keys.some((k) => {
    const v = payload[k];
    if (v === undefined || v === null) return false;
    if (typeof v === 'boolean') return true;
    return String(v).trim() !== '';
  });
  if (!has) return null;
  return {
    razaoSocial: payload.razaoSocial,
    nomeFantasia: payload.nomeFantasia,
    email: payload.email,
    inscricaoMunicipal: payload.inscricaoMunicipal,
    regimeTributario: payload.regimeTributario,
    cep: payload.cep,
    tipoLogradouro: payload.tipoLogradouro,
    logradouro: payload.logradouro,
    numero: payload.numero,
    complemento: payload.complemento,
    bairro: payload.bairro,
    ibgeMunicipio: payload.codigoCidade,
    cidade: payload.descricaoCidade,
    uf: payload.estado,
    optanteSimplesNacional: payload.simplesNacional
  };
};

export const uploadCertificate = async (userId, payload) => {
  if (!userId) {
    throw badRequest('Usuário não identificado');
  }
  clearUserCaches(userId);
  const file = payload?.file;
  const password = String(payload?.password || '');
  if (!file?.buffer) {
    throw badRequest('Arquivo de certificado não informado');
  }
  if (!password) {
    throw badRequest('Senha do certificado é obrigatória');
  }
  let certInfo;
  try {
    const extracted = extractPfxKeyAndCert(file.buffer, password);
    certInfo = extracted?.certInfo || null;
  } catch (error) {
    if (isInvalidPfxPasswordError(error)) {
      throw badRequest('A senha do certificado está inválida.', {
        code: MEI_CERT_INVALID_PASSWORD
      });
    }
    throw badRequest('Certificado inválido ou senha incorreta');
  }

  const emitente = parseEmitenteFromPayload(payload);

  const certDocument = certInfo?.doc ? normalizeDoc(certInfo.doc) : null;

  await assertMeiCertificateEligible(certDocument);

  let previousCertDocument = null;
  if (certDocument) {
    try {
      previousCertDocument = await getCertificateDocument(userId);
    } catch {
      previousCertDocument = null;
    }
  }

  if (env.MEI_CERT_ENCRYPTION_KEY) {
    try {
      const { passphraseEnc, passphraseIv } = encryptPassphrase(password);
      await saveCertificate(userId, {
        pfxBase64: file.buffer.toString('base64'),
        passphraseEnc,
        passphraseIv,
        certDocument,
        certValidFrom: certInfo?.validFrom ?? null,
        certValidTo: certInfo?.validTo ?? null,
        ...(emitente ? { emitente } : {})
      });
    } catch (err) {
      throw badRequest(err?.message || 'Falha ao salvar certificado');
    }
  }

  if (certDocument) {
    try {
      await syncEmitenteMirrorAfterCertificateUpload(userId, {
        certDocument,
        certInfo,
        previousDoc: previousCertDocument,
        payloadEmitente: emitente
      });
    } catch (syncErr) {
      console.warn('[mei-guide.uploadCertificate] sync emitente pós-certificado (não-fatal)', {
        userId,
        error: syncErr instanceof Error ? syncErr.message : String(syncErr)
      });
    }
  }

  setUserCert(userId, {
    pfx: file.buffer,
    passphrase: password,
    certInfo
  });

  // Integração com PlugNotas: best-effort, não interrompe o upload se falhar.
  // 1) Tenta resolver cert_id já existente no PlugNotas por CNPJ.
  // 2) Se não achou, faz upload do .pfx para o PlugNotas.
  // 3) Salva o cert_id retornado em user_mei_certificates.plugnotas_cert_id.
  let plugnotasIntegration = { status: 'skipped', reason: 'no_cnpj_in_cert' };
  if (certDocument && certDocument.length === 14) {
    try {
      let plugnotasCertId = await resolverCertificadoIdPorCnpj(certDocument);
      let source = plugnotasCertId ? 'resolved_existing' : null;

      if (!plugnotasCertId) {
        const result = await cadastrarCertificadoPlugNotas({
          fileBuffer: file.buffer,
          fileName: 'certificado.pfx',
          mimeType: 'application/x-pkcs12',
          password,
          cpfCnpj: certDocument
        });
        if (typeof result?.id === 'string' && result.id) {
          plugnotasCertId = result.id;
          source = 'uploaded_new';
        }
      }

      if (plugnotasCertId) {
        await savePlugNotasCertId(userId, plugnotasCertId);
        plugnotasIntegration = { status: 'ok', source, certId: plugnotasCertId };
      } else {
        plugnotasIntegration = { status: 'failed', reason: 'no_id_returned' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[mei-guide.uploadCertificate] PlugNotas integration falhou (não-fatal)', {
        userId,
        cnpj14: certDocument,
        error: msg
      });
      plugnotasIntegration = { status: 'failed', reason: msg };
    }
  }

  const status = await getCertificateStatus(userId);
  return { ...status, plugnotasIntegration };
};

/**
 * PATCH só dados fiscais/endereço NFS-e (sem novo certificado).
 */
export const patchCertificateEmitenteNfse = async (userId, body) => {
  if (!userId) throw badRequest('Usuário não identificado');
  await patchEmitenteNfseFields(userId, body || {});
  return getCertificateStatus(userId);
};

export const removeCertificate = async (userId) => {
  if (!userId) {
    throw badRequest('Usuário não identificado');
  }

  // Só exclui no PlugNotas se NENHUM outro usuário ainda apontar para o mesmo
  // certificado (evita derrubar o cert de quem compartilha o mesmo .pfx/CNPJ).
  const plugnotasCertId = await getPlugNotasCertId(userId).catch(() => null);
  if (plugnotasCertId) {
    let onlyThisUser = false;
    try {
      const others = await countOtherUsersWithPlugnotasCertId(userId, plugnotasCertId);
      onlyThisUser = others === 0;
    } catch {
      onlyThisUser = false; // em dúvida, não apaga no PlugNotas
    }
    if (onlyThisUser) {
      try {
        await excluirCertificadoPlugNotas(plugnotasCertId);
      } catch (err) {
        // best-effort: não bloqueia a remoção local
        // eslint-disable-next-line no-console
        console.warn('[mei-guide.removeCertificate] falha ao excluir certificado no PlugNotas (não-fatal)', {
          userId,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }

  if (env.MEI_CERT_ENCRYPTION_KEY) {
    await deleteCertificate(userId);
  }
  clearUserCaches(userId);
  return getCertificateStatus(userId);
};

/** Status do certificado MEI; `nfseEmitente` segue o typedef `NfseEmitenteApiSnapshot` em `mei-certificate-store.js`. */
export const getCertificateStatus = async (userId) => {
  await ensureUserCertLoaded(userId);
  const userCert = getUserCert(userId);
  const docFromCache = getUserCertDocument(userId);
  let docFromDb = null;
  let certValidFromDb = null;
  let certValidToDb = null;
  try {
    docFromDb = await getCertificateDocument(userId);
  } catch {
    docFromDb = null;
  }
  try {
    const meta = await getCertificateValidity(userId);
    if (meta) {
      certValidFromDb = meta.certValidFrom ?? null;
      certValidToDb = meta.certValidTo ?? null;
    }
  } catch {
    // Colunas cert_valid_* podem não existir antes da migration
  }
  const certValidFrom = userCert?.certInfo?.validFrom ?? certValidFromDb ?? null;
  const certValidTo = userCert?.certInfo?.validTo ?? certValidToDb ?? null;
  let nfseEmitente = null;
  try {
    nfseEmitente = await getEmitenteNfseSnapshot(userId);
  } catch {
    nfseEmitente = null;
  }
  let documentosAtivos = null;
  try {
    documentosAtivos = await getDocumentosAtivosMirror(userId);
  } catch {
    documentosAtivos = null;
  }
  const docResolved = docFromCache || docFromDb || null;
  const hasCert = Boolean(userCert);
  return {
    hasUserCertificate: hasCert,
    hasEnvCertificate: Boolean(env.SERPRO_CERT_PFX_BASE64),
    documento: docResolved,
    certValidFrom: certValidFrom || null,
    certValidTo: certValidTo || null,
    nfseEmitente,
    documentosAtivos
  };
};

export const getSerproTokenForFrontend = async () => {
  const { accessToken, jwtToken } = await getSerproTokenWithoutCert();
  return {
    accessToken,
    jwtToken,
    roleType: env.SERPRO_ROLE_TYPE,
    apiBaseUrl: env.SERPRO_API_BASE_URL,
    createPath: env.MEI_API_CREATE_PATH,
    periodsPath: env.MEI_API_PERIODS_PATH
  };
};

const looksLikePdfBase64 = (value) => {
  const text = String(value || '').trim();
  if (text.length < 80) return null;
  if (!/^%PDF/i.test(text) && !/^[A-Za-z0-9+/=\r\n]+$/.test(text.slice(0, 120))) return null;
  return text;
};

const findPdfBase64Deep = (value, depth = 0) => {
  if (!value || depth > 8) return null;
  if (typeof value === 'string') return looksLikePdfBase64(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPdfBase64Deep(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object') return null;
  for (const key of [
    'docArrecadacaoPdfB64',
    'doc_arrecadacao_pdf_b64',
    'pdf',
    'PDF',
    'pdfBase64',
    'arquivo',
    'guia',
    'das',
    'documento'
  ]) {
    const found = looksLikePdfBase64(value[key]);
    if (found) return found;
  }
  for (const nested of Object.values(value)) {
    const found = findPdfBase64Deep(nested, depth + 1);
    if (found) return found;
  }
  return null;
};

const extractDasPdfBase64FromSerproResponse = (response) => {
  const dados = parseSerproDados(response?.dados);
  return (
    findPdfBase64Deep(dados)
    || findPdfBase64Deep(response?.raw)
    || findPdfBase64Deep(response)
    || null
  );
};

/** PDF já guardado (DAS_mei ou bucket) — não chama a Receita. */
const tryLoadLocalDasPdfBase64 = async (userId, period) => {
  if (!userId || !period) return null;
  const competencia = periodoApuracaoToCompetencia(period);
  try {
    const stored = await getDasBase64({ userId, periodoApuracao: period });
    if (stored && String(stored).trim()) return String(stored).trim();
  } catch {
    /* ignora */
  }
  const buffer = await downloadStoredDasPdfBuffer({
    userId,
    competencia,
    periodoApuracao: period
  });
  if (buffer?.length) return buffer.toString('base64');
  return null;
};

/** Emitir na SERPRO; se vier sem PDF, tenta Consultar (segunda via / período quitado). */
const fetchDasPdfFromSerpro = async ({
  userId = null,
  contratanteNumero,
  autorPedidoNumero,
  contribuinteNumero,
  periodoApuracao,
  contribuinteTipo = null,
  autorTipo = null
}) => {
  const period = normalizePeriodoApuracao(periodoApuracao);
  if (!period) {
    throw badRequest('Período de apuração inválido');
  }
  const competenciaLabel = competenciaLabelFromPeriod(period);
  const serproParams = {
    contratanteNumero,
    autorPedidoNumero,
    contribuinteNumero,
    idSistema: 'PGMEI',
    idServico: 'GERARDASPDF21',
    dados: { periodoApuracao: period },
    versaoSistema: '1.0',
    userId,
    contribuinteTipo,
    autorTipo
  };

  let lastError = null;
  try {
    const emitResponse = await emitirServico(serproParams);
    assertSerproDasPeriodoDisponivel(emitResponse, competenciaLabel);
    const pdfBase64 = extractDasPdfBase64FromSerproResponse(emitResponse);
    if (pdfBase64) {
      return { pdfBase64, period, status: emitResponse?.status || 'gerado' };
    }
    const serproHint = assertSerproDasPeriodoDisponivel(emitResponse, competenciaLabel);
    lastError = new Error(serproHint || 'PDF do DAS não retornado');
  } catch (error) {
    if (isPeriodoIndisponivelSerproError(error)) throw error;
    lastError = error;
  }

  try {
    const consultResponse = await consultarServico({
      contratanteNumero,
      autorPedidoNumero,
      contribuinteNumero,
      idSistema: serproParams.idSistema,
      idServico: serproParams.idServico,
      dados: serproParams.dados
    });
    assertSerproDasPeriodoDisponivel(consultResponse, competenciaLabel);
    const pdfBase64 = extractDasPdfBase64FromSerproResponse(consultResponse);
    if (pdfBase64) {
      return { pdfBase64, period, status: consultResponse?.status || 'consultado' };
    }
  } catch (error) {
    if (isPeriodoIndisponivelSerproError(error)) throw error;
    if (lastError) {
      if (shouldMarkCompetenciaAsPaid(lastError)) {
        throw paidPeriodNoPdfError();
      }
      throw lastError;
    }
    if (shouldMarkCompetenciaAsPaid(error)) {
      throw paidPeriodNoPdfError();
    }
    throw error;
  }

  if (lastError) {
    if (isPeriodoIndisponivelSerproMessage(String(lastError?.message || ''))) {
      throw periodoIndisponivelError(lastError.message, competenciaLabel);
    }
    if (shouldMarkCompetenciaAsPaid(lastError)) {
      throw paidPeriodNoPdfError();
    }
    throw badRequest(
      lastError?.message || 'A Receita Federal não devolveu o PDF do DAS para este período.'
    );
  }
  throw badRequest('A Receita Federal não devolveu o PDF do DAS para este período.');
};

const tryStoredDasPdfFile = async ({ userId, competencia, periodoApuracao, period }) => {
  const buffer = await downloadStoredDasPdfBuffer({
    userId,
    competencia,
    periodoApuracao: period || periodoApuracao
  });
  if (!buffer?.length) return null;
  const label = competencia ? competencia.replace('-', '/') : period;
  return {
    buffer,
    contentType: 'application/pdf',
    filename: label ? `DAS-${String(label).replace('/', '-')}.pdf` : `das-mei-${period}.pdf`
  };
};

/** Gera DAS MEI pelo CNPJ (fluxo contador/procurador), sem certificado do cliente. */
export const createGuideByCnpj = async (userId, payload) => {
  ensureConfigured();
  const { cnpj, periodoApuracao, mes, ano, skipLocalPdf = false } = payload || {};
  const cnpjNumerico = normalizeDoc(cnpj);
  if (!cnpjNumerico || !validateDoc(cnpjNumerico)) {
    throw badRequest('CNPJ do MEI inválido');
  }
  if (userId) {
    await saveCertificateDocument(userId, cnpjNumerico);
  }
  const contratanteNumero = normalizeDoc(env.SERPRO_CONTRATANTE_NUMERO);
  if (!contratanteNumero) {
    throw badRequest('Contratante Serpro não configurado');
  }

  const period = normalizePeriodoApuracao(periodoApuracao, mes, ano);
  if (!period) {
    throw badRequest('Período de apuração inválido');
  }

  const localPdf = !skipLocalPdf && userId ? await tryLoadLocalDasPdfBase64(userId, period) : null;
  if (localPdf) {
    return {
      id: period,
      status: 'armazenado',
      pdfBase64: localPdf,
      filename: `das-mei-${period}.pdf`,
      contentType: 'application/pdf'
    };
  }

  const { pdfBase64, status } = await fetchDasPdfFromSerpro({
    contratanteNumero,
    autorPedidoNumero: contratanteNumero,
    contribuinteNumero: cnpjNumerico,
    periodoApuracao: period
  });

  return {
    id: period,
    status,
    pdfBase64,
    filename: `das-mei-${period}.pdf`,
    contentType: 'application/pdf'
  };
};

export const createGuide = async (userId, payload) => {
  ensureConfigured();
  await ensureClientCertificate(userId);
  const { cnpj, periodoApuracao, mes, ano, contribuinte, skipLocalPdf = false } = payload || {};

  const contrib = resolveContribuinte(userId, contribuinte, cnpj);
  const autor = contrib;

  const autorNumero = normalizeDoc(autor?.numero);
  if (!validateDoc(autorNumero)) {
    throw badRequest('Autor do pedido inválido');
  }

  const period = normalizePeriodoApuracao(periodoApuracao, mes, ano);
  if (!period) {
    throw badRequest('Período de apuração inválido');
  }

  const localPdf = !skipLocalPdf ? await tryLoadLocalDasPdfBase64(userId, period) : null;
  if (localPdf) {
    return {
      id: period,
      status: 'armazenado',
      pdfBase64: localPdf,
      filename: `das-mei-${period}.pdf`,
      contentType: 'application/pdf'
    };
  }

  const cnpjNumerico = normalizeDoc(contrib.numero);
  const contratanteNumero = normalizeDoc(env.SERPRO_CONTRATANTE_NUMERO || cnpjNumerico);
  const { pdfBase64, status } = await fetchDasPdfFromSerpro({
    userId,
    contratanteNumero,
    autorPedidoNumero: autorNumero,
    contribuinteNumero: cnpjNumerico,
    periodoApuracao: period,
    contribuinteTipo: contrib.tipo,
    autorTipo: contrib.tipo
  });

  return {
    id: period,
    status,
    pdfBase64,
    filename: `das-mei-${period}.pdf`,
    contentType: 'application/pdf'
  };
};

/** Apaga PDF/status local e busca de novo na Receita (após DAS errado removido do Supabase). */
export const regenerateDasPdf = async (userId, payload) => {
  const { cnpj, periodoApuracao, mes, ano, contribuinte } = payload || {};
  const period = normalizePeriodoApuracao(periodoApuracao, mes, ano);
  if (!period) {
    throw badRequest('Período de apuração inválido');
  }
  const competencia = periodoApuracaoToCompetencia(period);
  try {
    await deleteDasBase64({ userId, periodoApuracao: period });
  } catch {
    /* linha pode não existir */
  }
  try {
    await deleteStoredDasPdf({ userId, competencia, periodoApuracao: period });
  } catch {
    /* ignora */
  }
  if (competencia) {
    try {
      await clearCompetenciaPaidStatus({ userId, competencia });
    } catch {
      /* ignora */
    }
  }
  if (userId && (await userHasMeiCertificate(userId))) {
    return await createGuide(userId, { cnpj, periodoApuracao: period, contribuinte });
  }
  return await createGuideByCnpj(userId, { cnpj, periodoApuracao: period });
};

/** Obtém PDF (cache → bucket → SERPRO). Usado pelo WhatsApp/OpenClaw e download.
 * Guias vencidas (após dia 20) e não pagas: regenera na Receita para valor atualizado.
 */
export const fetchDasPdfBase64ForUser = async (userId, payload = {}) => {
  const { periodoApuracao, cnpj, contribuinte, forceRefresh = false } = payload || {};
  const period = normalizePeriodoApuracao(periodoApuracao);
  if (!period) {
    throw badRequest('Período de apuração inválido');
  }
  const competencia = periodoApuracaoToCompetencia(period);
  const label = competencia ? competencia.replace('-', '/') : period;
  const fileName = `DAS-${String(label).replace('/', '-')}.pdf`;

  const paid = userId && competencia
    ? await isCompetenciaPaid({ userId, competencia })
    : false;
  const shouldRefresh = Boolean(forceRefresh)
    || (Boolean(competencia) && !paid && isDasCompetenciaVencida(competencia));

  if (shouldRefresh && userId) {
    const guide = await regenerateDasPdf(userId, {
      cnpj,
      periodoApuracao: period,
      contribuinte,
    });
    if (!guide?.pdfBase64) {
      throw notFound(`SERPRO não devolveu PDF atualizado para ${label}.`);
    }
    return {
      pdfBase64: guide.pdfBase64,
      fileName: guide.filename || fileName,
      source: 'serpro_refresh',
      refreshed: true,
      vencida: isDasCompetenciaVencida(competencia),
    };
  }

  const cached = userId ? await tryLoadLocalDasPdfBase64(userId, period) : null;
  if (cached) {
    return { pdfBase64: cached, fileName, source: 'cache' };
  }

  const cnpjResolved = await resolveMeiCnpjForUser(userId, cnpj);
  const file = await downloadGuide({
    userId,
    periodoApuracao: period,
    cnpj: cnpjResolved || cnpj,
    contribuinte,
    forceRefresh: false,
  });
  const pdfBase64 = file.buffer.toString('base64');
  if (userId) {
    await upsertDasBase64({ userId, periodoApuracao: period, pdfBase64 });
  }
  return {
    pdfBase64,
    fileName: file.filename || fileName,
    source: 'serpro',
  };
};

export const downloadGuide = async (payload, dependencies = {}) => {
  ensureConfigured();
  const {
    userId,
    cnpj,
    periodoApuracao,
    contribuinte,
    forceRefresh = false,
  } = payload || {};
  if (!periodoApuracao) throw badRequest('Período de apuração é obrigatório');
  const {
    isCompetenciaPaidFn = isCompetenciaPaid,
    markCompetenciaAsPaidFn = markCompetenciaAsPaid,
    createGuideFn = createGuide,
    createGuideByCnpjFn = createGuideByCnpj,
    getDasBase64Fn = getDasBase64,
    regenerateDasPdfFn = regenerateDasPdf,
  } = dependencies;
  const period = normalizePeriodoApuracao(periodoApuracao);
  const competencia = periodoApuracaoToCompetencia(periodoApuracao);

  const cnpjFromRequest = normalizeDoc(contribuinte?.numero || cnpj);
  const hasCert = userId ? await userHasMeiCertificate(userId) : false;

  const paid = userId && competencia
    ? await isCompetenciaPaidFn({ userId, competencia })
    : false;
  const shouldRefreshExpired = Boolean(forceRefresh)
    || (Boolean(competencia) && !paid && isDasCompetenciaVencida(competencia));

  if (shouldRefreshExpired && userId && period) {
    const guide = await regenerateDasPdfFn(userId, {
      cnpj,
      periodoApuracao: period,
      contribuinte,
    });
    if (guide?.pdfBase64) {
      const label = (competencia || period).replace('-', '/');
      return {
        buffer: Buffer.from(guide.pdfBase64, 'base64'),
        contentType: 'application/pdf',
        filename: guide.filename || `DAS-${String(label).replace('/', '-')}.pdf`,
        refreshed: true,
        vencida: isDasCompetenciaVencida(competencia),
      };
    }
  }

  if (userId && competencia && period && !shouldRefreshExpired) {
    const storedBase64 = await getDasBase64Fn({ userId, periodoApuracao: period });
    if (storedBase64 && String(storedBase64).trim()) {
      const label = competencia.replace('-', '/');
      return {
        buffer: Buffer.from(storedBase64, 'base64'),
        contentType: 'application/pdf',
        filename: `DAS-${label.replace('/', '-')}.pdf`
      };
    }
    const fromStorage = await tryStoredDasPdfFile({ userId, competencia, periodoApuracao, period });
    if (fromStorage) return fromStorage;
    /* Sem PDF local — tenta SERPRO abaixo (pago ou não) */
  } else if (userId && competencia) {
    const paidInCache = await isCompetenciaPaidFn({ userId, competencia });
    if (paidInCache && !period) {
      throw paidPeriodNoPdfError();
    }
  }

  let guide;
  if (hasCert) {
    await ensureClientCertificate(userId);
    const contrib = resolveContribuinte(userId, contribuinte, cnpj);
    try {
      guide = await createGuideFn(userId, {
        cnpj,
        periodoApuracao,
        contribuinte: contrib
      });
    } catch (error) {
      if (!competencia || !shouldMarkCompetenciaAsPaid(error)) {
        throw error;
      }
      await persistPaidCompetenciaSafely({
        userId,
        competencia,
        documentoFiscal: normalizeDocumentoFiscalForStatus(contrib?.numero || cnpjFromRequest),
        source: 'download_serpro',
        markCompetenciaAsPaidFn
      });
      throw paidPeriodNoPdfError();
    }
    return await ensureDownloadBuffer(guide, userId, {
      autorPedidoDados: contrib,
      contribuinte: contrib
    });
  }

  if (cnpjFromRequest && validateDoc(cnpjFromRequest)) {
    try {
      guide = await createGuideByCnpjFn(userId, {
        cnpj: cnpjFromRequest,
        periodoApuracao
      });
    } catch (error) {
      if (!competencia || !shouldMarkCompetenciaAsPaid(error)) {
        throw error;
      }
      await persistPaidCompetenciaSafely({
        userId,
        competencia,
        documentoFiscal: normalizeDocumentoFiscalForStatus(cnpjFromRequest),
        source: 'download_serpro',
        markCompetenciaAsPaidFn
      });
      throw paidPeriodNoPdfError();
    }
    return await ensureDownloadBuffer(guide, userId, null);
  }

  if (userId) {
    const hasPersisted = await userHasMeiCertificate(userId);
    if (hasPersisted) {
      throw badRequest(
        'Não foi possível usar o certificado MEI desta conta. Reabra a app e reenvie o certificado A1 (Certificado e DAS).',
        { code: 'MEI_CERT_LOAD_FAILED' }
      );
    }
    throw badRequest(
      'Certificado MEI não cadastrado na conta. Cadastre o certificado A1 na app Meu Financeiro (aba Certificado e DAS).',
      { code: 'MEI_CERT_MISSING' }
    );
  }
  throw badRequest('Informe o CNPJ do MEI para baixar a guia');
};

const buildRecentCompetencias = (count = 12, includeCurrent = false) => {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!includeCurrent) {
    base.setMonth(base.getMonth() - 1);
  }
  const competencias = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const competencia = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    competencias.push(competencia);
  }
  return competencias;
};

const PERIODS_SERPRO_CONCURRENCY = 2;
const SERPRO_PERIOD_PROBE_ATTEMPTS = 3;
const SERPRO_PERIOD_PROBE_RETRY_MS = 900;

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SERPRO_UNAVAILABLE_PERIOD_MESSAGE =
  'O serviço da Receita Federal está temporariamente indisponível. Toque em Atualizar em alguns minutos.';

const probeSerproForPeriod = async ({
  userId,
  period,
  cnpj,
  contribuinte,
  useCertificate,
  createGuideFn,
  createGuideByCnpjFn,
}) => {
  if (useCertificate) {
    await createGuideFn(userId, {
      cnpj,
      periodoApuracao: period,
      contribuinte,
      skipLocalPdf: true,
    });
  } else {
    await createGuideByCnpjFn(userId, {
      cnpj,
      periodoApuracao: period,
      skipLocalPdf: true,
    });
  }
};

const resolvePeriodItemFromSerpro = async ({
  userId,
  competencia,
  cnpj,
  contribuinte,
  useCertificate,
  paidCompetencias,
  documentoFiscal,
  createGuideFn,
  createGuideByCnpjFn,
  markCompetenciaAsPaidFn,
  getKnownCompetenciaPeriodStatusFn = getKnownCompetenciaPeriodStatus,
}) => {
  const period = normalizePeriodoApuracao(competencia);
  if (!period) return null;
  if (paidCompetencias.has(competencia)) {
    return { competencia, status: 'pago', guideId: period };
  }

  let lastError = null;

  for (let attempt = 1; attempt <= SERPRO_PERIOD_PROBE_ATTEMPTS; attempt += 1) {
    try {
      await probeSerproForPeriod({
        userId,
        period,
        cnpj,
        contribuinte,
        useCertificate,
        createGuideFn,
        createGuideByCnpjFn,
      });
      return { competencia, status: 'a_pagar', guideId: period };
    } catch (error) {
      lastError = error;
      if (shouldMarkCompetenciaAsPaid(error)) {
        paidCompetencias.add(competencia);
        await persistPaidCompetenciaSafely({
          userId,
          competencia,
          documentoFiscal,
          source: 'consulta_serpro',
          markCompetenciaAsPaidFn,
        });
        return { competencia, status: 'pago', guideId: period };
      }
      if (isPeriodoIndisponivelSerproError(error)) {
        return {
          competencia,
          status: 'indisponivel',
          guideId: period,
          errorMessage: String(error?.message || 'Período indisponível para DAS MEI').slice(0, 220),
        };
      }
      if (isSerproUnavailableError(error) && attempt < SERPRO_PERIOD_PROBE_ATTEMPTS) {
        if (process.env.NODE_ENV !== 'test') {
          await sleepMs(SERPRO_PERIOD_PROBE_RETRY_MS * attempt);
        }
        continue;
      }
      break;
    }
  }

  if (lastError && isSerproUnavailableError(lastError)) {
    if (userId) {
      try {
        const known = await getKnownCompetenciaPeriodStatusFn({ userId, competencia });
        if (known === 'pago') {
          paidCompetencias.add(competencia);
          return { competencia, status: 'pago', guideId: period };
        }
        if (known === 'a_pagar') {
          return {
            competencia,
            status: 'indisponivel',
            guideId: period,
            errorMessage:
              'Receita indisponível no momento. Última consulta bem-sucedida indicou DAS a pagar — tente Atualizar em alguns minutos.',
          };
        }
      } catch {
        /* ignora fallback local */
      }
    }
    return {
      competencia,
      status: 'indisponivel',
      guideId: period,
      errorMessage: SERPRO_UNAVAILABLE_PERIOD_MESSAGE,
    };
  }

  return {
    competencia,
    status: 'erro',
    guideId: period,
    errorMessage: getPeriodHistoryErrorMessage(lastError),
  };
};

const buildPeriodsFromPdf = async (userId, options = {}, dependencies = {}) => {
  const { cnpj, contribuinte, useCertificate = false } = options;
  const {
    listPaidCompetenciasFn = listPaidCompetencias,
    markCompetenciaAsPaidFn = markCompetenciaAsPaid,
    createGuideFn = createGuide,
    createGuideByCnpjFn = createGuideByCnpj,
    getKnownCompetenciaPeriodStatusFn = getKnownCompetenciaPeriodStatus,
  } = dependencies;
  const competencias = buildRecentCompetencias(12, true);
  const paidCompetencias = userId
    ? new Set(await listPaidCompetenciasFn({ userId, competencias }))
    : new Set();
  const documentoFiscal = normalizeDocumentoFiscalForStatus(cnpj || contribuinte?.numero);
  const items = [];

  for (let i = 0; i < competencias.length; i += PERIODS_SERPRO_CONCURRENCY) {
    const chunk = competencias.slice(i, i + PERIODS_SERPRO_CONCURRENCY);
    const chunkItems = await Promise.all(
      chunk.map((competencia) =>
        resolvePeriodItemFromSerpro({
          userId,
          competencia,
          cnpj,
          contribuinte,
          useCertificate,
          paidCompetencias,
          documentoFiscal,
          createGuideFn,
          createGuideByCnpjFn,
          markCompetenciaAsPaidFn,
          getKnownCompetenciaPeriodStatusFn,
        })
      )
    );
    for (const row of chunkItems) {
      if (row) items.push(row);
    }
  }

  return items
    .filter((item) => item.status !== 'indisponivel')
    .map((item) => enrichDasPeriodWithVencimento(item));
};

export const __buildPeriodsFromPdfForTests = async (userId, options = {}, dependencies = {}) => {
  return await buildPeriodsFromPdf(userId, options, dependencies);
};

export const __isPeriodoPagoSerproErrorForTests = (error) => {
  return isPeriodoPagoSerproError(error);
};

export const listPeriods = async (userId, payload) => {
  ensureConfigured();
  await ensureClientCertificate(userId);
  const { cnpj, contribuinte, refresh = false } = payload || {};
  const contrib = resolveContribuinte(userId, contribuinte, cnpj);
  const autor = contrib;
  const cnpjNumerico = normalizeDoc(contrib.numero);
  const cacheKey = getPeriodsListCacheKey(userId, cnpjNumerico, true);
  if (refresh) {
    periodsListCache.delete(cacheKey);
  } else {
    const cached = readPeriodsListCache(cacheKey);
    if (cached) return cached;
  }

  const data = await buildPeriodsFromPdf(userId, {
    cnpj: cnpjNumerico,
    contribuinte: autor,
    useCertificate: true
  });
  writePeriodsListCache(cacheKey, data);
  return data;
};

export const listPeriodsByCnpj = async (userId, payload) => {
  ensureConfigured();
  const { refresh = false } = payload || {};
  const cnpjNumerico = normalizeCnpj(payload?.cnpj);
  if (!validateCnpj(cnpjNumerico)) {
    throw badRequest('CNPJ do MEI inválido');
  }
  const cacheKey = getPeriodsListCacheKey(userId, cnpjNumerico, false);
  if (refresh) {
    periodsListCache.delete(cacheKey);
  } else {
    const cached = readPeriodsListCache(cacheKey);
    if (cached) return cached;
  }

  const data = await buildPeriodsFromPdf(userId, {
    cnpj: cnpjNumerico,
    useCertificate: false
  });
  writePeriodsListCache(cacheKey, data);
  return data;
};

/** Modalidades do Integra Parcelamento SERPRO com serviço "Consultar Pedidos". Doc: apicenter.estaleiro.serpro.gov.br Integra Contador. */
const PARCELAMENTO_MODALIDADES = [
  { idSistema: 'PARCSN', idServico: 'PEDIDOSPARC163', modalidade: 'Simples Nacional (Ordinário)' },
  { idSistema: 'PARCSN-ESP', idServico: 'PEDIDOSPARC173', modalidade: 'Simples Nacional (Especial)' },
  { idSistema: 'PERTSN', idServico: 'PEDIDOSPARC183', modalidade: 'PERT Simples Nacional' },
  { idSistema: 'RELPSN', idServico: 'PEDIDOSPARC193', modalidade: 'Reescalonamento Simples Nacional' },
  { idSistema: 'PARCMEI', idServico: 'PEDIDOSPARC203', modalidade: 'MEI (Ordinário)' },
  { idSistema: 'PARCMEI-ESP', idServico: 'PEDIDOSPARC213', modalidade: 'MEI (Especial)' },
  { idSistema: 'PERTMEI', idServico: 'PEDIDOSPARC223', modalidade: 'PERT MEI' },
  { idSistema: 'RELPMEI', idServico: 'PEDIDOSPARC233', modalidade: 'Reescalonamento MEI' }
];

/** Visão geral MEI: só modalidades MEI (2 consultas SERPRO em vez de 8). */
const PARCELAMENTO_MODALIDADES_MEI = PARCELAMENTO_MODALIDADES.filter(
  (m) => m.idSistema === 'PARCMEI' || m.idSistema === 'PARCMEI-ESP'
);

const PERIODS_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
const periodsListCache = new Map();

const getPeriodsListCacheKey = (userId, cnpj, useCertificate) =>
  `${userId || ''}:${normalizeDoc(cnpj)}:${useCertificate ? '1' : '0'}`;

const readPeriodsListCache = (key) => {
  const hit = periodsListCache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) {
    if (hit) periodsListCache.delete(key);
    return null;
  }
  return hit.data;
};

const writePeriodsListCache = (key, data) => {
  periodsListCache.set(key, { data, expiresAt: Date.now() + PERIODS_LIST_CACHE_TTL_MS });
};

const invalidatePeriodsListCache = (userId, cnpj) => {
  if (!userId) return;
  const doc = normalizeDoc(cnpj);
  for (const useCertificate of [true, false]) {
    periodsListCache.delete(getPeriodsListCacheKey(userId, doc, useCertificate));
  }
};

/**
 * Mapeamento para obter PDF por parcelamento: Consultar Parcelamento (numero -> detalhes com periodoApuracao)
 * e Emitir DAS (parcelaParaEmitir AAAAMM -> docArrecadacaoPdfB64). Doc SERPRO Integra Parcelamento.
 * Só modalidades com ambos configurados tentam fetch+store em background.
 */
const PARCELAMENTO_PDF_SERPRO = {
  'PARCSN': { consultar: { idSistema: 'PARCSN', idServico: 'OBTERPARC224' }, emitir: null },
  'PARCSN-ESP': { consultar: { idSistema: 'PARCSN-ESP', idServico: 'OBTERPARC224' }, emitir: { idSistema: 'PARCSN-ESP', idServico: 'GERARDAS171' } },
  'RELPSN': { consultar: { idSistema: 'RELPSN', idServico: 'OBTERPARC224' }, emitir: null },
  'PARCMEI': {
    consultar: { idSistema: 'PARCMEI', idServico: 'OBTERPARC204' },
    listarParcelas: { idSistema: 'PARCMEI', idServico: 'PARCELASPARAGERAR202' },
    emitir: { idSistema: 'PARCMEI', idServico: 'GERARDAS201' }
  },
  'PARCMEI-ESP': {
    consultar: { idSistema: 'PARCMEI-ESP', idServico: 'OBTERPARC214' },
    listarParcelas: { idSistema: 'PARCMEI-ESP', idServico: 'PARCELASPARAGERAR212' },
    emitir: { idSistema: 'PARCMEI-ESP', idServico: 'GERARDAS211' }
  },
  'PERTMEI': {
    consultar: { idSistema: 'PERTMEI', idServico: 'OBTERPARC224' },
    emitir: { idSistema: 'PERTMEI', idServico: 'GERARDAS221' }
  },
  'RELPMEI': { consultar: { idSistema: 'RELPMEI', idServico: 'OBTERPARC224' }, emitir: null }
};

const MODALIDADE_TO_IDSISTEMA = Object.fromEntries(
  PARCELAMENTO_MODALIDADES.map((m) => [m.modalidade, m.idSistema])
);

/** Autor = titular do certificado quando difere do CNPJ consultado (procurador SERPRO). */
const resolveParcelamentoSerproParties = async (userId, contribuinte, cnpj) => {
  await ensureClientCertificate(userId);
  const contrib = resolveContribuinte(userId, contribuinte, cnpj);
  const contribNumero = normalizeDoc(contrib.numero);
  const certDoc = normalizeDoc(getUserCertDocument(userId) || '');
  const contratanteNumero = normalizeDoc(env.SERPRO_CONTRATANTE_NUMERO || contribNumero);

  // Padrão: próprio contribuinte (certificado da cliente na conta do MEI — sem procuração Receita).
  // Só troca o autor se o CNPJ/CPF do certificado for diferente do CNPJ consultado (contador + cert da escritória).
  let autorPedidoNumero = contribNumero;
  if (certDoc && certDoc !== contribNumero && validateDoc(certDoc)) {
    autorPedidoNumero = certDoc;
  }

  const contribuinteTipo = contrib.tipo;
  const autorTipo =
    normalizeDocTypeNumber(null, autorPedidoNumero) || getDocType(autorPedidoNumero);

  if (env.NODE_ENV !== 'production') {
    console.info('[mei-guide] parcelamentos SERPRO parties', {
      contribuinte: contribNumero,
      autor: autorPedidoNumero,
      contratante: contratanteNumero,
      usaProcuradorReceita: autorPedidoNumero !== contribNumero,
      precisaTermoIntegraContador: autorPedidoNumero !== contratanteNumero
    });
  }

  return {
    contribNumero,
    autorPedidoNumero,
    contratanteNumero,
    contribuinteTipo,
    autorTipo
  };
};

const normalizeParcelamentoItem = (item, modalidade) => {
  if (!item || typeof item !== 'object') return null;
  const numero = item.numero ?? item.numeroParcelamento ?? item.numero_parcelamento;
  const dataPedido =
    item.dataDoPedido ??
    item.data_do_pedido ??
    item.dataPedido ??
    item.data_pedido ??
    item.dataPedidoPedido ??
    item.data_do_pedido;
  const situacao = item.situacao ?? item.situacaoParcelamento ?? item.situacaoPedido;
  const dataSituacao =
    item.dataDaSituacao ??
    item.data_da_situacao ??
    item.dataSituacao ??
    item.data_situacao ??
    item.dataSituacaoParcelamento;
  // Item sem numero não é um parcelamento válido
  if (numero == null) return null;
  return {
    numero: String(numero),
    dataPedido: dataPedido != null ? String(dataPedido) : undefined,
    situacao: situacao != null ? String(situacao) : undefined,
    dataSituacao: dataSituacao != null ? String(dataSituacao) : undefined,
    modalidade: modalidade || undefined
  };
};

/** Extrai a lista de pedidos de parcelamento (formato SERPRO: dados JSON com chave parcelamentos). */
const extractParcelamentoList = (raw) => {
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.parcelamentos)) return data.parcelamentos;
    if (Array.isArray(data.lista)) return data.lista;
    if (Array.isArray(data.pedidos)) return data.pedidos;
    if (Array.isArray(data.pedidosParcelamento)) return data.pedidosParcelamento;
    if (data.dados) return extractParcelamentoList(data.dados);
  }
  return [];
};

/** Extrai o primeiro período AAAAMM da resposta de Consultar Parcelamento (detalhesConsolidacao ou demonstrativoPagamentos). */
function extractFirstPeriodoApuracao(dados) {
  if (!dados || typeof dados !== 'object') return null;
  const parcelamento = dados.parcelamento ?? dados;
  const detalhes = parcelamento.consolidacaoOriginal?.detalhesConsolidacao ?? parcelamento.detalhesConsolidacao;
  if (Array.isArray(detalhes) && detalhes.length > 0) {
    const first = detalhes[0];
    const periodo = first.periodoApuracao ?? first.periodo_apuracao;
    if (periodo != null) return Number(periodo) || null;
  }
  const demonstrativo = parcelamento.demonstrativoPagamentos ?? parcelamento.demonstrativo_pagamentos;
  if (Array.isArray(demonstrativo) && demonstrativo.length > 0) {
    const first = demonstrativo[0];
    const mes = first.mesDaParcela ?? first.mes_da_parcela;
    if (mes != null) return Number(mes) || null;
  }
  if (Array.isArray(parcelamento.consolidacoesRestanteDivida) && parcelamento.consolidacoesRestanteDivida.length > 0) {
    const det = parcelamento.consolidacoesRestanteDivida[0].detalhesConsolidacao;
    if (Array.isArray(det) && det.length > 0) {
      const periodo = det[0].periodoApuracao ?? det[0].periodo_apuracao;
      if (periodo != null) return Number(periodo) || null;
    }
  }
  return null;
}

/** Todas as parcelas AAAAMM do detalhe do parcelamento (mais recente primeiro). */
function extractParcelasApuracaoList(dados) {
  const root = parseSerproDados(dados) ?? dados;
  if (!root || typeof root !== 'object') return [];
  const parcelamento = root.parcelamento ?? root;
  const found = new Set();

  const pushPeriod = (p) => {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 100000) return;
    found.add(n);
  };

  const scanDetalhes = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const d of arr) {
      pushPeriod(d?.periodoApuracao ?? d?.periodo_apuracao);
    }
  };

  scanDetalhes(parcelamento.consolidacaoOriginal?.detalhesConsolidacao);
  scanDetalhes(parcelamento.detalhesConsolidacao);
  const demonstrativo = parcelamento.demonstrativoPagamentos ?? parcelamento.demonstrativo_pagamentos;
  if (Array.isArray(demonstrativo)) {
    for (const d of demonstrativo) {
      pushPeriod(d?.mesDaParcela ?? d?.mes_da_parcela ?? d?.periodoApuracao ?? d?.periodo_apuracao);
    }
  }
  if (Array.isArray(parcelamento.consolidacoesRestanteDivida)) {
    for (const c of parcelamento.consolidacoesRestanteDivida) {
      scanDetalhes(c?.detalhesConsolidacao);
    }
  }

  return [...found].sort((a, b) => b - a);
}

/** Parcelas liberadas para impressão (PARCELASPARAGERAR*) — só estas devem ir para GERARDAS*. */
function extractListaParcelasImpressao(dados) {
  if (dados == null) return [];
  const root = parseSerproDados(dados) ?? dados;
  const raw =
    (root && typeof root === 'object' && !Array.isArray(root)
      ? root.listaParcelas
        ?? root.lista_parcelas
        ?? root.listaParcela
        ?? root.lista_parcela
        ?? root.parcelas
        ?? root.lista
        ?? root.parcelamento?.listaParcelas
        ?? root.parcelamento?.lista_parcelas
        ?? root.parcelamento?.listaParcela
        ?? root.parcelamento?.lista_parcela
      : null) ?? (Array.isArray(root) ? root : null);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item == null) return null;
      if (typeof item === 'number' || typeof item === 'string') return Number(item);
      return Number(
        item.parcela ?? item.mesDaParcela ?? item.mes_da_parcela ?? item.periodoApuracao
      );
    })
    .filter((n) => Number.isFinite(n) && n >= 100000)
    .sort((a, b) => b - a);
}

const extractSerproMensagensTexto = (raw) => {
  const msgs = raw?.mensagens;
  if (!Array.isArray(msgs) || msgs.length === 0) return '';
  return msgs
    .map((m) => (typeof m === 'string' ? m : m?.texto ?? m?.mensagem ?? m?.descricao ?? ''))
    .filter(Boolean)
    .join(' ')
    .trim();
};

async function fetchParcelasListaImpressaoSerpro({
  config,
  contratanteNumero,
  autorNumero,
  contribNumero,
  userId,
  contribuinteTipo,
  autorTipo
}) {
  if (!config?.listarParcelas) return [];
  const result = await consultarServico({
    contratanteNumero,
    autorPedidoNumero: autorNumero,
    contribuinteNumero: contribNumero,
    idSistema: config.listarParcelas.idSistema,
    idServico: config.listarParcelas.idServico,
    dados: undefined,
    userId,
    contribuinteTipo,
    autorTipo
  });
  const parcelas = extractListaParcelasImpressao(result?.dados);
  if (env.NODE_ENV !== 'production') {
    console.info(
      '[mei-guide] PARCELASPARAGERAR202:',
      parcelas.length ? parcelas.join(', ') : '(vazio)',
      'raw:',
      JSON.stringify(result?.dados ?? result?.raw?.dados)?.slice(0, 500)
    );
  }
  return parcelas;
}

/** Linhas do demonstrativo de pagamentos do pedido (todas as competências). */
function extractDemonstrativoParcelasStatus(dados) {
  const root = parseSerproDados(dados) ?? dados;
  if (!root || typeof root !== 'object') return [];
  const parcelamento = root.parcelamento ?? root;
  const dem = parcelamento.demonstrativoPagamentos ?? parcelamento.demonstrativo_pagamentos;
  if (!Array.isArray(dem)) return [];
  const byPeriod = new Map();
  for (const row of dem) {
    const mes = row?.mesDaParcela ?? row?.mes_da_parcela;
    if (mes == null) continue;
    const n = Number(mes);
    if (!Number.isFinite(n) || n < 100000) continue;
    const arrecadacao = row?.dataDeArrecadacao ?? row?.data_de_arrecadacao;
    const valorPago = row?.valorPago ?? row?.valor_pago;
    const pago =
      (arrecadacao != null && Number(arrecadacao) > 0)
      || (valorPago != null && Number(valorPago) > 0);
    byPeriod.set(n, {
      periodoApuracao: String(n),
      pago,
      valorPago: valorPago != null && Number.isFinite(Number(valorPago)) ? Number(valorPago) : undefined,
      dataArrecadacao: arrecadacao != null ? String(arrecadacao) : undefined
    });
  }
  return [...byPeriod.values()].sort(
    (a, b) => Number(b.periodoApuracao) - Number(a.periodoApuracao)
  );
}

/** Parcelas ainda não arrecadadas no demonstrativo do pedido (OBTERPARC204). */
function extractParcelasDemonstrativoEmAberto(dados) {
  return extractDemonstrativoParcelasStatus(dados)
    .filter((r) => !r.pago)
    .map((r) => Number(r.periodoApuracao));
}

const buildParcelasCandidatasRecentes = (quantidade = 8) => {
  const now = new Date();
  const out = [];
  for (let i = 0; i < quantidade; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`));
  }
  return out;
};

/**
 * Parcelas (AAAAMM) disponíveis para emissão de DAS de um pedido de parcelamento.
 * Ordem: mais recente primeiro.
 */
async function resolveParcelasParaPedido({
  config,
  userId,
  numero,
  contribNumero,
  contratanteNumero,
  autorNumero
}) {
  const contribuinteTipo =
    normalizeDocTypeNumber(null, contribNumero) || getDocType(contribNumero);
  const autorTipo =
    normalizeDocTypeNumber(null, autorNumero) || getDocType(autorNumero);

  const consultResult = await consultarServico({
    contratanteNumero,
    autorPedidoNumero: autorNumero,
    contribuinteNumero: contribNumero,
    idSistema: config.consultar.idSistema,
    idServico: config.consultar.idServico,
    dados: { numeroParcelamento: Number(numero) || numero },
    userId,
    contribuinteTipo,
    autorTipo
  });

  let parcelasLista = [];
  try {
    parcelasLista = await fetchParcelasListaImpressaoSerpro({
      config,
      contratanteNumero,
      autorNumero,
      contribNumero,
      userId,
      contribuinteTipo,
      autorTipo
    });
  } catch {
    parcelasLista = [];
  }

  const demonstrativoRows = extractDemonstrativoParcelasStatus(consultResult?.dados);
  const demonstrativoMap = new Map(
    demonstrativoRows.map((r) => [Number(r.periodoApuracao), r])
  );
  const listaSet = new Set(parcelasLista.map(Number));

  /** Só demonstrativo do pedido + fila de impressão da Receita (sem dívidas antigas da consolidação). */
  const numerosReais = [...new Set([...parcelasLista, ...demonstrativoMap.keys()])]
    .filter((n) => Number.isFinite(n) && n >= 100000)
    .sort((a, b) => b - a);

  if (env.NODE_ENV !== 'production') {
    console.info(
      '[mei-guide] parcelas pedido=',
      numero,
      'demonstrativo:',
      demonstrativoRows.map((r) => `${r.periodoApuracao}${r.pago ? ':pago' : ':aberto'}`).join(', ')
        || '(vazio)',
      'lista:',
      parcelasLista.join(', ') || '(vazio)'
    );
  }

  return numerosReais.map((periodoApuracao) => {
    const periodo = String(periodoApuracao);
    const n = Number(periodo);
    const dem = demonstrativoMap.get(n);
    const pago = dem?.pago === true;
    const emAberto = dem ? !pago : false;
    const liberadaParaImpressao = listaSet.has(n);
    let situacaoParcela = 'indisponivel';
    if (pago) situacaoParcela = 'pago';
    else if (emAberto) situacaoParcela = 'a_pagar';
    else if (liberadaParaImpressao) situacaoParcela = 'liberada';
    if (situacaoParcela === 'indisponivel') return null;

    return {
      periodoApuracao: periodo,
      label: competenciaLabelFromPeriod(periodo) || periodo,
      pago,
      emAberto,
      liberadaParaImpressao,
      situacaoParcela,
      valor: dem?.valorPago,
      dataArrecadacao: dem?.dataArrecadacao
    };
  }).filter(Boolean);
}

/**
 * Obtém PDF do parcelamento via SERPRO (Consultar Parcelamento -> Emitir DAS) e persiste em parcelamento_pdfs.
 * @param {{ quiet?: boolean }} [options] — quiet: só loga falha (background na listagem).
 */
async function fetchAndStoreParcelamentoPdf(
  {
    userId,
    numero,
    modalidade,
    contribNumero,
    contratanteNumero,
    autorNumero,
    parcelaParaEmitir
  },
  options = {}
) {
  const { quiet = false } = options;
  const idSistema = MODALIDADE_TO_IDSISTEMA[modalidade];
  const config = idSistema ? PARCELAMENTO_PDF_SERPRO[idSistema] : null;
  if (!config?.consultar || !config.emitir) {
    const msg = modalidade
      ? `PDF não configurado para a modalidade ${modalidade}`
      : 'Informe a modalidade do parcelamento para gerar o PDF';
    if (quiet) {
      if (env.NODE_ENV !== 'production') {
        console.warn('[mei-guide] parcelamento PDF ignorado:', numero, msg);
      }
      return;
    }
    throw badRequest(msg);
  }

  const logFail = (message) => {
    if (env.NODE_ENV !== 'production') {
      console.warn('[mei-guide] parcelamento PDF:', numero, modalidade, message);
    }
    if (!quiet) throw badRequest(message);
  };

  try {
    const contribuinteTipo =
      normalizeDocTypeNumber(null, contribNumero) || getDocType(contribNumero);
    const autorTipo =
      normalizeDocTypeNumber(null, autorNumero) || getDocType(autorNumero);

    let parcelasParaEmitir;
    if (parcelaParaEmitir != null && String(parcelaParaEmitir).trim() !== '') {
      const period = normalizePeriodoApuracao(parcelaParaEmitir);
      if (!period) {
        logFail('Período da parcela inválido (use AAAAMM, ex.: 202602)');
        return;
      }
      parcelasParaEmitir = [Number(period)];
    } else {
      const parcelasDisponiveis = await resolveParcelasParaPedido({
        config,
        userId,
        numero,
        contribNumero,
        contratanteNumero,
        autorNumero
      });
      if (env.NODE_ENV !== 'production') {
        console.info(
          '[mei-guide] parcelamento PDF candidatos pedido=',
          numero,
          parcelasDisponiveis.map((p) => p.periodoApuracao).join(', ') || '(vazio)'
        );
      }
      parcelasParaEmitir = parcelasDisponiveis
        .map((p) => Number(p.periodoApuracao))
        .filter((n) => Number.isFinite(n))
        .slice(0, 8);
    }

    if (!parcelasParaEmitir.length) {
      logFail('Receita não retornou parcela disponível para emissão do DAS');
      return;
    }

    let pdfBase64 = null;
    let ultimaMensagemSerpro = '';
    for (const parcelaAaaamm of parcelasParaEmitir) {
      try {
        const emitResult = await emitirServico({
          contratanteNumero,
          autorPedidoNumero: autorNumero,
          contribuinteNumero: contribNumero,
          idSistema: config.emitir.idSistema,
          idServico: config.emitir.idServico,
          dados: { parcelaParaEmitir: parcelaAaaamm },
          userId,
          contribuinteTipo,
          autorTipo
        });
        pdfBase64 = extractDasPdfBase64FromSerproResponse(emitResult);
        if (pdfBase64) break;
        const msg = extractSerproMensagensTexto(emitResult?.raw);
        if (msg) ultimaMensagemSerpro = msg;
        if (env.NODE_ENV !== 'production') {
          console.warn('[mei-guide] parcelamento PDF: sem PDF para parcela=', parcelaAaaamm, 'numero=', numero);
        }
      } catch (emitErr) {
        ultimaMensagemSerpro = emitErr?.message || ultimaMensagemSerpro;
        if (env.NODE_ENV !== 'production') {
          console.warn(
            '[mei-guide] parcelamento PDF: emissão falhou parcela=',
            parcelaAaaamm,
            emitErr?.message || emitErr
          );
        }
      }
    }

    if (!pdfBase64) {
      const msg =
        ultimaMensagemSerpro
        || 'Não foi possível gerar o DAS na Receita. Confira no PGMEI/Parcelamento se há parcela em aberto para este pedido.';
      if (!quiet) throw notFound(msg);
      if (env.NODE_ENV !== 'production') {
        console.warn('[mei-guide] parcelamento PDF:', numero, modalidade, msg);
      }
      return;
    }

    await parcelamentoPdfService.upsertParcelamentoPdf({
      userId,
      contribuinteNumero: contribNumero,
      numeroParcelamento: String(numero).trim(),
      modalidade: modalidade || null,
      pdfBase64
    });
    if (env.NODE_ENV !== 'production') {
      console.info('[mei-guide] parcelamento PDF salvo: numero=', numero);
    }
  } catch (err) {
    if (quiet) {
      if (env.NODE_ENV !== 'production') {
        console.warn('[mei-guide] tryFetchAndStoreParcelamentoPdf falhou:', numero, modalidade, err?.message || err);
      }
      return;
    }
    throw err;
  }
}

async function tryFetchAndStoreParcelamentoPdf(params) {
  await fetchAndStoreParcelamentoPdf(params, { quiet: true });
}

export const listParcelamentos = async (userId, payload) => {
  ensureConfigured();
  const { cnpj, contribuinte, scope = 'all' } = payload || {};
  const modalidadesAlvo =
    scope === 'mei' ? PARCELAMENTO_MODALIDADES_MEI : PARCELAMENTO_MODALIDADES;
  const {
    contribNumero,
    autorPedidoNumero,
    contratanteNumero,
    contribuinteTipo,
    autorTipo
  } = await resolveParcelamentoSerproParties(userId, contribuinte, cnpj);

  const precisaTermoIntegraContador =
    autorPedidoNumero !== contratanteNumero || contribNumero !== autorPedidoNumero;

  if (precisaTermoIntegraContador) {
    try {
      await obterAutenticaProcuradorTokenSerpro(userId, {
        contribuinteNumero: contribNumero,
        contribuinteTipo,
        autorPedidoNumero,
        autorTipo
      });
    } catch (error) {
      const authCtx = {
        contribuinte: { numero: contribNumero, tipo: contribuinteTipo },
        autorPedidoDados: { numero: autorPedidoNumero, tipo: autorTipo }
      };
      const cacheKey = getAutenticaProcuradorCacheKey(userId, authCtx);
      const cached = procuradorTokenCache.get(cacheKey);
      const now = Date.now();
      let tokenFallback = cached?.token && cached.expiresAt > now + 60000 ? cached.token : null;
      if (!tokenFallback) {
        const { obterTokenProcurador } = await import('./gestao/authProcurador.service.js');
        tokenFallback = obterTokenProcurador(autorPedidoNumero) || null;
        if (tokenFallback) {
          procuradorTokenCache.set(cacheKey, {
            token: tokenFallback,
            expiresAt: getNextMidnight()
          });
        }
      }
      if (tokenFallback) {
        if (env.NODE_ENV !== 'production') {
          console.warn(
            '[mei-guide] parcelamentos: termo Serpro falhou, seguindo com token em cache:',
            error?.message || error
          );
        }
      } else {
        const termoErro = error?.message || 'Falha ao enviar termo de autorização à SERPRO';
        console.warn('[mei-guide] parcelamentos: termo Integra Contador falhou:', termoErro);
        return {
          parcelamentos: [],
          modalidadesConsultadas: modalidadesAlvo.length,
          resumoPorModalidade: {},
          termoAutorizacaoErro: termoErro,
          modalidadesStatus: modalidadesAlvo.map(({ modalidade, idSistema, idServico }) => ({
            modalidade,
            idSistema,
            idServico,
            status: 'error',
            erro: termoErro
          }))
        };
      }
    }
  }

  const baseParams = {
    contratanteNumero,
    autorPedidoNumero,
    contribuinteNumero: contribNumero,
    dados: {},
    userId,
    contribuinteTipo,
    autorTipo
  };

  const results = await Promise.allSettled(
    modalidadesAlvo.map(({ idSistema, idServico, modalidade }) =>
      consultarServico({ ...baseParams, idSistema, idServico }).then((result) => ({
        modalidade,
        dados: result?.dados
      }))
    )
  );

  const parcelamentos = [];
  const modalidadesStatus = [];
  for (let i = 0; i < results.length; i++) {
    const settled = results[i];
    const { modalidade, idSistema, idServico } = modalidadesAlvo[i];
    if (settled.status === 'rejected') {
      const errMsg = settled.reason?.message || 'erro desconhecido';
      console.warn('[mei-guide] parcelamentos modalidade falhou:', modalidade, idSistema, idServico, errMsg);
      modalidadesStatus.push({ modalidade, idSistema, idServico, status: 'error', erro: errMsg });
      continue;
    }
    const raw = settled.value?.dados;
    if (env.NODE_ENV !== 'production') {
      console.info('[mei-guide] parcelamentos modalidade raw:', modalidade, JSON.stringify(raw)?.slice(0, 500));
    }
    const list = extractParcelamentoList(raw);
    const before = parcelamentos.length;
    for (const item of list) {
      const normalized = normalizeParcelamentoItem(item, modalidade);
      if (normalized) parcelamentos.push(normalized);
    }
    const added = parcelamentos.length - before;
    modalidadesStatus.push({
      modalidade,
      idSistema,
      idServico,
      status: added > 0 ? 'ok' : (list.length === 0 ? 'empty' : 'no_match'),
      itensBrutos: list.length,
      itensNormalizados: added,
    });
  }

  const resumoPorModalidade = {};
  for (const p of parcelamentos) {
    const m = p.modalidade || 'Outros';
    resumoPorModalidade[m] = (resumoPorModalidade[m] || 0) + 1;
  }

  // PDF em background só na listagem completa (aba Parcelamentos), não no resumo da visão geral.
  if (parcelamentos.length > 0 && scope !== 'mei') {
    Promise.allSettled(
      parcelamentos.map((p) =>
        tryFetchAndStoreParcelamentoPdf({
          userId,
          numero: p.numero,
          modalidade: p.modalidade,
          contribNumero,
          contratanteNumero,
          autorNumero: autorPedidoNumero
        })
      )
    ).catch(() => {});
  }

  return {
    parcelamentos,
    modalidadesConsultadas: modalidadesAlvo.length,
    resumoPorModalidade,
    modalidadesStatus
  };
};

export const listParcelamentoParcelas = async (userId, payload) => {
  ensureConfigured();
  const { numero, cnpj, modalidade, contribuinte } = payload || {};
  if (!numero || String(numero).trim() === '') {
    throw badRequest('Número do parcelamento é obrigatório');
  }
  if (!modalidade) {
    throw badRequest('Modalidade do parcelamento é obrigatória');
  }
  const docFromRequest = normalizeDoc(contribuinte?.numero || cnpj);
  if (!docFromRequest) {
    await ensureClientCertificate(userId);
  }
  const parties = await resolveParcelamentoSerproParties(userId, contribuinte, cnpj);
  const { contribNumero, autorPedidoNumero, contratanteNumero } = parties;
  const idSistema = MODALIDADE_TO_IDSISTEMA[modalidade];
  const config = idSistema ? PARCELAMENTO_PDF_SERPRO[idSistema] : null;
  if (!config?.consultar || !config.emitir) {
    throw badRequest(
      modalidade
        ? `Parcelas não configuradas para a modalidade ${modalidade}`
        : 'Modalidade do parcelamento inválida'
    );
  }
  const parcelas = await resolveParcelasParaPedido({
    config,
    userId,
    numero: String(numero).trim(),
    contribNumero,
    contratanteNumero,
    autorNumero: autorPedidoNumero
  });
  return { parcelas };
};

export const getOrDownloadParcelamentoPdf = async (userId, payload) => {
  ensureConfigured();
  const { numero, cnpj, modalidade, contribuinte, parcela, periodoApuracao } = payload || {};
  if (!numero || String(numero).trim() === '') {
    throw badRequest('Número do parcelamento é obrigatório');
  }
  const parcelaEscolhida = normalizePeriodoApuracao(parcela || periodoApuracao);
  const docFromRequest = normalizeDoc(contribuinte?.numero || cnpj);
  if (!docFromRequest) {
    await ensureClientCertificate(userId);
  }
  const parties = await resolveParcelamentoSerproParties(userId, contribuinte, cnpj);
  const { contribNumero, autorPedidoNumero, contratanteNumero } = parties;

  let data = null;
  if (!parcelaEscolhida) {
    data = await parcelamentoPdfService.getParcelamentoPdf({
      userId,
      numeroParcelamento: String(numero).trim()
    });
  }

  if (!data?.pdf_base64) {
    if (!modalidade) {
      throw badRequest('Modalidade do parcelamento é obrigatória para gerar o PDF');
    }
    await fetchAndStoreParcelamentoPdf({
      userId,
      numero: String(numero).trim(),
      modalidade,
      contribNumero,
      contratanteNumero,
      autorNumero: autorPedidoNumero,
      parcelaParaEmitir: parcelaEscolhida || undefined
    });
    data = await parcelamentoPdfService.getParcelamentoPdf({
      userId,
      numeroParcelamento: String(numero).trim()
    });
  }

  if (data?.pdf_base64) {
    const buffer = Buffer.from(data.pdf_base64, 'base64');
    const filename = `parcelamento-${String(numero).trim()}.pdf`;
    return { buffer, contentType: 'application/pdf', filename };
  }

  throw notFound(
    'A Receita não devolveu DAS para este pedido. Só é possível baixar guia do parcelamento com situação "Em parcelamento" (parcelas em aberto). Parcelamentos encerrados não geram novo PDF aqui.'
  );
};

/** Bloqueia envio/consulta de DAS quando a Receita indica período indisponível (ex.: não optante). */
export const assertDasPeriodoPermitidoParaEnvio = async (userId, payload) => {
  ensureConfigured();
  const { cnpj, periodoApuracao, contribuinte } = payload || {};
  const period = normalizePeriodoApuracao(periodoApuracao);
  if (!period) {
    throw badRequest('Período de apuração inválido');
  }
  const competenciaLabel = competenciaLabelFromPeriod(period);

  let contratanteNumero;
  let autorPedidoNumero;
  let contribuinteNumero;

  if (userId && hasUserCertificate(userId)) {
    await ensureClientCertificate(userId);
    const contrib = resolveContribuinte(userId, contribuinte, cnpj);
    contribuinteNumero = normalizeDoc(contrib.numero);
    autorPedidoNumero = contribuinteNumero;
    contratanteNumero = normalizeDoc(env.SERPRO_CONTRATANTE_NUMERO || contribuinteNumero);
  } else {
    contribuinteNumero = normalizeDoc(cnpj);
    if (!validateDoc(contribuinteNumero)) {
      throw badRequest('CNPJ do MEI inválido');
    }
    contratanteNumero = normalizeDoc(env.SERPRO_CONTRATANTE_NUMERO);
    if (!contratanteNumero) {
      throw badRequest('Contratante Serpro não configurado');
    }
    autorPedidoNumero = contratanteNumero;
  }

  try {
    const emitResponse = await emitirServico({
      contratanteNumero,
      autorPedidoNumero,
      contribuinteNumero,
      idSistema: 'PGMEI',
      idServico: 'GERARDASPDF21',
      dados: { periodoApuracao: period },
      versaoSistema: '1.0'
    });
    assertSerproDasPeriodoDisponivel(emitResponse, competenciaLabel);
  } catch (error) {
    if (isPeriodoIndisponivelSerproError(error)) {
      throw error;
    }
    /* Falha técnica na sonda: não bloqueia leitura de PDF já armazenado em outro fluxo */
  }
};

export const validateGuide = async (userId, payload) => {
  ensureConfigured();
  const { cnpj, periodoApuracao, mes, ano } = payload || {};
  const cnpjNumerico = normalizeCnpj(cnpj);
  if (!validateCnpj(cnpjNumerico)) {
    throw badRequest('CNPJ do MEI inválido');
  }
  const period = normalizePeriodoApuracao(periodoApuracao, mes, ano);
  if (!period) {
    throw badRequest('Período de apuração inválido');
  }

  const hasCert = userId ? hasUserCertificate(userId) : false;
  if (hasCert) {
    await ensureClientCertificate(userId);
    const certDoc = getUserCertDocument(userId);
    if (certDoc && normalizeDoc(certDoc) !== cnpjNumerico) {
      return {
        valid: true,
        message:
          'CNPJ informado difere do certificado. Use o CNPJ do certificado ou regenere com Criar Guia.'
      };
    }
    return {
      valid: true,
      message: 'CNPJ e certificado OK. Use Criar Guia ou Baixar para obter o PDF deste mês.'
    };
  }

  if (!normalizeDoc(env.SERPRO_CONTRATANTE_NUMERO)) {
    throw badRequest('Procurador Serpro não configurado para validar sem certificado.');
  }

  return {
    valid: true,
    message: 'CNPJ válido. Envie o certificado ou use Criar Guia (procurador Serpro).'
  };
};
