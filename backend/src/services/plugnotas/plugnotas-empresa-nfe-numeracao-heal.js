/**
 * Heal / sync de numeração NF-e / NFC-e no PlugNotas.
 * Espelha o RPS (NFS-e): piso pelo maior número já visto + avançar e retry no mesmo clique.
 */
import { unwrapPlugnotasEmpresaRecord } from '../mei-emitente-empresa-sync.js';
import {
  consultarEmpresaPlugNotas,
  patchEmpresaPlugNotasDireto,
  resolverCertificadoIdPorCnpj,
} from './empresa.service.js';

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

const toObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const parsePositiveInt = (value, fallback = NaN) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(n) && n >= 1) return n;
  return fallback;
};

const collectText = (value, depth = 0, out = []) => {
  if (value == null || depth > 8) return out;
  if (typeof value === 'string' || typeof value === 'number') {
    const t = String(value).trim();
    if (t) out.push(t);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, depth + 1, out);
    return out;
  }
  if (typeof value === 'object') {
    for (const nested of Object.values(value)) collectText(nested, depth + 1, out);
  }
  return out;
};

/**
 * @param {unknown} responseOrMessage
 * @returns {string}
 */
export const extractPlugnotasRejectionText = (responseOrMessage) => {
  if (typeof responseOrMessage === 'string') return responseOrMessage;
  return collectText(responseOrMessage).join(' ');
};

/**
 * @param {unknown} responseOrMessage
 * @returns {boolean}
 */
export const isNfeDuplicidadeRejection = (responseOrMessage) => {
  const text = extractPlugnotasRejectionText(responseOrMessage).toLowerCase();
  if (!text) return false;
  return (
    text.includes('duplicidade de nf-e')
    || text.includes('duplicidade de nfe')
    || text.includes('duplicidade de nfc-e')
    || text.includes('duplicidade de nfce')
    || (text.includes('duplicidade') && text.includes('chave de acesso'))
  );
};

/**
 * Extrai todos os nNF encontrados em chaves de 44 dígitos no texto.
 * @param {unknown} responseOrMessage
 * @returns {number[]}
 */
export const extractNfeNumerosFromText = (responseOrMessage) => {
  const text = extractPlugnotasRejectionText(responseOrMessage);
  const out = [];
  const re = /\b([0-9]{44})\b/g;
  let match = re.exec(text);
  while (match) {
    const nNf = Number(match[1].slice(25, 34));
    if (Number.isFinite(nNf) && nNf > 0) out.push(Math.trunc(nNf));
    match = re.exec(text);
  }
  return out;
};

/**
 * Extrai nNF (9 dígitos) da chave de acesso NF-e/NFC-e (44 dígitos) embutida na mensagem.
 * Layout: cUF(2)+AAMM(4)+CNPJ(14)+mod(2)+serie(3)+nNF(9)+tpEmis(1)+cNF(8)+cDV(1)
 * @param {unknown} responseOrMessage
 * @returns {number|null}
 */
export const extractNfeNumeroFromDuplicidadeMessage = (responseOrMessage) => {
  const nums = extractNfeNumerosFromText(responseOrMessage);
  if (!nums.length) return null;
  return Math.max(...nums);
};

/**
 * Maior nNF conhecido numa linha local (payload / resposta / chave).
 * @param {{ payload_json?: unknown, response_json?: unknown }|null|undefined} row
 * @returns {number|null}
 */
export const readNfeNumeroFromHistoryRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const fromPayloadIde = parsePositiveInt(
    row.payload_json?.ide?.nNF
      ?? row.payload_json?.ide?.numero
      ?? row.payload_json?.numero,
    0,
  );
  const fromText = extractNfeNumerosFromText({
    payload: row.payload_json,
    response: row.response_json,
  });
  const max = Math.max(fromPayloadIde, ...(fromText.length ? fromText : [0]));
  return max > 0 ? max : null;
};

/**
 * Próximo número após duplicidade — igual ao RPS pós-E0014.
 * @param {number|null|undefined} failedNumero
 * @param {number|null|undefined} localMaxNumero
 * @param {number|null|undefined} empresaNumero
 * @returns {number}
 */
export const resolveNextNfeNumeroAfterFailure = (
  failedNumero,
  localMaxNumero,
  empresaNumero,
) => {
  const failed = parsePositiveInt(failedNumero, 0);
  const localMax = parsePositiveInt(localMaxNumero, 0);
  const empresaNext = parsePositiveInt(empresaNumero, 0);
  const fromFailed = failed >= 1 ? failed + 1 : 1;
  const fromLocal = localMax >= 1 ? localMax + 1 : 1;
  const fromEmpresa = empresaNext >= 1 ? empresaNext : 1;
  return Math.max(fromFailed, fromLocal, fromEmpresa);
};

/**
 * Lê serie/numero atuais do bloco nfe ou nfce da empresa.
 * PlugNotas usa `config.numeracao: [{ serie, numero }]`; fallback para campos flat.
 * `numero` = próximo a emitir (numeracaoAutomatica).
 * @param {Record<string, unknown>} empresa
 * @param {'nfe'|'nfce'} docKey
 */
export const readEmpresaNfeNumeracao = (empresa, docKey = 'nfe') => {
  const block = toObject(empresa?.[docKey]);
  const config = toObject(block.config);
  const numeracaoArr = Array.isArray(config.numeracao) ? config.numeracao : [];
  const first = toObject(numeracaoArr[0]);
  const serieRaw = first.serie ?? config.serie ?? config.serieNfe ?? 1;
  const numeroRaw = first.numero ?? config.numero ?? config.proximoNumero ?? 1;
  const serie = Number(serieRaw);
  const numero = Number(numeroRaw);
  return {
    serie: Number.isFinite(serie) && serie > 0 ? Math.trunc(serie) : 1,
    numero: Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : 1,
    block,
    config,
    numeracaoArr,
  };
};

const stripPartialPrefeituraAuth = (empresa) => {
  const nfse = toObject(empresa.nfse);
  if (!Object.keys(nfse).length) return undefined;
  const config = toObject(nfse.config);
  const prefeitura = toObject(config.prefeitura);
  if (!Object.keys(prefeitura).length) return nfse;
  const { login, senha, ...prefRest } = prefeitura;
  const nextConfig = { ...config };
  if (Object.keys(prefRest).length) nextConfig.prefeitura = prefRest;
  else delete nextConfig.prefeitura;
  return { ...nfse, config: nextConfig };
};

/**
 * Garante que o próximo número na empresa seja pelo menos `nextNumero` (estilo sync RPS).
 * @param {string} cnpjInput
 * @param {number} nextNumero
 * @param {{ documentType?: 'NFE'|'NFCE' }} [opts]
 * @returns {Promise<{ ok: boolean, patched: boolean, nextNumero?: number, reason?: string }>}
 */
export const ensureEmpresaNfeNumeracaoAtLeast = async (cnpjInput, nextNumero, opts = {}) => {
  const cnpj = normalizeDoc(cnpjInput);
  const target = parsePositiveInt(nextNumero, 0);
  if (cnpj.length !== 14 || !target) {
    return { ok: false, patched: false, reason: 'invalid_args' };
  }

  const docKey = String(opts?.documentType || 'NFE').toUpperCase() === 'NFCE' ? 'nfce' : 'nfe';

  let empresaJson;
  try {
    empresaJson = await consultarEmpresaPlugNotas(cnpj);
  } catch (error) {
    console.warn('[plugnotas-nfe-num] GET empresa falhou', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, patched: false, reason: 'empresa_get_failed' };
  }

  const empresa = unwrapPlugnotasEmpresaRecord(empresaJson) || {};
  const current = readEmpresaNfeNumeracao(empresa, docKey);
  if (current.numero >= target) {
    return {
      ok: true,
      patched: false,
      nextNumero: current.numero,
      reason: 'already_ahead',
    };
  }

  let certificado = null;
  try {
    certificado = await resolverCertificadoIdPorCnpj(cnpj);
  } catch {
    certificado = null;
  }
  if (!certificado) {
    return { ok: false, patched: false, reason: 'certificado_missing' };
  }

  const ie = String(empresa.inscricaoEstadual || '').trim();
  const restNumeracao = current.numeracaoArr.slice(1).map((row) => toObject(row));
  const nextBlock = {
    ...current.block,
    ativo: true,
    config: {
      ...current.config,
      producao: current.config.producao !== false,
      numeracaoAutomatica: current.config.numeracaoAutomatica !== false,
      numeracao: [
        { serie: current.serie, numero: target },
        ...restNumeracao,
      ],
    },
  };

  const nfseClean = stripPartialPrefeituraAuth(empresa);

  try {
    await patchEmpresaPlugNotasDireto(cnpj, {
      certificado,
      ...(ie ? { inscricaoEstadual: ie } : { inscricaoEstadual: 'ISENTO' }),
      regimeTributario: Number(empresa.regimeTributario) || 1,
      simplesNacional: true,
      ...(nfseClean ? { nfse: nfseClean } : {}),
      nfe: nextBlock,
      ...(empresa.nfce ? { nfce: empresa.nfce } : {}),
    });
    console.info('[plugnotas-nfe-num] numeração alinhada (estilo RPS)', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      doc: docKey,
      from: current.numero,
      to: target,
    });
    return { ok: true, patched: true, nextNumero: target, reason: 'patched' };
  } catch (error) {
    console.warn('[plugnotas-nfe-num] PATCH numeração falhou', {
      cnpj14: `${cnpj.slice(0, 4)}***${cnpj.slice(-2)}`,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, patched: false, reason: 'patch_failed' };
  }
};

/**
 * Avança numeração após duplicidade para max(rejected+1, localMax+1, empresa).
 * @param {string} cnpjInput
 * @param {{ rejectedNumero: number, localMax?: number, documentType?: 'NFE'|'NFCE' }} opts
 */
export const advanceEmpresaNfeNumeracaoAfterDuplicidade = async (cnpjInput, opts) => {
  const rejectedNumero = parsePositiveInt(opts?.rejectedNumero, 0);
  if (!rejectedNumero) {
    return { ok: false, patched: false, reason: 'invalid_args' };
  }

  let empresaNumero = 0;
  try {
    const empresaJson = await consultarEmpresaPlugNotas(cnpjInput);
    const empresa = unwrapPlugnotasEmpresaRecord(empresaJson) || {};
    const docKey = String(opts?.documentType || 'NFE').toUpperCase() === 'NFCE' ? 'nfce' : 'nfe';
    empresaNumero = readEmpresaNfeNumeracao(empresa, docKey).numero;
  } catch {
    empresaNumero = 0;
  }

  const nextNumero = resolveNextNfeNumeroAfterFailure(
    rejectedNumero,
    opts?.localMax,
    empresaNumero,
  );
  return ensureEmpresaNfeNumeracaoAtLeast(cnpjInput, nextNumero, {
    documentType: opts?.documentType,
  });
};

/**
 * Sync pré-emissão: próximo número = max(localMax+1, empresa).
 * @param {string} cnpjInput
 * @param {{ localMax?: number, documentType?: string }} [opts]
 */
export const syncEmpresaNfeNumeracaoBeforeEmit = async (cnpjInput, opts = {}) => {
  const localMax = parsePositiveInt(opts?.localMax, 0);
  const nextFromLocal = localMax >= 1 ? localMax + 1 : 1;

  let empresaNumero = 0;
  try {
    const empresaJson = await consultarEmpresaPlugNotas(cnpjInput);
    const empresa = unwrapPlugnotasEmpresaRecord(empresaJson) || {};
    const docKey = String(opts?.documentType || 'NFE').toUpperCase() === 'NFCE' ? 'nfce' : 'nfe';
    empresaNumero = readEmpresaNfeNumeracao(empresa, docKey).numero;
  } catch {
    empresaNumero = 0;
  }

  const nextNumero = Math.max(nextFromLocal, empresaNumero >= 1 ? empresaNumero : 1);
  return ensureEmpresaNfeNumeracaoAtLeast(cnpjInput, nextNumero, {
    documentType: opts?.documentType,
  });
};

/**
 * Se a resposta/mensagem indica duplicidade NF-e, avança contador na empresa.
 * @param {string} cnpjInput
 * @param {unknown} responseOrMessage
 * @param {{ documentType?: string, localMax?: number }} [opts]
 */
export const healEmpresaNfeNumeracaoIfDuplicidade = async (
  cnpjInput,
  responseOrMessage,
  opts = {},
) => {
  if (!isNfeDuplicidadeRejection(responseOrMessage)) {
    return { ok: false, patched: false, reason: 'not_duplicidade' };
  }
  const rejectedNumero = extractNfeNumeroFromDuplicidadeMessage(responseOrMessage);
  if (!rejectedNumero) {
    return { ok: false, patched: false, reason: 'numero_not_found' };
  }
  return advanceEmpresaNfeNumeracaoAfterDuplicidade(cnpjInput, {
    rejectedNumero,
    localMax: opts.localMax,
    documentType: opts.documentType,
  });
};
