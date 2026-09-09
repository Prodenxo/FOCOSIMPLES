/**
 * Normalização de registros `mei_nfse` (snake_case + payload_json) para a UI web.
 */

export function getNfseStatusKey(status) {
  const text = String(status || '').toLowerCase();
  if (!text) return 'aguardando';
  if (text.includes('cancelamento_pendente')) return 'cancelamento_pendente';
  if (text.includes('aguardando')) return 'aguardando';
  if (text.includes('concluido') || text.includes('concluida') || text.includes('autoriz')) return 'concluido';
  if (text.includes('process')) return 'processando';
  if (text.includes('rejeit')) return 'rejeitado';
  if (text.includes('cancel')) return 'cancelado';
  if (text.includes('interromp')) return 'interrompido';
  return text;
}

export function formatNfseStatus(status) {
  const key = getNfseStatusKey(status);
  if (key === 'aguardando') return 'Aguardando';
  if (key === 'concluido') return 'Concluída';
  if (key === 'processando') return 'Processando';
  if (key === 'rejeitado') return 'Rejeitada';
  if (key === 'cancelado') return 'Cancelada';
  if (key === 'cancelamento_pendente') return 'Cancelamento pendente';
  if (key === 'interrompido') return 'Interrompida';
  return status || '—';
}

export function notaFiscalStatusPrecisaSyncAutomatico(status) {
  const key = getNfseStatusKey(status);
  return key === 'aguardando' || key === 'processando' || key === 'cancelamento_pendente';
}

export function notaFiscalPodeSincronizarEstadoEmissor(record) {
  if (!record) return false;
  if (record.plugnotas_id) return true;
  if (record.protocol) return true;
  if (record.id_integracao && record.cnpj_prestador) {
    const digits = String(record.cnpj_prestador).replace(/\D/g, '');
    return digits.length >= 11;
  }
  return false;
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function pickNome(value) {
  return String(value ?? '').trim();
}

function parseValorMonetario(value) {
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

export function normalizePayloadJson(input) {
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

export function formatNotaIntegracaoLabel(idIntegracao) {
  const raw = String(idIntegracao || '').trim();
  if (!raw) return '';
  return raw.replace(/^(mei|fs|sn|nfse|nfe|nfce)-/i, '');
}

export function extractNotaClienteNome(record) {
  const sources = [
    normalizePayloadJson(record?.payload_json ?? record?.payloadJson),
    normalizePayloadJson(record?.response_json ?? record?.responseJson),
  ];
  for (const src of sources) {
    if (!src) continue;
    const tomador = asRecord(src.tomador) || asRecord(src.tomadores);
    const destinatario = asRecord(src.destinatario) || asRecord(src.destinatarioNota);
    const nome =
      pickNome(tomador?.razaoSocial)
      || pickNome(tomador?.nome)
      || pickNome(destinatario?.razaoSocial)
      || pickNome(destinatario?.nome)
      || pickNome(src.tomadorRazaoSocial)
      || pickNome(src.destinatarioRazaoSocial);
    if (nome) return nome;
  }
  return '';
}

function valorDeItemServico(item) {
  const valor = item.valor;
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const liq = parseValorMonetario(valor.liquido);
    if (liq !== null && liq >= 0) return liq;
    const serv = parseValorMonetario(valor.servico);
    if (serv !== null && serv >= 0) return serv;
  }
  const flat = item.valorServico ?? item.valorServiço ?? item.valor_servico;
  const n = parseValorMonetario(flat);
  return n !== null && n >= 0 ? n : null;
}

function valorTotalServicos(raw) {
  if (!raw) return null;
  let servicos = raw.servico ?? raw.servicos;
  if (servicos && !Array.isArray(servicos)) servicos = [servicos];
  if (!Array.isArray(servicos)) return null;
  let sum = 0;
  let any = false;
  for (const item of servicos) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const n = valorDeItemServico(item);
    if (n !== null) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}

function valorUnitarioDeItem(item) {
  const vu = item.valorUnitario;
  if (vu && typeof vu === 'object' && !Array.isArray(vu)) {
    const c = parseValorMonetario(vu.comercial);
    if (c !== null && c >= 0) return c;
    const t = parseValorMonetario(vu.tributavel);
    if (t !== null && t >= 0) return t;
  }
  return parseValorMonetario(vu);
}

function quantidadeDeItem(item) {
  const q = item.quantidade;
  if (q && typeof q === 'object' && !Array.isArray(q)) {
    const c = parseValorMonetario(q.comercial);
    if (c !== null && c >= 0) return c;
    const t = parseValorMonetario(q.tributavel);
    if (t !== null && t >= 0) return t;
  }
  return parseValorMonetario(q);
}

function valorDeItemProduto(item) {
  const direct = parseValorMonetario(item.valor);
  if (direct !== null && direct >= 0) return direct;
  const q = quantidadeDeItem(item);
  const vu = valorUnitarioDeItem(item);
  if (q !== null && vu !== null) {
    const total = q * vu;
    return Number.isFinite(total) && total >= 0 ? total : null;
  }
  return null;
}

function valorTotalItens(raw) {
  if (!raw) return null;
  let itens = raw.itens ?? raw.items;
  if (itens && !Array.isArray(itens)) itens = [itens];
  if (!Array.isArray(itens)) return null;
  let sum = 0;
  let any = false;
  for (const item of itens) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const n = valorDeItemProduto(item);
    if (n !== null) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}

export function extractNotaValor(record) {
  const dt = String(record?.document_type ?? record?.documentType ?? '').trim().toUpperCase();
  const tryObj = (obj) => {
    if (!obj) return null;
    if (dt === 'NFE' || dt === 'NFCE') return valorTotalItens(obj);
    if (dt === 'NFSE') return valorTotalServicos(obj);
    return valorTotalServicos(obj) ?? valorTotalItens(obj);
  };
  const resp = normalizePayloadJson(record?.response_json ?? record?.responseJson);
  const fromResp = tryObj(resp);
  if (fromResp !== null) return fromResp;
  const payload = normalizePayloadJson(record?.payload_json ?? record?.payloadJson);
  return tryObj(payload);
}

function extractDestinatarioDocumento(record, payload) {
  const fromDb = String(record?.cnpj_tomador ?? '').replace(/\D/g, '');
  if (fromDb) return fromDb;
  const src = payload || normalizePayloadJson(record?.payload_json ?? record?.payloadJson);
  if (!src) return '';
  const tomador = asRecord(src.tomador);
  const destinatario = asRecord(src.destinatario);
  return String(
    tomador?.cpfCnpj
    || destinatario?.cpfCnpj
    || src.tomadorCpfCnpj
    || src.destinatarioCpfCnpj
    || '',
  ).replace(/\D/g, '');
}

function extractItens(record) {
  const payload = normalizePayloadJson(record?.payload_json ?? record?.payloadJson);
  const itens = payload?.itens ?? payload?.items;
  return Array.isArray(itens) ? itens : [];
}

/** Converte registro bruto da API para campos usados pela UI. */
export function normalizeNotaForUi(record) {
  if (!record) return record;
  const payload = normalizePayloadJson(record.payload_json ?? record.payloadJson);
  const documentType = record.document_type ?? record.documentType ?? null;
  const documento =
    record.plugnotas_id
    || record.protocol
    || formatNotaIntegracaoLabel(record.id_integracao)
    || record.id;

  return {
    ...record,
    documento,
    numero: record.numero || documento,
    cliente: extractNotaClienteNome(record),
    destinatarioNome: extractNotaClienteNome(record),
    destinatarioDocumento: extractDestinatarioDocumento(record, payload),
    valor: extractNotaValor(record),
    dataEmissao: record.created_at ?? record.dataEmissao ?? null,
    createdAt: record.created_at ?? record.createdAt ?? null,
    tipo: documentType,
    documentType,
    situacao: record.status,
    status: record.status,
    arquivada: Boolean(record.archived_at),
    archived: Boolean(record.archived_at),
    itens: extractItens(record),
  };
}
