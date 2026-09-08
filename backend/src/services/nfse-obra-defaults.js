/**
 * NFS-e Nacional / ISSNET: grupo `obra` obrigatório (rejeição E0370) para itens LC 116 de construção civil.
 * PlugNotas JSON: `servico[].obra` aceita apenas art, codigo e cei — endereço vai em `cidadePrestacao` (raiz).
 * @see TecnoSpeed plugnotas-php Nfse/Servico/Obra.php
 */

/** CNO ausente — 12 dígitos (formato XSD); evita E160 com `codigo: "0"`. */
export const NFSE_OBRA_CODIGO_SEM_CADASTRO = '000000000000';

/** Subitens LC 116 que exigem informações de obra (E0370). */
export const NFSE_OBRA_REQUIRED_LC116_KEYS = Object.freeze(new Set([
  '070201', '070202',
  '070401',
  '070501', '070502',
  '070601', '070602',
  '070701',
  '070801',
  '071701',
  '071901',
  '141403', '141404',
]));

/**
 * @param {unknown} codigo
 * @returns {string}
 */
export const normalizeNfseServicoCodigoKey = (codigo) => {
  const digits = String(codigo || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits.padStart(6, '0');
};

/**
 * @param {unknown} codigo
 * @returns {boolean}
 */
export const requiresNfseObraForServicoCodigo = (codigo) => (
  NFSE_OBRA_REQUIRED_LC116_KEYS.has(normalizeNfseServicoCodigoKey(codigo))
);

/**
 * @param {unknown} value
 * @returns {string|null}
 */
const normalizeOptionalText = (value, maxLen) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return maxLen ? trimmed.slice(0, maxLen) : trimmed;
};

/**
 * @param {Record<string, unknown>|null|undefined} enderecoInput
 * @returns {Record<string, string>|null}
 */
export const buildNfseObraEndereco = (enderecoInput = {}) => {
  if (!enderecoInput || typeof enderecoInput !== 'object') return null;
  const cep = String(enderecoInput.cep || '').replace(/\D/g, '').slice(0, 8);
  const logradouro = normalizeOptionalText(enderecoInput.logradouro, 255);
  const numero = normalizeOptionalText(enderecoInput.numero, 60);
  const bairro = normalizeOptionalText(enderecoInput.bairro, 60);
  const complemento = normalizeOptionalText(enderecoInput.complemento, 156);
  const codigoCidade = normalizeOptionalText(enderecoInput.codigoCidade, 7);
  const estado = normalizeOptionalText(enderecoInput.estado || enderecoInput.uf, 2)?.toUpperCase() ?? null;
  const descricaoCidade = normalizeOptionalText(enderecoInput.descricaoCidade, 60);
  const tipoLogradouro = normalizeOptionalText(enderecoInput.tipoLogradouro, 60);

  if (!cep && !logradouro && !numero && !bairro) return null;

  return {
    ...(cep ? { cep } : {}),
    ...(logradouro ? { logradouro } : {}),
    ...(numero ? { numero } : {}),
    ...(bairro ? { bairro } : {}),
    ...(complemento ? { complemento } : {}),
    ...(codigoCidade ? { codigoCidade } : {}),
    ...(estado ? { estado } : {}),
    ...(descricaoCidade ? { descricaoCidade } : {}),
    ...(tipoLogradouro ? { tipoLogradouro } : {}),
  };
};

/**
 * @param {Record<string, unknown>|null|undefined} source
 * @returns {Record<string, unknown>|null|undefined}
 */
const readObraSource = (source) => {
  if (!source || typeof source !== 'object') return null;
  const nested = source.obra;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
  return null;
};

/**
 * Resolve endereço da obra: explícito > tomador (quando flag) > null.
 * @param {Record<string, unknown>|null|undefined} servicoInput
 * @param {Record<string, unknown>|null|undefined} emitInput
 * @param {Record<string, unknown>|null|undefined} tomadorEndereco
 * @returns {Record<string, string>|null}
 */
export const resolveNfseObraEndereco = (servicoInput, emitInput, tomadorEndereco) => {
  const obraSource = readObraSource(servicoInput) || readObraSource(emitInput);
  const usarTomador = obraSource?.usarEnderecoTomador !== false;
  const explicitEndereco = buildNfseObraEndereco(obraSource?.endereco);
  if (!usarTomador && explicitEndereco) return explicitEndereco;
  if (explicitEndereco?.cep && explicitEndereco?.logradouro && explicitEndereco?.numero && explicitEndereco?.bairro) {
    return explicitEndereco;
  }
  if (usarTomador) {
    return buildNfseObraEndereco(tomadorEndereco);
  }
  return explicitEndereco;
};

/**
 * @param {Record<string, unknown>|null|undefined} obraSource
 * @returns {string}
 */
export const resolveNfseObraCodigoForEmit = (obraSource = {}) => {
  const codigoObra = normalizeOptionalText(obraSource.codigoObra ?? obraSource.codigo, 30);
  const cno = normalizeOptionalText(obraSource.cno, 30);
  const cei = normalizeOptionalText(obraSource.cei, 30);
  return codigoObra || cno || cei || NFSE_OBRA_CODIGO_SEM_CADASTRO;
};

/**
 * Campos aceitos pela API PlugNotas em `servico[].obra` (sem endereço — evita E160 no XSD).
 * Sempre inclui `codigo` para o grupo não ser omitido pelo prune / PlugNotas (E0370).
 *
 * @param {Record<string, unknown>|null|undefined} servicoInput
 * @param {Record<string, unknown>|null|undefined} emitInput
 * @returns {Record<string, string>|null}
 */
export const buildNfseObraPayload = (servicoInput, emitInput) => {
  const codigo = servicoInput?.codigo ?? servicoInput?.codigoServico;
  if (!requiresNfseObraForServicoCodigo(codigo)) return null;

  const obraSource = readObraSource(servicoInput) || readObraSource(emitInput) || {};
  const cei = normalizeOptionalText(obraSource.cei, 30);
  const art = normalizeOptionalText(obraSource.art, 30);
  const codigoCadastro = resolveNfseObraCodigoForEmit(obraSource);

  return {
    codigo: codigoCadastro,
    ...(art ? { art } : {}),
    ...(cei && codigoCadastro !== cei ? { cei } : {}),
  };
};

/**
 * @param {Record<string, unknown>|null|undefined} endereco
 * @returns {string|null} mensagem de erro ou null
 */
export const validateNfseObraEndereco = (endereco) => {
  if (!endereco || typeof endereco !== 'object') {
    return 'Informe o endereço da obra (CEP, logradouro, número e bairro).';
  }
  const cep = String(endereco.cep || '').replace(/\D/g, '');
  if (cep.length !== 8) {
    return 'Informe o CEP da obra com 8 dígitos.';
  }
  if (!String(endereco.logradouro || '').trim()) {
    return 'Informe o logradouro da obra.';
  }
  if (!String(endereco.numero || '').trim()) {
    return 'Informe o número do endereço da obra.';
  }
  if (!String(endereco.bairro || '').trim()) {
    return 'Informe o bairro da obra.';
  }
  const codigoCidade = String(endereco.codigoCidade || '').replace(/\D/g, '').slice(0, 7);
  if (codigoCidade.length !== 7) {
    return 'Informe o município (código IBGE) do local da obra.';
  }
  return null;
};

/**
 * @param {Record<string, unknown>|null|undefined} obra
 * @returns {string|null} mensagem de erro ou null
 * @deprecated Valide com {@link validateNfseObraEndereco} no endereço resolvido.
 */
export const validateNfseObraPayload = (obra) => {
  if (!obra || typeof obra !== 'object') {
    return 'Informe os dados da obra (local onde o serviço foi executado).';
  }
  if (obra.endereco) {
    return validateNfseObraEndereco(obra.endereco);
  }
  return null;
};

/**
 * Município de incidência do ISS no serviço (PlugNotas: codigoCidadeIncidencia).
 * @param {Record<string, unknown>|null|undefined} endereco
 * @returns {Record<string, string>|null}
 */
export const buildServicoLocalIncidenciaFromEndereco = (endereco) => {
  if (!endereco || typeof endereco !== 'object') return null;
  const codigoCidadeIncidencia = String(endereco.codigoCidade || '').replace(/\D/g, '').slice(0, 7);
  if (codigoCidadeIncidencia.length !== 7) return null;
  const descricaoCidadeIncidencia = normalizeOptionalText(endereco.descricaoCidade, 60);
  return {
    codigoCidadeIncidencia,
    ...(descricaoCidadeIncidencia ? { descricaoCidadeIncidencia } : {}),
  };
};

/**
 * Monta `cidadePrestacao` (raiz) a partir do endereço da execução do serviço.
 * @param {Record<string, unknown>|null|undefined} endereco
 * @returns {Record<string, string>|null}
 */
export const buildCidadePrestacaoFromObraEndereco = (endereco) => {
  if (!endereco || typeof endereco !== 'object') return null;

  const codigo = String(endereco.codigoCidade || '').replace(/\D/g, '').slice(0, 7);
  if (codigo.length !== 7) return null;

  const estadoRaw = endereco.estado ?? endereco.uf;
  const estado = estadoRaw ? String(estadoRaw).trim().toUpperCase().slice(0, 2) : undefined;
  const descricao = normalizeOptionalText(endereco.descricaoCidade, 60);
  const cep = String(endereco.cep || '').replace(/\D/g, '').slice(0, 8);
  const logradouro = normalizeOptionalText(endereco.logradouro, 255);
  const numero = normalizeOptionalText(endereco.numero, 60);
  const bairro = normalizeOptionalText(endereco.bairro, 60);
  const complemento = normalizeOptionalText(endereco.complemento, 156);
  const tipoLogradouro = normalizeOptionalText(endereco.tipoLogradouro, 60);

  return {
    codigo,
    ...(descricao ? { descricao } : {}),
    ...(estado ? { estado } : {}),
    ...(cep ? { cep } : {}),
    ...(logradouro ? { logradouro } : {}),
    ...(numero ? { numero } : {}),
    ...(bairro ? { bairro } : {}),
    ...(complemento ? { complemento } : {}),
    ...(tipoLogradouro ? { tipoLogradouro } : {}),
  };
};

/**
 * @param {Record<string, unknown>|null|undefined} payload
 * @param {Array<Record<string, unknown>>} [servicosInput]
 * @param {Record<string, unknown>|null|undefined} [tomadorEndereco]
 * @returns {Record<string, string>|null}
 */
export const resolveCidadePrestacaoForObraPayload = (
  payload,
  servicosInput = [],
  tomadorEndereco = null,
) => {
  const servicos = Array.isArray(payload?.servico)
    ? payload.servico
    : payload?.servico && typeof payload.servico === 'object'
      ? [payload.servico]
      : [];
  const inputs = Array.isArray(servicosInput) ? servicosInput : [];
  const tomador = tomadorEndereco ?? payload?.tomador?.endereco ?? null;

  for (let index = 0; index < servicos.length; index += 1) {
    const servico = servicos[index];
    if (!servico || typeof servico !== 'object') continue;
    if (!requiresNfseObraForServicoCodigo(servico.codigo)) continue;

    const input = inputs[index] || {};
    const endereco = resolveNfseObraEndereco(input, input, tomador);
    const cidade = buildCidadePrestacaoFromObraEndereco(endereco);
    if (cidade) return cidade;
  }

  return null;
};

/**
 * @param {Record<string, unknown>} servico
 * @param {Record<string, unknown>|null|undefined} servicoInput
 * @param {Record<string, unknown>|null|undefined} emitInput
 * @returns {Record<string, unknown>}
 */
export const attachNfseObraToServico = (servico, servicoInput, emitInput) => {
  if (!requiresNfseObraForServicoCodigo(servico?.codigo)) return servico;
  const obra = buildNfseObraPayload(servicoInput, emitInput);
  if (!obra) return servico;
  return { ...servico, obra };
};

/**
 * Garante `servico[].obra` após prune — endereço continua em `cidadePrestacao` (raiz).
 *
 * @param {Record<string, unknown>|null|undefined} payload
 * @param {{ servicosInput?: Array<Record<string, unknown>>, emitInput?: Record<string, unknown>|null, tomadorEndereco?: Record<string, unknown>|null }} [options]
 * @returns {Record<string, unknown>|null|undefined}
 */
export const enrichNfseObraOnEmitPayload = (payload, options = {}) => {
  if (!payload || typeof payload !== 'object') return payload;

  const servicosInput = Array.isArray(options.servicosInput) ? options.servicosInput : [];
  const emitInput = options.emitInput && typeof options.emitInput === 'object' ? options.emitInput : null;
  const tomadorEndereco = options.tomadorEndereco ?? payload?.tomador?.endereco ?? null;

  const servicos = Array.isArray(payload.servico)
    ? payload.servico
    : payload.servico && typeof payload.servico === 'object'
      ? [payload.servico]
      : [];

  if (!servicos.length) return payload;

  const enriched = servicos.map((servico, index) => {
    if (!servico || typeof servico !== 'object') return servico;
    const servicoInput = servicosInput[index] || {};
    const inputRoot = emitInput || servicoInput;
    const endereco = resolveNfseObraEndereco(servicoInput, inputRoot, tomadorEndereco);
    const localIncidencia = buildServicoLocalIncidenciaFromEndereco(endereco);
    const withObra = attachNfseObraToServico(servico, servicoInput, inputRoot);
    if (!localIncidencia) return withObra;
    return {
      ...withObra,
      ...(!withObra.codigoCidadeIncidencia ? localIncidencia : {}),
    };
  });

  return {
    ...payload,
    servico: Array.isArray(payload.servico) ? enriched : enriched[0],
  };
};

/**
 * Para serviços de obra (LC 116 07.xx), o ISS incide no município da execução.
 * Preenche `cidadePrestacao` na raiz quando ausente (endereço NÃO vai em servico.obra).
 *
 * @param {Record<string, unknown>|null|undefined} payload
 * @param {{ servicosInput?: Array<Record<string, unknown>>, tomadorEndereco?: Record<string, unknown>|null }} [options]
 * @returns {Record<string, unknown>|null|undefined}
 */
export const enrichNfseCidadePrestacaoFromObra = (payload, options = {}) => {
  if (!payload || typeof payload !== 'object') return payload;

  const existing = payload.cidadePrestacao;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    const codigoExistente = String(existing.codigo || existing.codigoCidade || '')
      .replace(/\D/g, '')
      .slice(0, 7);
    if (codigoExistente.length === 7) return payload;
  }

  const cidade = resolveCidadePrestacaoForObraPayload(
    payload,
    options.servicosInput,
    options.tomadorEndereco,
  );
  if (!cidade) return payload;

  return {
    ...payload,
    cidadePrestacao: cidade,
  };
};
