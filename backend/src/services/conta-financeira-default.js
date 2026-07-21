/** Nome da carteira/conta padrão do produto Foco Simples. */
export const DEFAULT_CONTA_NOME = 'Foco Simples';

const DEFAULT_CONTA_NAME_KEYS = [
  'foco simples',
  'focosimples',
  'meu financeiro',
  'carteira',
  'carteira principal',
  'dinheiro',
  'principal',
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const normalizeContaNomeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/**
 * Escolhe a conta/carteira padrão do utilizador (ativa).
 * @param {Array<{ id?: string, nome?: string, tipo?: string, ativo?: boolean, criado_em?: string }>} contas
 */
export const pickDefaultContaFinanceira = (contas = []) => {
  const active = contas.filter((c) => c?.ativo !== false);
  if (!active.length) return null;

  const findByKeys = (keys) =>
    active.find((c) => keys.includes(normalizeContaNomeKey(c?.nome)));

  const branded = findByKeys([normalizeContaNomeKey(DEFAULT_CONTA_NOME)]);
  if (branded) return branded;

  const alias = findByKeys(DEFAULT_CONTA_NAME_KEYS);
  if (alias) return alias;

  const dinheiro = active.filter((c) => c?.tipo === 'dinheiro');
  if (dinheiro.length === 1) return dinheiro[0];
  if (dinheiro.length > 1) {
    const hinted = dinheiro.find((c) => {
      const key = normalizeContaNomeKey(c?.nome);
      return DEFAULT_CONTA_NAME_KEYS.some((hint) => key.includes(hint));
    });
    if (hinted) return hinted;
  }

  if (active.length === 1) return active[0];

  const sorted = [...active].sort((a, b) => {
    const ta = new Date(a?.criado_em || 0).getTime();
    const tb = new Date(b?.criado_em || 0).getTime();
    return ta - tb;
  });
  return sorted[0] ?? null;
};

/**
 * @param {Array<{ id?: string, nome?: string, ativo?: boolean }>} contas
 * @param {string} rawName
 */
export const matchContaByName = (contas, rawName) => {
  const key = normalizeContaNomeKey(rawName);
  if (!key) return null;
  const active = contas.filter((c) => c?.ativo !== false);
  const exact = active.find((c) => normalizeContaNomeKey(c?.nome) === key);
  if (exact) return exact;
  return (
    active.find((c) => {
      const nomeKey = normalizeContaNomeKey(c?.nome);
      return nomeKey.includes(key) || key.includes(nomeKey);
    }) ?? null
  );
};

const CONTA_TIPO_HINTS = {
  poupanca: 'poupanca',
  poupança: 'poupanca',
  corrente: 'corrente',
  cartao: 'cartao_credito',
  cartão: 'cartao_credito',
  'cartao de credito': 'cartao_credito',
  'cartão de crédito': 'cartao_credito',
  credito: 'cartao_credito',
  crédito: 'cartao_credito',
  dinheiro: 'dinheiro',
};

/**
 * Nome explícito de carteira no payload (sem inferir de obs).
 * @param {object} payload
 * @returns {string}
 */
export const getWalletNameFromPayload = (payload = {}) =>
  String(
    payload?.conta
    ?? payload?.conta_nome
    ?? payload?.contaNome
    ?? payload?.carteira
    ?? payload?.wallet
    ?? '',
  ).trim();

/**
 * Extrai menção de carteira em texto livre (ex.: "no Nubank", "na poupança").
 * @param {string} text
 * @returns {string}
 */
export const extractCarteiraHintFromText = (text) => {
  const s = String(text || '').trim();
  if (!s) return '';

  const tipoOnly = s.match(
    /\b(poupan[cç]a|corrente|cart[aã]o(?:\s+de\s+cr[eé]dito)?|dinheiro)\b/i,
  );
  if (tipoOnly?.[1]) return tipoOnly[1].trim();

  const phrase = s.match(
    /\b(?:na|no|em|pela|pelo|carteira|conta)\s+([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s.-]{1,28})/i,
  );
  return phrase?.[1]?.trim() ?? '';
};

/**
 * @param {Array<{ id?: string, nome?: string, tipo?: string, ativo?: boolean }>} contas
 * @param {string} rawHint
 * @returns {{ id?: string, nome?: string, tipo?: string, ativo?: boolean } | null}
 */
export const matchContaByTipoHint = (contas, rawHint) => {
  const key = normalizeContaNomeKey(rawHint);
  if (!key) return null;
  const tipo = CONTA_TIPO_HINTS[key];
  if (!tipo) return null;
  const active = contas.filter((c) => c?.ativo !== false && c?.tipo === tipo);
  if (active.length === 1) return active[0];
  return null;
};

/**
 * Resolve carteira só com campos explícitos do payload (sem default).
 * @returns {{ id?: string, nome?: string, tipo?: string, ativo?: boolean } | null}
 */
export const resolveExplicitContaFromPayload = (contas = [], payload = {}) => {
  const explicit =
    payload?.conta_id ?? payload?.contaId ?? payload?.conta_uuid ?? payload?.id ?? null;
  if (explicit) {
    const id = String(explicit).trim();
    if (UUID_RE.test(id)) {
      const found = contas.find((c) => String(c?.id) === id && c?.ativo !== false);
      if (found) return found;
      return null;
    }
  }

  const nameRaw = getWalletNameFromPayload(payload);
  if (nameRaw) {
    return matchContaByName(contas, nameRaw) ?? matchContaByTipoHint(contas, nameRaw);
  }

  return null;
};

/**
 * Resolve conta_id a partir do payload do bot ou fallback padrão.
 * @returns {string | null}
 */
export const resolveContaIdFromPayload = (contas = [], payload = {}) => {
  const matched = resolveExplicitContaFromPayload(contas, payload);
  if (matched?.id) return matched.id;
  return pickDefaultContaFinanceira(contas)?.id ?? null;
};
