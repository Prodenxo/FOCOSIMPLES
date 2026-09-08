/**
 * Campos da Reforma Tributária exigidos por municípios ISSNET (ex.: Ribeirão Preto).
 * PlugNotas mapeia CST/CCT para TX2 via `servico[].ibscbs.valores.tributacao.{cst,cct}`
 * (SituacaoTributariaIbsCbs / ClassificacaoTributariaIbsCbs — doc API ibscbsNfse).
 */

import { normalizeCodigoNbs } from './nfse-codigo-nbs.js';

/** NFS-e regular — emissão padrão de serviço. */
export const NFSE_FIN_NFSE_REGULAR = 0;

/** Operação não destinada a uso/consumo pessoal (operacaoPessoal / indFinal). */
export const NFSE_IND_FINAL_NAO = 0;

/** Serviço físico sobre bem móvel no estabelecimento do prestador (oficina). */
export const NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO = '050101';

/** Prestação de serviço fora dos demais indicadores (ex.: remoto/consultoria). */
export const NFSE_CINDOP_SERVICO_GERAL = '100301';

/** CST IBS/CBS — tributação padrão (PlugNotas / ISSNET RTC v1.01). */
export const NFSE_SITUACAO_TRIBUTARIA_IBSCBS_DEFAULT = '000';

/** Classificação tributária IBS/CBS genérica para serviço. */
export const NFSE_CLASSIFICACAO_TRIBUTARIA_IBSCBS_DEFAULT = '000001';

/** ISSNET municipal RTC: versão base IBS/CBS (legado parcial). */
export const NFSE_VERSAO_ESQUEMA_RTC = 'RTC';

/** ISSNETONLINE30 / NT007 — layout nacional via webservice municipal (Ribeirão Preto). */
export const NFSE_VERSAO_ESQUEMA_RTC007 = 'RTC007';

/** Versão de layout da NFS-e Nacional (NT 1.01 / DPS). */
export const NFSE_VERSAO_LAYOUT_NACIONAL = '1.01';

/** Municípios ISSNET que exigem layout RTC v1.01 na emissão (via ISSNET municipal, não portal nacional). */
export const NFSE_ISSNET_RTC_IBGE = Object.freeze(new Set([
  '3543402', // Ribeirão Preto/SP
]));

/** Chaves permitidas em `servico[].ibscbs` pela API PlugNotas (ibscbsNfse). */
const PLUGNOTAS_IBSCBS_ALLOWED_KEYS = new Set([
  'finalidadeNFSe',
  'operacaoPessoal',
  'codigoOperacao',
  'tipoOperacao',
  'indicadorOperacao',
  'tipoEnteGovernamental',
  'descTipoEnteGovernamental',
  'pagamentoParceladoAntecipado',
  'municipioIncidenciaIbsCbs',
  'referenciasNFSe',
  'destinatario',
  'imovel',
  'valores',
]);

/**
 * @param {unknown} codigo
 * @returns {string}
 */
export const normalizeLc116CodigoDigits = (codigo) => String(codigo || '').replace(/\D/g, '');

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export const normalizeCIndOp = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const digits = String(value).replace(/\D/g, '').slice(0, 6);
  return digits.length === 6 ? digits : null;
};

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export const normalizeSituacaoTributariaIbsCbs = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const digits = String(value).replace(/\D/g, '').slice(0, 3);
  return digits.length === 3 ? digits : null;
};

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export const normalizeClassificacaoTributariaIbsCbs = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const digits = String(value).replace(/\D/g, '').slice(0, 6);
  return digits.length === 6 ? digits : null;
};

/**
 * @param {Record<string, unknown>|null|undefined} servico
 * @returns {string}
 */
export const resolveClassificacaoTributariaIbsCbsForServico = (servico = {}) => {
  const ibscbs = servico.ibscbs && typeof servico.ibscbs === 'object' && !Array.isArray(servico.ibscbs)
    ? servico.ibscbs
    : {};
  const tributacao = ibscbs.valores?.tributacao && typeof ibscbs.valores.tributacao === 'object'
    ? ibscbs.valores.tributacao
    : {};

  const explicit = normalizeClassificacaoTributariaIbsCbs(
    tributacao.cct
    ?? ibscbs.classificacaoTributariaIbsCbs
    ?? ibscbs.cClassTrib
    ?? ibscbs.classCode
    ?? servico.classificacaoTributariaIbsCbs
    ?? servico.cClassTrib,
  );
  if (explicit) return explicit;

  return NFSE_CLASSIFICACAO_TRIBUTARIA_IBSCBS_DEFAULT;
};

/**
 * @param {Record<string, unknown>|null|undefined} servico
 * @returns {string}
 */
export const resolveSituacaoTributariaIbsCbsForServico = (servico = {}) => {
  const ibscbs = servico.ibscbs && typeof servico.ibscbs === 'object' && !Array.isArray(servico.ibscbs)
    ? servico.ibscbs
    : {};
  const tributacao = ibscbs.valores?.tributacao && typeof ibscbs.valores.tributacao === 'object'
    ? ibscbs.valores.tributacao
    : {};

  const explicit = normalizeSituacaoTributariaIbsCbs(
    tributacao.cst
    ?? ibscbs.situacaoTributariaIbsCbs
    ?? ibscbs.cst
    ?? ibscbs.situationCode
    ?? servico.situacaoTributariaIbsCbs
    ?? servico.cstIbsCbs,
  );
  if (explicit) return explicit;

  const classificacao = resolveClassificacaoTributariaIbsCbsForServico(servico);
  if (classificacao.length >= 3) return classificacao.slice(0, 3);

  return NFSE_SITUACAO_TRIBUTARIA_IBSCBS_DEFAULT;
};

/**
 * @param {Record<string, unknown>|null|undefined} servico
 * @returns {string}
 */
export const resolveCIndOpForServico = (servico = {}) => {
  const ibscbs = servico.ibscbs && typeof servico.ibscbs === 'object' && !Array.isArray(servico.ibscbs)
    ? servico.ibscbs
    : {};

  const explicit = normalizeCIndOp(
    ibscbs.cIndOp
    ?? ibscbs.codigoOperacao
    ?? servico.cIndOp
    ?? servico.codigoOperacao,
  );
  if (explicit) return explicit;

  const codigoKey = normalizeLc116CodigoDigits(servico.codigo);
  if (codigoKey.startsWith('1401') || codigoKey.startsWith('140101')) {
    return NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO;
  }

  const cnae = normalizeLc116CodigoDigits(servico.cnae);
  if (cnae.startsWith('452') || cnae.startsWith('453') || cnae.startsWith('454')) {
    return NFSE_CINDOP_SERVICO_NO_ESTABELECIMENTO;
  }

  return NFSE_CINDOP_SERVICO_GERAL;
};

/**
 * @param {Record<string, unknown>|null|undefined} source
 * @returns {number}
 */
export const resolveFinNfseValue = (source = {}) => {
  const raw = source.finNFSe
    ?? source.finNfse
    ?? source.finalidadeNFSe
    ?? source.finalidadeNfse
    ?? source.FinalidadeNFSe;
  if (raw !== undefined && raw !== null && raw !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 9) return parsed;
  }
  return NFSE_FIN_NFSE_REGULAR;
};

/**
 * @param {unknown} value
 * @returns {number}
 */
const resolveOperacaoPessoalValue = (value) => {
  if (value === undefined || value === null || value === '') return NFSE_IND_FINAL_NAO;
  if (value === true || value === 'true' || value === 1 || value === '1') return 1;
  if (value === false || value === 'false' || value === 0 || value === '0') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NFSE_IND_FINAL_NAO;
};

/** Regime de apuração IBS/CBS no SN (NT 009 / regApIBSCBSSN): 1 = pelo Simples (DAS). */
export const NFSE_REG_AP_IBSCBS_SN_SIMPLES = 1;

/**
 * Monta `ibscbs` no formato aceito pela PlugNotas (evita tags inválidas no XML ISSNET).
 *
 * @param {Record<string, unknown>} built
 * @returns {Record<string, unknown>}
 */
export const sanitizeIbscbsForPlugnotasEmit = (built = {}) => {
  const out = {};
  for (const key of PLUGNOTAS_IBSCBS_ALLOWED_KEYS) {
    if (built[key] !== undefined && built[key] !== null) {
      out[key] = built[key];
    }
  }
  return out;
};

/**
 * @param {Record<string, unknown>|null|undefined} destinatarioSource
 * @param {Record<string, unknown>} source
 * @returns {Record<string, unknown>|undefined}
 */
const resolveDestinatarioForPlugnotasEmit = (destinatarioSource, source) => {
  const indicadorRaw = destinatarioSource.indicador ?? source.indDest;
  const indicador = indicadorRaw === 1 || indicadorRaw === '1' ? 1 : 0;
  const hasExtraFields = Boolean(
    destinatarioSource.cpfCnpj
    || destinatarioSource.razaoSocial
    || destinatarioSource.endereco
    || destinatarioSource.email,
  );
  if (indicador === 1 || hasExtraFields) {
    return {
      indicador: 1,
      ...destinatarioSource,
    };
  }
  // indDest é 1-1 no XSD 1.01 quando IBSCBS está presente.
  return { indicador: 0 };
};

/**
 * @param {Record<string, unknown>|null|undefined} empresaJson
 * @returns {string}
 */
export const readCodigoIbgeFromEmpresa = (empresaJson = {}) => {
  const nfse = empresaJson?.nfse && typeof empresaJson.nfse === 'object' ? empresaJson.nfse : {};
  const config = nfse.config && typeof nfse.config === 'object' ? nfse.config : {};
  const prefeitura = config.prefeitura && typeof config.prefeitura === 'object' ? config.prefeitura : {};
  const endereco = empresaJson?.endereco && typeof empresaJson.endereco === 'object' ? empresaJson.endereco : {};
  return String(
    prefeitura.codigoIbge
    ?? prefeitura.codigoCidade
    ?? endereco.codigoCidade
    ?? endereco.codigoIbge
    ?? '',
  ).replace(/\D/g, '').slice(0, 7);
};

/**
 * @param {unknown} codigoIbge
 * @returns {boolean}
 */
export const requiresIssnetRtcEmitSchema = (codigoIbge) => {
  const digits = String(codigoIbge || '').replace(/\D/g, '').slice(0, 7);
  return NFSE_ISSNET_RTC_IBGE.has(digits);
};

/** @deprecated Use {@link requiresIssnetRtcEmitSchema} — RTC municipal ≠ NFS-e Nacional. */
export const requiresIssnetRtcNfseNacional = requiresIssnetRtcEmitSchema;

/**
 * Tabela ISSNETONLINE30 — CodigoTributacaoMunicipio × alíquota ISS (doc TecnoSpeed).
 * @param {unknown} aliquota
 * @returns {string}
 */
export const resolveCodigoTributacaoIssnetFromAliquota = (aliquota) => {
  const parsed = Number(aliquota);
  if (!Number.isFinite(parsed)) return '001';
  if (Math.abs(parsed - 2.5) < 0.01) return '004';
  if (Math.abs(parsed - 3) < 0.01) return '007';
  if (Math.abs(parsed - 5) < 0.01) return '006';
  return '001';
};

/**
 * @param {Record<string, unknown>|null|undefined} ibscbsInput
 * @param {{ finNFSe?: number, operacaoPessoal?: number, cIndOp?: string, servico?: Record<string, unknown>, simplesNacional?: boolean }} options
 * @returns {Record<string, unknown>}
 */
export const buildMinimalServicoIbscbs = (ibscbsInput = {}, options = {}) => {
  const source = ibscbsInput && typeof ibscbsInput === 'object' ? { ...ibscbsInput } : {};
  const servico = options.servico && typeof options.servico === 'object' ? options.servico : {};

  const finNFSe = resolveFinNfseValue({
    finNFSe: source.finNFSe ?? source.finNfse ?? source.finalidadeNFSe ?? options.finNFSe,
  });
  const operacaoPessoal = resolveOperacaoPessoalValue(
    source.operacaoPessoal ?? source.indFinal ?? options.operacaoPessoal,
  );
  const cIndOp = resolveCIndOpForServico({
    ...servico,
    ibscbs: source,
    cIndOp: source.cIndOp ?? options.cIndOp,
    codigoOperacao: source.codigoOperacao ?? options.cIndOp,
  });
  const classificacaoTributariaIbsCbs = resolveClassificacaoTributariaIbsCbsForServico({
    ...servico,
    ibscbs: source,
    classificacaoTributariaIbsCbs: source.classificacaoTributariaIbsCbs ?? options.classificacaoTributariaIbsCbs,
    cClassTrib: source.cClassTrib ?? options.cClassTrib,
  });
  const situacaoTributariaIbsCbs = resolveSituacaoTributariaIbsCbsForServico({
    ...servico,
    ibscbs: source,
    situacaoTributariaIbsCbs: source.situacaoTributariaIbsCbs ?? options.situacaoTributariaIbsCbs,
    cstIbsCbs: source.cstIbsCbs ?? source.cst ?? options.situacaoTributariaIbsCbs,
    classificacaoTributariaIbsCbs,
    cClassTrib: classificacaoTributariaIbsCbs,
  });

  const normalizedSourceCst = normalizeSituacaoTributariaIbsCbs(
    source.cst ?? source.cstIbsCbs ?? source.situacaoTributariaIbsCbs,
  );
  const cstFinal = normalizedSourceCst ?? situacaoTributariaIbsCbs;

  const destinatarioSource = source.destinatario && typeof source.destinatario === 'object' && !Array.isArray(source.destinatario)
    ? source.destinatario
    : {};

  const existingValores = source.valores && typeof source.valores === 'object' && !Array.isArray(source.valores)
    ? source.valores
    : {};
  const existingTributacao = existingValores.tributacao && typeof existingValores.tributacao === 'object'
    ? existingValores.tributacao
    : {};

  const destinatario = resolveDestinatarioForPlugnotasEmit(destinatarioSource, source);

  const built = {
    finalidadeNFSe: source.finalidadeNFSe ?? source.finalidadeNfse ?? finNFSe,
    operacaoPessoal,
    codigoOperacao: source.codigoOperacao ?? cIndOp,
    destinatario,
    valores: {
      ...existingValores,
      tributacao: {
        ...existingTributacao,
        cst: cstFinal,
        cct: classificacaoTributariaIbsCbs,
      },
    },
  };

  for (const key of PLUGNOTAS_IBSCBS_ALLOWED_KEYS) {
    if (key in built) continue;
    if (source[key] !== undefined && source[key] !== null) {
      built[key] = source[key];
    }
  }

  return sanitizeIbscbsForPlugnotasEmit(built);
};

/**
 * Valida metadados NFS-e no catálogo (NBS + cIndOp) — preenchidos pelo contador.
 *
 * @param {Record<string, unknown>|null|undefined} metadata
 * @throws {Error}
 */
export const validateNfseCatalogProdutoMetadata = (metadata = {}) => {
  const source = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {};

  const rawNbs = source.codigoNbs ?? source.codigo_nbs;
  if (rawNbs !== undefined && rawNbs !== null && String(rawNbs).trim() !== '') {
    const nbs = normalizeCodigoNbs(rawNbs);
    if (!nbs) {
      throw new Error('NBS deve ter 9 dígitos numéricos (começando com 1).');
    }
  }

  const rawCIndOp = source.cIndOp ?? source.codigoOperacao;
  if (rawCIndOp !== undefined && rawCIndOp !== null && String(rawCIndOp).trim() !== '') {
    const cIndOp = normalizeCIndOp(rawCIndOp);
    if (!cIndOp) {
      throw new Error('Indicador de operação (cIndOp) deve ter 6 dígitos.');
    }
  }

  const rawCst = source.situacaoTributariaIbsCbs ?? source.cst ?? source.cstIbsCbs;
  if (rawCst !== undefined && rawCst !== null && String(rawCst).trim() !== '') {
    const cst = normalizeSituacaoTributariaIbsCbs(rawCst);
    if (!cst) {
      throw new Error('Situação tributária IBS/CBS (CST) deve ter 3 dígitos.');
    }
  }

  const rawClass = source.classificacaoTributariaIbsCbs ?? source.cClassTrib ?? source.classCode;
  if (rawClass !== undefined && rawClass !== null && String(rawClass).trim() !== '') {
    const classificacao = normalizeClassificacaoTributariaIbsCbs(rawClass);
    if (!classificacao) {
      throw new Error('Classificação tributária IBS/CBS deve ter 6 dígitos.');
    }
  }
};

/**
 * Preenche campos RTC mínimos no cabeçalho e em cada servico.ibscbs antes do POST PlugNotas.
 *
 * @param {Record<string, unknown>|null|undefined} payload
 * @param {{ simplesNacional?: boolean, codigoIbge?: string, nfseNacional?: boolean }} [options]
 * @returns {Record<string, unknown>|null|undefined}
 */
export const enrichNfseReformaCabecalhoInEmitPayload = (payload, options = {}) => {
  if (!payload || typeof payload !== 'object') return payload;

  const codigoIbge = String(
    options.codigoIbge
    ?? readCodigoIbgeFromEmpresa({ endereco: payload?.prestador?.endereco })
    ?? payload?.prestador?.endereco?.codigoCidade
    ?? '',
  ).replace(/\D/g, '').slice(0, 7);

  if (!requiresIssnetRtcEmitSchema(codigoIbge)) {
    return payload;
  }

  const simplesNacional = options.simplesNacional !== false
    && payload.simplesNacional !== false;

  const finNFSe = resolveFinNfseValue(payload);
  const operacaoPessoal = resolveOperacaoPessoalValue(
    payload.indFinal ?? payload.indFinalNfse ?? payload?.ibscbs?.operacaoPessoal,
  );

  const servicos = Array.isArray(payload.servico)
    ? payload.servico
    : payload.servico && typeof payload.servico === 'object'
      ? [payload.servico]
      : [];

  const servicoEnriched = servicos.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const itemIbscbs = item.ibscbs && typeof item.ibscbs === 'object' && !Array.isArray(item.ibscbs)
      ? item.ibscbs
      : {};
    const ibscbs = buildMinimalServicoIbscbs(itemIbscbs, {
      finNFSe,
      operacaoPessoal,
      servico: item,
      simplesNacional,
    });
    const {
      situacaoTributariaIbsCbs: _st,
      classificacaoTributariaIbsCbs: _ct,
      cClassTrib: _cc,
      ibscbs: _oldIbscbs,
      ...servicoRest
    } = item;
    const iss = servicoRest.iss && typeof servicoRest.iss === 'object' ? servicoRest.iss : {};
    const codigoTributacao = servicoRest.codigoTributacao
      ?? resolveCodigoTributacaoIssnetFromAliquota(iss.aliquota);
    return {
      ...servicoRest,
      ...(codigoTributacao ? { codigoTributacao } : {}),
      ibscbs,
    };
  });

  const {
    ibscbs: _rootIbscbs,
    finNFSe: _fin,
    finNfse: _fin2,
    finalidadeNFSe: _finalidade,
    finalidadeNfse: _finalidade2,
    indFinal: _indFinal,
    cIndOp: _cIndOp,
    emitente: _existingEmitente,
    versao: _existingVersao,
    versaoEsquema: _existingVersaoEsquema,
    ...payloadRest
  } = payload;

  const nfseNacional = options.nfseNacional === true;

  const emitente = codigoIbge.length === 7
    ? {
      ...(payload.emitente && typeof payload.emitente === 'object' ? payload.emitente : {}),
      tipo: Number(payload?.emitente?.tipo) === 2 ? 2 : 1,
      codigoCidade: codigoIbge,
    }
    : undefined;

  const rtcHeader = {
    versao: payload.versao ?? NFSE_VERSAO_LAYOUT_NACIONAL,
    versaoEsquema: payload.versaoEsquema ?? NFSE_VERSAO_ESQUEMA_RTC007,
  };

  return {
    ...payloadRest,
    ...rtcHeader,
    ...(simplesNacional && payloadRest.naturezaTributacao == null ? { naturezaTributacao: 1 } : {}),
    ...(emitente ? { emitente } : {}),
    ...(servicoEnriched.length ? { servico: servicoEnriched } : {}),
  };
};
