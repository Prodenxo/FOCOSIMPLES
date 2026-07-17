/**
 * Paridade com `frontend/src/utils/meiLimiteFaturamento.ts`: somatório do limite MEI
 * a partir de `response_json` (prioridade) e `payload_json` (servico[].valor.liquido | servico).
 */

/** Manter igual a `MEI_LIMITE_ANO_CIVIL_TZ` no frontend. */
export const MEI_LIMITE_ANO_CIVIL_TZ = 'America/Sao_Paulo';

const NFSE = 'NFSE';

/**
 * Somatório do limite MEI (FR-GUIA-FISC-17): apenas **NFSE** entra no agregado; NFE/NFCE ficam de fora até PRD futuro.
 * Paridade com `isDocumentTypeMeiLimiteRelevante` no frontend.
 */
export function isDocumentTypeMeiLimiteRelevante(documentType) {
  const dt = String(documentType ?? '').trim().toUpperCase();
  return dt === NFSE;
}

function nfseStatusAsciiLower(status) {
  return String(status || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function nfseStatusKeyParaLimite(status) {
  const text = String(status || '').toLowerCase();
  const ascii = nfseStatusAsciiLower(status);
  if (!ascii) return 'processando';
  if (ascii.includes('cancelamento_pendente')
    || (ascii.includes('cancelamento') && ascii.includes('pendente'))) {
    return 'cancelamento_pendente';
  }
  if (ascii.includes('concluido') || ascii.includes('concluida') || ascii.includes('autoriz')) {
    return 'concluido';
  }
  if (ascii.includes('process')) return 'processando';
  if (ascii.includes('rejeit')) return 'rejeitado';
  if (ascii.includes('cancel')) return 'cancelado';
  if (ascii.includes('interromp')) return 'interrompido';
  return text;
}

export function nfseDeveEntrarNoSomatorioLimite(status) {
  return nfseStatusKeyParaLimite(status) === 'concluido';
}

export function parseValorMonetarioBr(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/\u00a0/g, '');
  if (!s) return null;
  s = s.replace(/^R\$\s*/i, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && (!hasDot || s.lastIndexOf(',') > s.lastIndexOf('.'))) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && hasDot) {
    s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizarPayloadJsonNfse(input) {
  if (input === null || input === undefined) return null;
  let current = input;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current === 'string') {
      const t = current.trim();
      if (!t) return null;
      try {
        current = JSON.parse(t);
        continue;
      } catch {
        return null;
      }
    }
    if (Array.isArray(current) && current.length === 1) {
      current = current[0];
      continue;
    }
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return current;
    }
    return null;
  }
  return null;
}

function resolverPayloadJsonDaNota(record) {
  const raw = record?.payload_json ?? record?.payloadJson;
  return normalizarPayloadJsonNfse(raw);
}

function resolverResponseJsonDaNota(record) {
  const raw = record?.response_json ?? record?.responseJson;
  return normalizarPayloadJsonNfse(raw);
}

function hasServicoInObj(obj) {
  const s = obj.servico ?? obj.servicos;
  return s != null;
}

export function isNfseDocumentoRow(record) {
  const dt = String(record?.document_type ?? '').trim().toUpperCase();
  if (dt !== '') {
    return isDocumentTypeMeiLimiteRelevante(record?.document_type);
  }
  const p = resolverPayloadJsonDaNota(record);
  if (p && hasServicoInObj(p)) return true;
  const r = resolverResponseJsonDaNota(record);
  return Boolean(r && hasServicoInObj(r));
}

function valorLimiteDeItemServico(item) {
  const valor = item.valor;
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const liq = parseValorMonetarioBr(valor.liquido);
    if (liq !== null && liq >= 0) return liq;
    const serv = parseValorMonetarioBr(valor.servico);
    if (serv !== null && serv >= 0) return serv;
  }
  const flat = item.valorServico ?? item.valorServiço ?? item.valor_servico;
  const n2 = parseValorMonetarioBr(flat);
  if (n2 !== null && n2 >= 0) return n2;
  return null;
}

export function extrairValorTotalServicosDeObjeto(raw) {
  if (!raw) return null;
  let servicos = raw.servico ?? raw.servicos;
  if (servicos && !Array.isArray(servicos)) {
    servicos = [servicos];
  }
  if (!Array.isArray(servicos)) return null;
  let sum = 0;
  let any = false;
  for (const item of servicos) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const n = valorLimiteDeItemServico(item);
    if (n !== null) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}

export function extrairValorLimiteMeiDaNota(record) {
  const resp = resolverResponseJsonDaNota(record);
  if (resp) {
    const fromResp = extrairValorTotalServicosDeObjeto(resp);
    if (fromResp !== null) return fromResp;
  }
  const payload = resolverPayloadJsonDaNota(record);
  return extrairValorTotalServicosDeObjeto(payload);
}

export function extrairValorServicoTotalDoPayload(payloadJson) {
  const raw = normalizarPayloadJsonNfse(payloadJson);
  return extrairValorTotalServicosDeObjeto(raw);
}

export function anoCivilFromIsoCreatedAt(createdAt) {
  if (!createdAt) return null;
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEI_LIMITE_ANO_CIVIL_TZ,
    year: 'numeric'
  }).formatToParts(parsed);
  const y = parts.find((p) => p.type === 'year')?.value;
  if (!y) return null;
  const n = parseInt(y, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Array<Record<string, unknown>>} rows - linhas com payload_json, response_json, status, created_at, document_type
 * @param {number} anoCivil
 * @returns {{ total: number, notasConsideradas: number }}
 */
export function agregarLimiteMeiDasLinhas(rows, anoCivil) {
  let total = 0;
  let notasConsideradas = 0;
  for (const record of rows || []) {
    if (!isNfseDocumentoRow(record)) continue;
    if (!nfseDeveEntrarNoSomatorioLimite(record.status)) continue;
    const y = anoCivilFromIsoCreatedAt(record.created_at);
    if (y !== anoCivil) continue;
    const valor = extrairValorLimiteMeiDaNota(record);
    if (valor === null) continue;
    total += valor;
    notasConsideradas += 1;
  }
  return { total, notasConsideradas };
}
