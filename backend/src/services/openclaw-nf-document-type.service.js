/**
 * NFS-e (serviço) vs NF-e (produto). O modelo erra; o servidor decide.
 */

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const text = value !== undefined && value !== null ? String(value).trim() : '';
    if (text) return text;
  }
  return '';
};

const collectPayloadText = (payload = {}) => [
  payload.documentType,
  payload.tipo,
  payload.type,
  payload.produtoNome,
  payload.produto,
  payload.descricao,
  payload.discriminacao,
  payload.servico,
  payload.item,
  payload.transcript,
  payload.mensagem,
  payload.mensagemUsuario,
  payload.texto,
  payload.utterance,
  payload.userMessage,
].filter((value) => typeof value === 'string' && value.trim())
  .join(' ');

const SERVICE_EXPLICIT_RE = /\b(nfs-?e|nota\s+de\s+servi[cç]o|c[oó]digo\s+de\s+servi[cç]o|presta[cç][aã]o\s+de\s+servi[cç]o|consultoria|assessoria|honor[aá]rios)\b/i;

const PRODUCT_EXPLICIT_RE = /\b(nf-?e|nfc-?e|nota\s+de\s+produto|mercadoria|\bsku\b|\bncm\b)\b/i;

const PHYSICAL_GOODS_RE = /\b(camiseta|camisa|cal[cç]a|bermuda|short|vestido|saia|blusa|jaqueta|casaco|moletom|t[eê]nis|sapato|chinelo|sand[aá]lia|meia|bon[eé])\b/i;

export const collectOpenclawNfItemLabel = (payload = {}) => firstNonEmpty(
  payload.produtoNome,
  payload.produto,
  payload.descricao,
  payload.discriminacao,
  payload.servico,
  payload.item,
);

export const inferOpenclawNfDocumentType = (payload = {}) => {
  const raw = String(payload?.documentType || payload?.tipo || payload?.type || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '');
  if (['NFE', 'NFCE', 'PRODUTO', 'PRODUTOS', 'PRODUCT', 'PRODUCTS'].includes(raw)) {
    return 'NFE';
  }
  if (['NFSE', 'SERVICO', 'SERVICOS', 'SERVICE', 'SERVICES'].includes(raw)) {
    return 'NFSE';
  }

  const text = collectPayloadText(payload);
  if (SERVICE_EXPLICIT_RE.test(text)) return 'NFSE';
  if (PRODUCT_EXPLICIT_RE.test(text) || PHYSICAL_GOODS_RE.test(text)) return 'NFE';
  return null;
};

const remapNfsePayloadToNfe = (payload = {}) => {
  const produtoNome = collectOpenclawNfItemLabel(payload);
  return {
    ...payload,
    documentType: 'NFE',
    destinatarioNome: firstNonEmpty(
      payload.destinatarioNome,
      payload.destinatarioRazaoSocial,
      payload.tomadorNome,
      payload.tomadorRazaoSocial,
      payload.cliente,
    ),
    ...(produtoNome ? { produtoNome } : {}),
  };
};

/**
 * Se o agente pediu NFS-e para mercadoria, troca para NF-e no servidor.
 * @param {string} action
 * @param {Record<string, unknown>} payload
 * @returns {{ action: string, payload: Record<string, unknown>, reroutedFrom?: string }}
 */
export const rerouteOpenclawNfseProductToNfe = (action, payload = {}) => {
  const nextAction = String(action || '').trim();
  if (nextAction !== 'preview_nfse' && nextAction !== 'emit_nfse') {
    return { action: nextAction, payload };
  }
  if (inferOpenclawNfDocumentType(payload) !== 'NFE') {
    return { action: nextAction, payload };
  }
  return {
    action: nextAction === 'emit_nfse' ? 'emit_nfe' : 'preview_nfe',
    payload: remapNfsePayloadToNfe(payload),
    reroutedFrom: nextAction,
  };
};
