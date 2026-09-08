/**
 * NFS-e Nacional / ISSNET: grupo `obra` obrigatório (rejeição E0370) para itens LC 116 de construção civil.
 * @see NT NFS-e Nacional — serv/obra
 */

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
 * @param {Record<string, unknown>|null|undefined} servicoInput
 * @param {Record<string, unknown>|null|undefined} emitInput
 * @param {Record<string, unknown>|null|undefined} tomadorEndereco
 * @returns {Record<string, unknown>|null}
 */
export const buildNfseObraPayload = (servicoInput, emitInput, tomadorEndereco) => {
  const codigo = servicoInput?.codigo ?? servicoInput?.codigoServico;
  if (!requiresNfseObraForServicoCodigo(codigo)) return null;

  const obraSource = readObraSource(servicoInput) || readObraSource(emitInput) || {};
  const endereco = resolveNfseObraEndereco(servicoInput, emitInput, tomadorEndereco);
  const cno = normalizeOptionalText(obraSource.cno, 30);
  const cei = normalizeOptionalText(obraSource.cei, 30);
  const art = normalizeOptionalText(obraSource.art, 30);
  const codigoObra = normalizeOptionalText(
    obraSource.codigoObra ?? obraSource.codigo,
    30,
  );

  const payload = {
    ...(cno ? { cno } : {}),
    ...(cei ? { cei } : {}),
    ...(art ? { art } : {}),
    ...(codigoObra ? { codigo: codigoObra } : {}),
    ...(endereco ? { endereco } : {}),
  };

  return Object.keys(payload).length ? payload : null;
};

/**
 * @param {Record<string, unknown>|null|undefined} obra
 * @returns {string|null} mensagem de erro ou null
 */
export const validateNfseObraPayload = (obra) => {
  if (!obra || typeof obra !== 'object') {
    return 'Informe os dados da obra (local onde o serviço foi executado).';
  }
  const endereco = obra.endereco;
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
  return null;
};

/**
 * @param {Record<string, unknown>} servico
 * @param {Record<string, unknown>|null|undefined} servicoInput
 * @param {Record<string, unknown>|null|undefined} emitInput
 * @param {Record<string, unknown>|null|undefined} tomadorEndereco
 * @returns {Record<string, unknown>}
 */
export const attachNfseObraToServico = (servico, servicoInput, emitInput, tomadorEndereco) => {
  if (!requiresNfseObraForServicoCodigo(servico?.codigo)) return servico;
  const obra = buildNfseObraPayload(servicoInput, emitInput, tomadorEndereco);
  if (!obra) return servico;
  return { ...servico, obra };
};
