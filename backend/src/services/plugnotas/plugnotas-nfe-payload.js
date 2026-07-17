/**
 * Normaliza itens NF-e/NFC-e para o JSON da Plugnotas.
 * Aceita números simples (formulário) ou objetos { comercial, tributavel }.
 */

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

export const toPlugnotasNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const nested = value.comercial ?? value.tributavel ?? value.valor;
    if (nested !== undefined && nested !== null && nested !== '') {
      return toPlugnotasNumber(nested);
    }
    return null;
  }
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
};

export const extractNfeItemQuantidade = (item) => {
  if (!item || typeof item !== 'object') return null;
  const raw = item.quantidade;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return toPlugnotasNumber(raw.comercial ?? raw.tributavel);
  }
  return toPlugnotasNumber(raw ?? item.quantidadeComercial);
};

export const extractNfeItemValorUnitario = (item) => {
  if (!item || typeof item !== 'object') return null;
  const raw = item.valorUnitario;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return toPlugnotasNumber(raw.comercial ?? raw.tributavel);
  }
  return toPlugnotasNumber(raw ?? item.valorUnitarioComercial ?? item.valor);
};

const prune = (value) => {
  if (Array.isArray(value)) {
    const list = value.map(prune).filter((item) => item !== undefined);
    return list.length ? list : undefined;
  }
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, item]) => {
      const cleaned = prune(item);
      if (cleaned !== undefined) {
        next[key] = cleaned;
      }
    });
    return Object.keys(next).length ? next : undefined;
  }
  if (value === null || value === undefined || value === '') return undefined;
  return value;
};

const normalizeNfeIcmsForPlugnotas = (icms) => {
  const block = toObject(icms);
  const origem = String(block.origem ?? '0').trim() || '0';
  const csosn = String(block.csosn || '').trim();
  const cst = String(block.cst || '').trim();
  if (csosn) {
    return prune({ ...block, origem, cst: csosn, csosn: undefined });
  }
  if (cst) {
    return prune({ ...block, origem, cst });
  }
  return prune({ ...block, origem });
};

/** CST PIS/COFINS usados por MEI/Simples sem incidência (NT 2009/004). */
const SIMPLES_PIS_COFINS_CSTS = new Set(['49', '99', '07', '08']);

/**
 * Plugnotas gera PISOutr incompleto (só vBC) se mandar só `cst: 49`.
 * Para Simples/MEI, exige baseCalculo { valor }, aliquota e valor zerados.
 */
export const normalizeNfePisCofinsForPlugnotasSn = (block) => {
  const raw = toObject(block);
  const cst = String(raw.cst || '').trim();
  if (!cst) return prune(raw);

  const normalizedCst = cst.padStart(2, '0').slice(0, 2);
  if (!SIMPLES_PIS_COFINS_CSTS.has(normalizedCst)) {
    return prune({ ...raw, cst: normalizedCst });
  }

  const baseCalculo = raw.baseCalculo;
  const baseValor = (
    baseCalculo && typeof baseCalculo === 'object' && !Array.isArray(baseCalculo)
      ? toPlugnotasNumber(baseCalculo.valor ?? baseCalculo.vBC)
      : toPlugnotasNumber(baseCalculo)
  ) ?? 0;

  return prune({
    ...raw,
    cst: normalizedCst,
    baseCalculo: { valor: baseValor },
    aliquota: toPlugnotasNumber(raw.aliquota) ?? 0,
    valor: toPlugnotasNumber(raw.valor) ?? 0,
  });
};

export const normalizeNfeItemForPlugnotasEmit = (item) => {
  if (!item || typeof item !== 'object') return item;

  const quantidade = extractNfeItemQuantidade(item);
  const valorUnitario = extractNfeItemValorUnitario(item);
  const valorTotal = toPlugnotasNumber(item.valor) ?? (
    quantidade !== null && valorUnitario !== null ? quantidade * valorUnitario : null
  );

  const tributos = toObject(item.tributos);
  const unidade = String(item.unidadeComercial || item.unidade || 'UN').trim() || 'UN';

  return prune({
    ...item,
    unidadeComercial: unidade,
    quantidade: quantidade !== null
      ? { comercial: quantidade, tributavel: quantidade }
      : undefined,
    valorUnitario: valorUnitario !== null
      ? { comercial: valorUnitario, tributavel: valorUnitario }
      : undefined,
    valor: valorTotal !== null && valorTotal > 0 ? valorTotal : undefined,
    tributos: prune({
      ...tributos,
      icms: normalizeNfeIcmsForPlugnotas(tributos.icms),
      pis: normalizeNfePisCofinsForPlugnotasSn(tributos.pis),
      cofins: normalizeNfePisCofinsForPlugnotasSn(tributos.cofins),
    }),
    unidade: undefined,
    quantidadeComercial: undefined,
    valorUnitarioComercial: undefined,
  }) || item;
};

const PRESENCIAL_REQUIRES_INTERMEDIADOR = new Set([2, 3, 4, 9]);

const normalizeDoc = (value) => String(value || '').replace(/\D/g, '');

/**
 * Plugnotas costuma gerar indIEDest=9 para CNPJ sem IE, mesmo com indIEDest=2 no JSON.
 */
export const destinatarioMapsToNaoContribuinteOnPlugnotas = (destinatario) => {
  const dest = toObject(destinatario);
  const indIEDest = String(dest.indIEDest ?? dest.indicadorInscricaoEstadual ?? '').trim();
  const ie = normalizeDoc(dest.inscricaoEstadual || '');
  const doc = normalizeDoc(dest.cpfCnpj || '');

  if (indIEDest === '9') return true;
  if (indIEDest === '1' && ie) return false;
  if (doc.length === 14 && !ie) return true;
  if (doc.length === 11) return true;
  return false;
};

/**
 * NT 2020.006: indPres 2/3/4/9 exige intermediador (0=sem, 1=com marketplace).
 * Plugnotas assume indPres=9 quando presencial não é enviado.
 * SEFAZ: indIEDest=9 exige indFinal=1 (consumidorFinal).
 */
export const normalizePlugnotasNfeIdeForEmit = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;

  const next = { ...payload };
  const presencialRaw = next.presencial;
  const presencial = presencialRaw === undefined || presencialRaw === null || presencialRaw === ''
    ? null
    : Number(presencialRaw);

  const needsIntermediador = presencial === null
    || Number.isNaN(presencial)
    || PRESENCIAL_REQUIRES_INTERMEDIADOR.has(presencial);

  if (needsIntermediador && next.intermediador == null) {
    next.intermediador = 0;
  }

  if (destinatarioMapsToNaoContribuinteOnPlugnotas(next.destinatario)) {
    next.consumidorFinal = true;
  }

  return next;
};

export const normalizePlugnotasNfePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const itens = Array.isArray(payload.itens)
    ? payload.itens.map(normalizeNfeItemForPlugnotasEmit)
    : payload.itens;
  const pagamentos = normalizeNfePagamentosForPlugnotas(payload.pagamentos);
  return normalizePlugnotasNfeIdeForEmit({ ...payload, itens, pagamentos });
};

const normalizeNfePagamentosForPlugnotas = (pagamentos) => {
  if (!Array.isArray(pagamentos)) return pagamentos;
  return pagamentos.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const meio = String(entry.meio ?? '').trim();
    const descricaoMeio = String(entry.descricaoMeio ?? '').trim();
    if (meio === '99' && !descricaoMeio) {
      return { ...entry, descricaoMeio: 'Outros' };
    }
    return entry;
  });
};
