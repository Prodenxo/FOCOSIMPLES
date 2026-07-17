/**
 * Política BFF: `rps` no POST /empresa (canónico ou valores do cliente); PATCH pode enviar `rps` quando o cliente os inclui.
 * @see docs/technical/architecture-plugnotas-empresa-rps-inicial-2026-04-16.md
 */

/** Bloco canónico PlugNotas quando o cliente não envia `rps`. */
export const EMPRESA_PLUGNOTAS_RPS_INICIAL_POST = Object.freeze({
  lote: 1,
  numeracao: Object.freeze([Object.freeze({ numero: 1, serie: '1' })])
});

/** Contrato PlugNotas em `nfse.config.rps` (série, número, lote). */
export const EMPRESA_PLUGNOTAS_NFSE_CONFIG_RPS_CANONICAL = Object.freeze({
  serie: '1',
  numero: 1,
  lote: 1
});

const parsePositiveInt = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(n) && n >= 1) return n;
  return fallback;
};

/**
 * @param {unknown} rps
 * @returns {boolean}
 */
export const hasClientRpsShape = (rps) => {
  if (!rps || typeof rps !== 'object' || Array.isArray(rps)) return false;
  const numeracao = rps.numeracao;
  if (!Array.isArray(numeracao) || numeracao.length < 1) return false;
  const first = numeracao[0];
  if (!first || typeof first !== 'object' || Array.isArray(first)) return false;
  return true;
};

/**
 * Normaliza `payload.rps` para o contrato PlugNotas (muta o objeto).
 * @param {Record<string, unknown>|null|undefined} payload
 */
export const sanitizeEmpresaPlugnotasRpsPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  if (!Object.prototype.hasOwnProperty.call(payload, 'rps')) return;
  const raw = payload.rps;
  if (!hasClientRpsShape(raw)) {
    delete payload.rps;
    return;
  }
  const lot = parsePositiveInt(raw.lote, 1);
  const first = raw.numeracao[0];
  const num = parsePositiveInt(first.numero, 1);
  let ser = first.serie != null ? String(first.serie).trim() : '';
  if (!ser) ser = '1';
  payload.rps = {
    lote: lot,
    numeracao: [{ numero: num, serie: ser }]
  };
};

/**
 * POST /empresa: aplica `rps` canónico só se o cliente não enviou bloco utilizável; caso contrário sanitiza o enviado.
 * @param {Record<string, unknown>|null|undefined} payload
 */
export const normalizeNfseConfigRps = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPRESA_PLUGNOTAS_NFSE_CONFIG_RPS_CANONICAL };
  }
  const numeracaoFirst = Array.isArray(raw.numeracao) ? raw.numeracao[0] : null;
  const serie = String(raw.serie ?? numeracaoFirst?.serie ?? '').trim() || '1';
  const numero = parsePositiveInt(raw.numero ?? numeracaoFirst?.numero, 1);
  const lote = parsePositiveInt(raw.lote, 1);
  // PlugNotas PATCH: `nfse.config.rps` aceita só serie/numero/lote — sem `numeracao`.
  return { serie, numero, lote };
};

/**
 * @param {unknown} empresa
 * @returns {boolean}
 */
export const hasNfseConfigRpsShape = (empresa) => {
  if (!empresa || typeof empresa !== 'object' || Array.isArray(empresa)) return false;
  const nfse = empresa.nfse;
  if (!nfse || typeof nfse !== 'object' || Array.isArray(nfse) || nfse.ativo === false) return false;
  const rps = nfse.config?.rps;
  if (!rps || typeof rps !== 'object' || Array.isArray(rps)) return false;
  if (hasClientRpsShape(rps)) return true;
  const serie = String(rps.serie ?? '').trim();
  const numero = parsePositiveInt(rps.numero, NaN);
  return Boolean(serie) && Number.isFinite(numero) && numero >= 1;
};

/**
 * Garante `nfse.config.rps` quando NFS-e está activa no payload empresa.
 * @param {Record<string, unknown>|null|undefined} payload
 */
export const applyEmpresaPlugnotasNfseConfigRps = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  const nfse = payload.nfse;
  if (!nfse || typeof nfse !== 'object' || Array.isArray(nfse) || nfse.ativo === false) return;
  const config = nfse.config && typeof nfse.config === 'object' && !Array.isArray(nfse.config)
    ? { ...nfse.config }
    : { producao: true };
  config.rps = normalizeNfseConfigRps(config.rps);
  payload.nfse = { ...nfse, config };
};

export const applyEmpresaPlugnotasRpsInicialForPost = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
  if (hasClientRpsShape(payload.rps)) {
    sanitizeEmpresaPlugnotasRpsPayload(payload);
  } else {
    payload.rps = {
      lote: 1,
      numeracao: [{ numero: 1, serie: '1' }]
    };
  }
  applyEmpresaPlugnotasNfseConfigRps(payload);
};

/**
 * Remove `rps` do corpo (fallback POST conflito → PATCH). Muta o objeto.
 * @param {Record<string, unknown>|null|undefined} payload
 * @returns {typeof payload}
 */
export const stripRpsFromEmpresaPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'rps')) {
    delete payload.rps;
  }
  return payload;
};

/**
 * Clona o bloco canónico para PATCH de reparo (empresas criadas via POST→PATCH sem `rps`).
 * @returns {{ lote: number, numeracao: Array<{ numero: number, serie: string }> }}
 */
export const cloneEmpresaPlugnotasRpsInicialPost = () => ({
  lote: EMPRESA_PLUGNOTAS_RPS_INICIAL_POST.lote,
  numeracao: [{ numero: 1, serie: '1' }]
});
