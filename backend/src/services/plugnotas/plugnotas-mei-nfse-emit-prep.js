import { HttpError, badRequest } from '../../utils/errors.js';
import { normalizeDocDigits } from '../../utils/cpf-cnpj.js';
import { normalizeIbgeMunicipioCodigo } from '../../utils/ibge-municipio-codigo.js';
import {
  decryptPassphrase,
  getDocumentosAtivosMirror,
  getEmitenteNfseSnapshot,
  getPlugNotasCertId,
  loadCertificate,
  savePlugNotasCertId,
} from '../mei-certificate-store.js';
import { persistDocumentosAtivosMirrorAfterEmpresa } from '../mei-notas-documentos-mirror.js';
import { unwrapPlugnotasEmpresaRecord } from '../mei-emitente-empresa-sync.js';
import {
  cadastrarCertificadoPlugNotas,
  cadastrarEmpresaPlugNotas,
  consultarEmpresaPlugNotas,
  resolverCertificadoIdPorCnpj,
} from './empresa.service.js';
import { resolvePrestadorEmitEmail } from './plugnotas-nfse-email-resolve.js';
import { PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE } from './empresa-cadastro-runtime-decision.js';
import {
  PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA,
  PLUGNOTAS_REGIME_ESPECIAL_MEI,
  applyNfseNationalContractPolicy,
  normalizeMeiEmpresaPayload,
} from './plugnotas-mei-empresa-policy.js';

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const DEFAULT_DOCUMENTOS_ATIVOS = Object.freeze({
  nfse: true,
  nfe: false,
  nfce: false,
});

const resolveDocumentosAtivosSelection = (documentosAtivos) => {
  if (!documentosAtivos || typeof documentosAtivos !== 'object') {
    return { ...DEFAULT_DOCUMENTOS_ATIVOS };
  }
  return {
    nfse: documentosAtivos.nfse !== false,
    nfe: documentosAtivos.nfe === true,
    nfce: documentosAtivos.nfce === true,
  };
};

const isEmpresaNaoCadastradaError = (error) => {
  if (!(error instanceof HttpError)) return false;
  if (error.errors?.plugnotasCode === PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE) return true;
  const lower = String(error.message || '').toLowerCase();
  return error.status === 404
    || (lower.includes('localizamos') && lower.includes('empresa'))
    || lower.includes('não há cadastro desta empresa no emissor')
    || lower.includes('nao ha cadastro desta empresa no emissor');
};

const emitenteHasMinimumAddress = (emitente) => {
  if (!emitente || typeof emitente !== 'object') return false;
  return Boolean(
    String(emitente.logradouro || '').trim()
    && String(emitente.numero || '').trim()
    && String(emitente.codigoCidade || '').trim()
    && normalizeDoc(emitente.cep).length === 8,
  );
};

/**
 * @param {import('../mei-certificate-store.js').NfseEmitenteApiSnapshot} emitente
 * @param {string} certificadoId
 * @param {{ nfse?: boolean, nfe?: boolean, nfce?: boolean }} documentosAtivos
 */
export const buildEmpresaPayloadFromEmitenteSnapshot = (
  emitente,
  certificadoId,
  documentosAtivos = DEFAULT_DOCUMENTOS_ATIVOS,
) => {
  const cnpj = normalizeDoc(emitente.certDocument);
  const endereco = {
    tipoLogradouro: String(emitente.tipoLogradouro || 'Rua').trim() || 'Rua',
    logradouro: String(emitente.logradouro || '').trim(),
    numero: String(emitente.numero || '').trim(),
    bairro: String(emitente.bairro || '').trim(),
    codigoPais: '1058',
    descricaoPais: 'Brasil',
    codigoCidade: normalizeIbgeMunicipioCodigo(emitente.codigoCidade),
    descricaoCidade: String(emitente.descricaoCidade || '').trim(),
    estado: String(emitente.estado || '').trim().toUpperCase(),
    cep: normalizeDoc(emitente.cep).slice(0, 8),
  };
  const complemento = String(emitente.complemento || '').trim();
  if (complemento) endereco.complemento = complemento;

  const razaoSocial = String(emitente.razaoSocial || '').trim();
  const nomeFantasia = String(emitente.nomeFantasia || '').trim() || razaoSocial;
  const rpsSerie = String(emitente.rpsSerie ?? '1').trim() || '1';
  const rpsNumero = Number.parseInt(String(emitente.rpsNumero ?? 1), 10) || 1;
  const rpsLote = Number.parseInt(String(emitente.rpsLote ?? 1), 10) || 1;

  const selection = resolveDocumentosAtivosSelection(documentosAtivos);

  const payload = {
    cpfCnpj: cnpj,
    certificado: certificadoId,
    razaoSocial,
    nomeFantasia,
    regimeTributario: 1,
    simplesNacional: true,
    regimeTributarioEspecial: PLUGNOTAS_REGIME_ESPECIAL_MEI,
    inscricaoEstadual: PLUGNOTAS_MEI_INSCRICAO_ESTADUAL_QUANDO_VAZIA,
    endereco,
    nfse: selection.nfse
      ? { ativo: true, tipoContrato: 0, config: { producao: true } }
      : { ativo: false, tipoContrato: 0 },
    nfe: selection.nfe
      ? { ativo: true, tipoContrato: 0, config: { producao: true } }
      : { ativo: false, tipoContrato: 0 },
    nfce: selection.nfce
      ? { ativo: true, tipoContrato: 0, config: { producao: true } }
      : { ativo: false, tipoContrato: 0 },
    documentosAtivos: selection,
    rps: {
      lote: rpsLote,
      numeracao: [{ serie: rpsSerie, numero: rpsNumero }],
    },
  };

  const email = String(emitente.email || '').trim();
  if (email) payload.email = email;
  const im = String(emitente.inscricaoMunicipal || '').trim();
  if (im) payload.inscricaoMunicipal = im;

  applyNfseNationalContractPolicy(payload);
  normalizeMeiEmpresaPayload(payload);
  return payload;
};

const tryAutoUploadStoredCertToPlugnotas = async (userId, cnpj14) => {
  let stored;
  try {
    stored = await loadCertificate(userId);
  } catch {
    return null;
  }
  if (!stored) return null;

  let password;
  try {
    password = decryptPassphrase(stored.passphraseEnc, stored.passphraseIv);
  } catch {
    return null;
  }

  let fileBuffer;
  try {
    fileBuffer = Buffer.from(stored.pfxBase64, 'base64');
  } catch {
    return null;
  }

  try {
    const result = await cadastrarCertificadoPlugNotas({
      fileBuffer,
      fileName: 'certificado.pfx',
      mimeType: 'application/x-pkcs12',
      password,
      cpfCnpj: cnpj14,
    });
    const certId = typeof result?.id === 'string' ? result.id.trim() : '';
    return certId || null;
  } catch {
    return null;
  }
};

/**
 * Resolve ID do certificado no Plugnotas (local → lookup CNPJ → auto-upload .pfx).
 * @param {string} userId
 * @param {string} cnpj14
 */
export const resolvePlugnotasCertificadoIdForUser = async (userId, cnpj14) => {
  let certId = await getPlugNotasCertId(userId);
  if (certId) return certId;

  try {
    certId = await resolverCertificadoIdPorCnpj(cnpj14);
  } catch {
    certId = null;
  }
  if (certId) {
    savePlugNotasCertId(userId, certId).catch(() => {});
    return certId;
  }

  certId = await tryAutoUploadStoredCertToPlugnotas(userId, cnpj14);
  if (certId) {
    savePlugNotasCertId(userId, certId).catch(() => {});
  }
  return certId || null;
};

/**
 * Garante cadastro da empresa no Plugnotas antes da NFS-e (auto-registo a partir do espelho local).
 * @param {string} userId
 * @param {string} cnpjInput
 * @returns {Promise<Record<string, unknown>|null>}
 */
export const ensureMeiNfsePlugnotasCadastroBeforeEmit = async (userId, cnpjInput) => {
  const cnpj = normalizeDoc(cnpjInput);
  if (cnpj.length !== 14) return null;

  try {
    const empresaJson = await consultarEmpresaPlugNotas(cnpj);
    return unwrapPlugnotasEmpresaRecord(empresaJson);
  } catch (error) {
    if (!isEmpresaNaoCadastradaError(error)) throw error;
  }

  const emitente = await getEmitenteNfseSnapshot(userId);
  const emitenteCnpj = normalizeDocDigits(emitente?.certDocument || '');
  if (emitenteCnpj !== cnpj) {
    throw badRequest(
      'A empresa ainda não está cadastrada no emissor fiscal para este CNPJ. '
      + 'Abra Certificado → Empresa, confira o CNPJ do certificado e grave o cadastro antes de emitir.',
      { plugnotasCode: PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE },
    );
  }

  if (!String(emitente.razaoSocial || '').trim()) {
    throw badRequest(
      'Razão social do emitente não está preenchida. Complete os dados em Certificado → Empresa.',
      { plugnotasCode: PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE },
    );
  }

  if (!emitenteHasMinimumAddress(emitente)) {
    throw badRequest(
      'Endereço do emitente incompleto (logradouro, número, código IBGE e CEP). '
      + 'Complete em Certificado → Empresa antes de emitir.',
      { plugnotasCode: PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE },
    );
  }

  const certId = await resolvePlugnotasCertificadoIdForUser(userId, cnpj);
  if (!certId) {
    throw badRequest(
      'Certificado não está cadastrado no emissor fiscal. Envie o arquivo .pfx em Certificado antes de emitir.',
      { plugnotasCode: 'certificado_nao_configurado' },
    );
  }

  const mirror = await getDocumentosAtivosMirror(userId).catch(() => null);
  const documentosAtivos = resolveDocumentosAtivosSelection(mirror);

  const resolvedEmail = await resolvePrestadorEmitEmail(userId, cnpj, emitente.email);
  const emitenteForPayload = resolvedEmail && !String(emitente.email || '').trim()
    ? { ...emitente, email: resolvedEmail }
    : emitente;

  const payload = buildEmpresaPayloadFromEmitenteSnapshot(emitenteForPayload, certId, documentosAtivos);
  if (resolvedEmail && !payload.email) {
    payload.email = resolvedEmail;
  }
  await cadastrarEmpresaPlugNotas(payload);
  await persistDocumentosAtivosMirrorAfterEmpresa(userId, payload).catch(() => {});

  const empresaJson = await consultarEmpresaPlugNotas(cnpj);
  return unwrapPlugnotasEmpresaRecord(empresaJson);
};

/**
 * Converte erro bruto do Plugnotas (empresa ausente) em mensagem acionável.
 * @param {unknown} error
 */
export const rethrowIfPlugnotasEmpresaNaoCadastrada = (error) => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && typeof error.message === 'string'
      ? error.message
      : String(error || '');
  const lower = message.toLowerCase();
  if (
    isEmpresaNaoCadastradaError(error)
    || (lower.includes('localizamos') && lower.includes('empresa'))
    || lower.includes('não há cadastro desta empresa no emissor')
    || lower.includes('nao ha cadastro desta empresa no emissor')
  ) {
    throw badRequest(
      'A empresa ainda não está cadastrada no emissor fiscal para este CNPJ. '
      + 'Abra Certificado → Empresa, envie o certificado (.pfx) se necessário e grave o cadastro antes de emitir.',
      {
        plugnotasCode: PLUGNOTAS_EMPRESA_NAO_CADASTRADA_CODE,
        upstreamMessage: message,
      },
    );
  }
};
