/**
 * NBS (Nomenclatura Brasileira de Serviços) para NFS-e Nacional.
 * PlugNotas aceita `servico.codigoNbs` no JSON, mas não expõe catálogo NBS na API.
 * Defaults abaixo vêm da tabela de correlação LC 116 × NBS (Anexo VIII / referências gov.br).
 */

/** @type {Record<string, string>} código LC116 (6 dígitos) → NBS (9 dígitos) */
export const NFSE_LC116_NBS_DEFAULTS = {
  /** 14.01.01 — manutenção veículos rodoviários motorizados */
  '140101': '120013110',
  /** 06.03.01 — banhos, massagens e congêneres */
  '060301': '126023000',
  /** 17.06.01 — propaganda / promoção de vendas (campanhas publicitárias) */
  '170601': '114061100',
};

const LC116_KEY_LEN = 6;

/**
 * Normaliza código LC 116 para lookup (alfanumérico ASCII, sem máscara).
 * @param {unknown} codigo
 * @returns {string}
 */
export const normalizeLc116CodigoKey = (codigo) => {
  const raw = codigo == null ? '' : String(codigo).trim();
  if (!raw) return '';
  return raw.replace(/[^0-9A-Za-z]/g, '');
};

/**
 * Normaliza NBS para envio PlugNotas (9 dígitos numéricos).
 * @param {unknown} value
 * @returns {string|null}
 */
export const normalizeCodigoNbs = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 9) return null;
  if (digits[0] !== '1') return null;
  return digits;
};

/**
 * @param {string} codigoKey
 * @returns {string|null}
 */
export const lookupDefaultCodigoNbs = (codigoKey) => {
  const key = normalizeLc116CodigoKey(codigoKey);
  if (!key) return null;
  const padded = key.length >= LC116_KEY_LEN ? key.slice(0, LC116_KEY_LEN) : key.padStart(LC116_KEY_LEN, '0');
  const direct = NFSE_LC116_NBS_DEFAULTS[padded] || NFSE_LC116_NBS_DEFAULTS[key];
  if (!direct) return null;
  return normalizeCodigoNbs(direct);
};

/**
 * Resolve NBS para emissão: explícito no input > default por código LC 116.
 * @param {{ codigo?: unknown, codigoNbs?: unknown, codigo_nbs?: unknown }} input
 * @returns {string|undefined}
 */
export const resolveCodigoNbsForServico = (input = {}) => {
  const explicit = normalizeCodigoNbs(
    input.codigoNbs ?? input.codigo_nbs
  );
  if (explicit) return explicit;
  const fromCodigo = lookupDefaultCodigoNbs(input.codigo);
  return fromCodigo || undefined;
};

/**
 * Código complementar municipal (cTribMun) — PlugNotas: `servico.codigoTributacao`.
 * Padrão Nacional NFS-e: 3 dígitos. No RJ e na maioria dos municípios o valor exigido é `001`.
 * @param {unknown} value
 * @returns {string|null}
 */
export const normalizeCodigoTributacaoMunicipal = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  return digits.slice(0, 3).padStart(3, '0');
};

/**
 * Resolve cTribMun: explícito no input > default `001` (exigido pelo ADN em vários municípios, ex. RJ).
 * @param {{ codigoTributacao?: unknown, codigo_tributacao?: unknown, cTribMun?: unknown }} input
 * @returns {string}
 */
export const resolveCodigoTributacaoForServico = (input = {}) => {
  const explicit = normalizeCodigoTributacaoMunicipal(
    input.codigoTributacao ?? input.codigo_tributacao ?? input.cTribMun,
  );
  return explicit || '001';
};

/**
 * Regime de apuração dos tributos do SN (ADN `regApTribSN` / PlugNotas `regimeApuracaoTributaria`).
 * E0166 exige o campo para optante SN ME/EPP.
 * PlugNotas valida como número inteiro (1|2|3), não string.
 * 1 = trib. federais e municipais pelo SN (padrão DAS).
 * @param {{ regimeApuracaoTributaria?: unknown, regime_apuracao_tributaria?: unknown, regApTribSN?: unknown }} input
 * @returns {1|2|3}
 */
export const resolveRegimeApuracaoTributaria = (input = {}) => {
  const raw = input.regimeApuracaoTributaria
    ?? input.regime_apuracao_tributaria
    ?? input.regApTribSN
    ?? 1;
  const n = Number.parseInt(String(raw ?? '').trim(), 10);
  if (n === 1 || n === 2 || n === 3) return n;
  return 1;
};

/**
 * Enriquece linhas de `codigosservicos` com sugestão NBS (quando existir no mapa local).
 * @param {Array<{ codigo: string, descricao: string }>} rows
 * @returns {Array<{ codigo: string, descricao: string, codigo_nbs: string|null }>}
 */
export const enrichCodigosServicosComNbs = (rows = []) => (
  (Array.isArray(rows) ? rows : []).map((row) => ({
    codigo: row.codigo,
    descricao: row.descricao,
    codigo_nbs: lookupDefaultCodigoNbs(row.codigo),
  }))
);
