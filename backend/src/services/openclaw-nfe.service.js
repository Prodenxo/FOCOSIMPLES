import { badRequest, forbidden } from '../utils/errors.js';
import { isValidCpfOrCnpj, normalizeDocDigits } from '../utils/cpf-cnpj.js';
import { getDocumentosAtivosMirror } from './mei-certificate-store.js';
import { lookupCnpjBrasilApi } from './cnpj-lookup.service.js';
import { enrichDestinatarioEnderecoForNfeEmit } from '../lib/nfe-destinatario-endereco.js';
import { recalculateNfeLikePayloadTaxForEmit } from '../lib/nfe-like-payload-tax-apply.js';
import { resolveFiscalTenantId } from '../lib/resolve-fiscal-tenant-id.js';
import { getBusinessTypeMirror } from './empresa-business-type.service.js';
import {
  criarCatalogoCliente,
  criarCatalogoProduto,
  emitirNota,
  listarCatalogoClientes,
  listarCatalogoProdutos,
} from './mei-notas.service.js';
import {
  parseValorReais,
  normalizeCatalogDiscriminacao,
  pickProdutoCatalogoByIndexResult,
  pickProdutoCatalogoByNomeResult,
  resolveOpenclawTomador,
  rethrowNfseErrorForBot,
  resolveEmitenteForNfseSetup,
  emitenteMissingAddressFields,
  emitenteToPrestadorInput,
} from './openclaw-nfse.service.js';
import {
  isNfEmitConfirmed,
  isVagueNfItemLabel,
  formatNfeCatalogChoiceMessage,
  formatNfCatalogAmbiguousMessage,
  formatNfCatalogNotFoundMessage,
  formatNfeEmitErrorForUser,
  BOT_NF_EMIT_FAILED_INSTRUCTION,
  BOT_NF_EMIT_SUCCESS_GUARD,
} from './openclaw-nf-user-messages.js';
import {
  buildOpenclawNfeEmitFingerprint,
  runOpenclawEmitWithDedup,
} from './openclaw-nf-emit-dedup.service.js';

const normalizeDoc = (value) => normalizeDocDigits(value);

const MEI_DEFAULT_NFE_CSOSN = '102';
const MEI_DEFAULT_NFE_PIS_COFINS_CST = '49';

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const firstNonEmpty = (...values) => {
  for (const v of values) {
    const s = v !== undefined && v !== null ? String(v).trim() : '';
    if (s) return s;
  }
  return '';
};

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

const readNfeCatalogMetadata = (raw) => {
  const o = toObject(raw);
  const str = (key) => (typeof o[key] === 'string' ? o[key] : undefined);
  return {
    ncm: str('ncm'),
    cfop: str('cfop'),
    unidade: str('unidade'),
    icmsCsosn: str('icmsCsosn') ?? str('icms_csosn'),
    pisCst: str('pisCst') ?? str('pis_cst'),
    cofinsCst: str('cofinsCst') ?? str('cofins_cst'),
  };
};

const nfeCatalogFieldsFromMetadata = (metadataJson) => {
  const meta = readNfeCatalogMetadata(metadataJson);
  return {
    ncm: onlyDigits(meta.ncm ?? '', 8),
    cfop: onlyDigits(meta.cfop ?? '5102', 4) || '5102',
    unidade: (meta.unidade ?? 'UN').trim() || 'UN',
    icmsCsosn: onlyDigits(meta.icmsCsosn ?? MEI_DEFAULT_NFE_CSOSN, 3) || MEI_DEFAULT_NFE_CSOSN,
    pisCst: onlyDigits(meta.pisCst ?? MEI_DEFAULT_NFE_PIS_COFINS_CST, 2) || MEI_DEFAULT_NFE_PIS_COFINS_CST,
    cofinsCst: onlyDigits(meta.cofinsCst ?? MEI_DEFAULT_NFE_PIS_COFINS_CST, 2) || MEI_DEFAULT_NFE_PIS_COFINS_CST,
  };
};

export const isCatalogProdutoUsableForNfe = (produto) => {
  const dt = String(produto?.document_type || '').toUpperCase();
  if (dt !== 'NFE' && dt !== 'NFCE') return false;
  const fields = nfeCatalogFieldsFromMetadata(produto?.metadata_json);
  if (fields.ncm.length !== 8) return false;
  if (fields.cfop.length !== 4) return false;
  if (!fields.unidade) return false;
  if (fields.icmsCsosn.length !== 3) return false;
  if (!fields.pisCst || !fields.cofinsCst) return false;
  return true;
};

const buildNfeCatalogMetadata = (fields) => ({
  ncm: onlyDigits(fields.ncm, 8),
  cfop: onlyDigits(fields.cfop, 4),
  unidade: String(fields.unidade || 'UN').trim() || 'UN',
  icmsCsosn: onlyDigits(fields.icmsCsosn, 3),
  pisCst: onlyDigits(fields.pisCst, 2),
  cofinsCst: onlyDigits(fields.cofinsCst, 2),
});

const hasCompleteNfeEndereco = (endereco) => {
  const e = toObject(endereco);
  if (normalizeDoc(e.cep).length !== 8) return false;
  if (!String(e.logradouro || '').trim()) return false;
  if (!String(e.numero || '').trim()) return false;
  if (!String(e.bairro || '').trim()) return false;
  if (onlyDigits(e.codigoCidade, 7).length !== 7) return false;
  if (!String(e.descricaoCidade || '').trim()) return false;
  if (String(e.estado || '').trim().toUpperCase().length !== 2) return false;
  return true;
};

const normalizeEnderecoFromPayload = (payload = {}) => {
  const src = toObject(payload.endereco || payload);
  const cep = normalizeDoc(src.cep || payload.cep).slice(0, 8);
  const codigoCidade = onlyDigits(src.codigoCidade || src.codigoIbge || payload.codigoCidade, 7);
  const estado = String(src.estado || src.uf || payload.estado || payload.uf || '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
  return {
    cep,
    logradouro: String(src.logradouro || payload.logradouro || '').trim(),
    numero: String(src.numero || payload.numero || '').trim(),
    bairro: String(src.bairro || payload.bairro || '').trim(),
    codigoCidade,
    descricaoCidade: String(src.descricaoCidade || src.cidade || payload.cidade || '').trim(),
    estado,
    ...(String(src.complemento || payload.complemento || '').trim()
      ? { complemento: String(src.complemento || payload.complemento).trim() }
      : {}),
  };
};

const enderecoFromCnpjLookup = (lookup) => {
  const end = toObject(lookup?.endereco);
  if (!end) return null;
  const mapped = {
    cep: normalizeDoc(end.cep).slice(0, 8),
    logradouro: String(end.logradouro || '').trim(),
    numero: String(end.numero || 'S/N').trim() || 'S/N',
    bairro: String(end.bairro || '').trim(),
    codigoCidade: onlyDigits(end.codigoCidade, 7),
    descricaoCidade: String(end.descricaoCidade || end.cidade || '').trim(),
    estado: String(end.estado || '').trim().toUpperCase().slice(0, 2),
  };
  return hasCompleteNfeEndereco(mapped) ? mapped : null;
};

const assertNfePermitida = async (userId) => {
  const mirror = await getDocumentosAtivosMirror(userId);
  if (mirror && !mirror.nfe) {
    throw forbidden('Emissão de NF-e (produto) não está liberada para este usuário.', {
      code: 'NFE_NOT_ALLOWED',
      botHint: 'O administrador precisa liberar NF-e no cadastro do usuário MEI.',
    });
  }
};

const normalizeProdutoCodigoForMatch = (value) =>
  normalizeDoc(value) || String(value || '').replace(/\s/g, '');

const CATALOG_INDICE_ORDINALS = {
  um: 1,
  uma: 1,
  primeiro: 1,
  primeira: 1,
  dois: 2,
  duas: 2,
  segundo: 2,
  segunda: 2,
  tres: 3,
  três: 3,
  terceiro: 3,
  terceira: 3,
  quatro: 4,
  quarto: 4,
  quarta: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};

const parseProdutoIndiceFromLabel = (value) => {
  const s = String(value || '').trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const index = Number(s);
  return Number.isInteger(index) && index >= 1 ? index : null;
};

const parseOrdinalToken = (token) => {
  const digits = parseProdutoIndiceFromLabel(token);
  if (digits) return digits;
  const key = String(token || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300/g, '');
  return CATALOG_INDICE_ORDINALS[key] ?? null;
};

const parseProdutoIndiceFromText = (value) => {
  const direct = parseProdutoIndiceFromLabel(value);
  if (direct) return direct;

  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;

  const produtoMatch = text.match(
    /\b(?:produto|item|opcao|opção)\s*(?:n[úu]mero|nº|#)?\s*(\d{1,3}|[a-záéíóúãõ]+)\b/i,
  );
  if (produtoMatch) return parseOrdinalToken(produtoMatch[1]);

  const shortMatch = text.match(/^(?:é\s+)?(?:o|a)\s+(\d{1,3}|[a-záéíóúãõ]+)$/i);
  if (shortMatch) return parseOrdinalToken(shortMatch[1]);

  return null;
};

const collectUtteranceTextValues = (payload) => {
  const fields = [
    payload?.transcript,
    payload?.mensagem,
    payload?.mensagemUsuario,
    payload?.texto,
    payload?.utterance,
    payload?.userMessage,
    payload?.produto,
    payload?.item,
    payload?.escolha,
    payload?.opcao,
  ];
  return fields.filter((value) => typeof value === 'string' && value.trim());
};

const dedupeCatalogProdutos = (rows) => {
  const seen = new Set();
  return (rows || []).filter((row) => {
    const key = [
      normalizeCatalogDiscriminacao(row.discriminacao),
      normalizeProdutoCodigoForMatch(row.codigo),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const pickProdutoNomeFromPayload = (payload) =>
  firstNonEmpty(
    payload?.produtoNome,
    payload?.produto,
    payload?.descricao,
    payload?.discriminacao,
    payload?.servico,
    payload?.item,
  );

const pickProdutoIndiceFromPayload = (payload) => {
  const direct = firstNonEmpty(
    payload?.produtoIndice,
    payload?.produtoNumero,
    payload?.itemNumero,
    payload?.indice,
    payload?.opcao,
    payload?.escolha,
  );
  if (direct != null && direct !== '') {
    const parsed = parseOrdinalToken(direct);
    if (parsed) return parsed;
  }

  for (const text of collectUtteranceTextValues(payload)) {
    const parsed = parseProdutoIndiceFromText(text);
    if (parsed) return parsed;
  }

  return null;
};

const findProdutoCatalogoNfeByNome = async (userId, nome) => {
  const q = String(nome || '').trim();
  if (!q) return { kind: 'missing' };

  let rows = await listOpenclawNfeProdutos(userId, { q, limit: 50 });
  let result = pickProdutoCatalogoByNomeResult(rows, q);
  if (result.kind === 'not_found' || result.kind === 'ambiguous') {
    const all = await listOpenclawNfeProdutos(userId, { limit: 100 });
    result = pickProdutoCatalogoByNomeResult(all, q);
  }
  return result;
};

export const listOpenclawNfeProdutos = async (userId, { q = '', limit = 20 } = {}) => {
  const rows = await listarCatalogoProdutos(userId, { q, limit, documentType: 'NFE' });
  return dedupeCatalogProdutos((rows || []).filter(isCatalogProdutoUsableForNfe));
};

export const formatOpenclawNfeProdutosMessage = (produtos) => {
  const list = Array.isArray(produtos) ? produtos : [];
  if (!list.length) {
    return 'Nenhum produto NF-e no catálogo. Cadastre na app (MEI → Catálogo → Produtos) ou use register_nfe_produto.';
  }
  const lines = list.map((p, i) => {
    const nome = String(p.discriminacao || '—').trim();
    const codigo = p.codigo ? `SKU ${p.codigo}` : 'sem SKU';
    const meta = nfeCatalogFieldsFromMetadata(p.metadata_json);
    const valor = catalogHasNfeValorSugerido(p)
      ? `preço R$ ${p.valor_sugerido}`
      : 'sem preço — vou pedir o unitário';
    return `${i + 1}. ${nome} (${codigo}, NCM ${meta.ncm}, CFOP ${meta.cfop}, ${valor})`;
  });
  return `${list.length} produto(s) NF-e no catálogo:\n${lines.join('\n')}`;
};

export const listOpenclawNfeClientes = async (userId, { q = '', limit = 20 } = {}) =>
  listarCatalogoClientes(userId, { q, limit, documentType: 'NFE' });

export const formatOpenclawNfeClientesMessage = (clientes) => {
  const list = Array.isArray(clientes) ? clientes : [];
  if (!list.length) {
    return 'Nenhum cliente NF-e no catálogo. Cadastre na app (Notas → Clientes) ou use register_nfe_cliente.';
  }
  const lines = list.map((c, i) => {
    const nome = String(c.nome || '—').trim();
    const doc = String(c.documento || '').replace(/\D/g, '');
    const docLabel = doc.length === 14
      ? `CNPJ ${doc}`
      : (doc.length === 11 ? `CPF ${doc}` : (doc || 'sem documento'));
    return `${i + 1}. ${nome} (${docLabel})`;
  });
  return `${list.length} cliente(s) NF-e no catálogo:\n${lines.join('\n')}`;
};

export const formatOpenclawNfeCatalogoMessage = (clientes, produtos) => {
  const ask = 'Qual cliente e quais produtos vão na nota? Depois me diga a quantidade e o preço unitário de cada um, se ainda não estiver no cadastro.';
  return `${formatOpenclawNfeClientesMessage(clientes)}\n\n${formatOpenclawNfeProdutosMessage(produtos)}\n\n${ask}`;
};

const firstDefinedRaw = (...values) => {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

export const catalogHasNfeValorSugerido = (produto) => {
  const n = Number(produto?.valor_sugerido);
  return Number.isFinite(n) && n > 0;
};

export const pickExplicitNfeQuantidade = (spec = {}, payload = {}, { singleItem = true } = {}) => {
  const fromSpec = firstDefinedRaw(spec?.quantidade, spec?.qtd);
  if (fromSpec !== undefined) return fromSpec;
  if (singleItem) return firstDefinedRaw(payload?.quantidade, payload?.qtd);
  return undefined;
};

export const pickExplicitNfeValorUnitario = (spec = {}, payload = {}, { singleItem = true } = {}) => {
  const fromSpec = firstDefinedRaw(spec?.valorUnitario, spec?.valor, spec?.valorReais);
  if (fromSpec !== undefined) return fromSpec;
  if (singleItem) {
    return firstDefinedRaw(
      payload?.valorUnitario,
      payload?.valor,
      payload?.valorReais,
      payload?.valorServico,
    );
  }
  return undefined;
};

export const isNfeItemDetailsMissingError = (err) =>
  String(err?.errors?.code || err?.code || '') === 'NFE_ITEM_DETAILS_MISSING';

export const formatNfeAskItemDetailsMessage = (gaps = []) => {
  const list = Array.isArray(gaps) ? gaps : [];
  const lines = list.map((gap) => {
    const nome = String(gap?.nome || 'Produto').trim();
    const missing = [];
    if (gap?.missingQuantidade) missing.push('quantidade');
    if (gap?.missingValor) missing.push('preço unitário');
    return `• ${nome}: falta ${missing.join(' e ') || 'quantidade ou preço unitário'}`;
  });
  return [
    'Para emitir a nota preciso da quantidade e do preço unitário de cada produto.',
    ...lines,
    '',
    'Manda assim (o valor é o preço de 1 item, não o total):',
    'Anel de aço 10 itens',
    'Preço: 10 reais',
    '',
    'Eu calculo o valor total (quantidade × preço unitário).',
  ].join('\n');
};

export const formatOpenclawCatalogServicosMessage = (produtos) => {
  const list = Array.isArray(produtos) ? produtos : [];
  if (!list.length) {
    return 'Nenhum serviço NFS-e no catálogo. Cadastre na app ou use register_nfse_produto.';
  }
  const lines = list.map((p, i) => {
    const nome = String(p.discriminacao || '—').trim();
    const codigo = p.codigo ? `cód. ${p.codigo}` : 'sem código';
    const cnae = p.cnae ? `CNAE ${p.cnae}` : 'sem CNAE';
    const ali = p.aliquota != null ? `ISS ${p.aliquota}%` : '';
    return `${i + 1}. ${nome} (${codigo}, ${cnae}${ali ? `, ${ali}` : ''})`;
  });
  return `${list.length} serviço(s) NFS-e no catálogo:\n${lines.join('\n')}`;
};

/**
 * Cadastra cliente com endereço (obrigatório para NF-e de produto).
 */
export const registerOpenclawNfeCliente = async (userId, payload = {}) => {
  const documento = normalizeDoc(
    payload?.documento
      || payload?.destinatarioCpfCnpj
      || payload?.tomadorCpfCnpj
      || payload?.cnpj
      || payload?.cpfCnpj,
  );
  if (!documento || (documento.length !== 11 && documento.length !== 14)) {
    throw badRequest('CPF ou CNPJ do cliente é obrigatório.', {
      code: 'NFE_CLIENTE_DOC_MISSING',
      botHint: 'Peça CPF (PF) ou CNPJ (PJ) válido antes de register_nfe_cliente.',
    });
  }
  if (!isValidCpfOrCnpj(documento)) {
    throw badRequest('CPF ou CNPJ do cliente inválido.', { code: 'NFE_CLIENTE_DOC_INVALID' });
  }

  let nome = firstNonEmpty(
    payload?.nome,
    payload?.destinatarioRazaoSocial,
    payload?.destinatarioNome,
    payload?.tomadorRazaoSocial,
    payload?.tomadorNome,
    payload?.razaoSocial,
    payload?.cliente,
  );

  let endereco = normalizeEnderecoFromPayload(payload);
  if (documento.length === 14) {
    try {
      const lookup = await lookupCnpjBrasilApi(documento);
      if (!nome) {
        nome = String(lookup?.razaoSocial || lookup?.nomeFantasia || '').trim();
      }
      if (!hasCompleteNfeEndereco(endereco)) {
        const fromLookup = enderecoFromCnpjLookup(lookup);
        if (fromLookup) endereco = fromLookup;
      }
    } catch {
      /* segue */
    }
  }

  if (!nome) {
    throw badRequest('Nome ou razão social do cliente é obrigatório.', {
      code: 'NFE_CLIENTE_NOME_MISSING',
      botHint: 'Peça nome completo (PF) ou razão social (PJ).',
    });
  }

  if (!hasCompleteNfeEndereco(endereco)) {
    throw badRequest('Endereço completo do cliente é obrigatório para NF-e.', {
      code: 'NFE_CLIENTE_ENDERECO_MISSING',
      botHint:
        'Peça CEP, logradouro, número, bairro, cidade, UF e código IBGE (7 dígitos) '
        + 'ou cadastre cliente PJ com CNPJ para buscar endereço automaticamente.',
    });
  }

  const emailRaw = firstNonEmpty(payload?.email, payload?.destinatarioEmail, payload?.tomadorEmail);
  const metadata_json = {
    indIEDest: '9',
    endereco,
  };

  const cliente = await criarCatalogoCliente(userId, {
    documentType: 'NFE',
    documento,
    nome,
    ...(emailRaw ? { email: emailRaw } : {}),
    metadata_json,
  });

  return { cliente, endereco };
};

/**
 * Cadastra produto NF-e no catálogo (NCM, CFOP, tributos MEI).
 */
export const registerOpenclawNfeProduto = async (userId, payload = {}) => {
  const discriminacao = firstNonEmpty(
    payload?.discriminacao,
    payload?.descricao,
    payload?.produtoNome,
    payload?.produto,
    payload?.nome,
  );
  if (!discriminacao) {
    throw badRequest('Descrição do produto é obrigatória.', {
      code: 'NFE_PRODUTO_DESCRICAO_MISSING',
      botHint: 'Peça: nome do produto, SKU, NCM (8 dígitos) e valor sugerido.',
    });
  }

  const codigo = String(
    firstNonEmpty(payload?.codigo, payload?.sku, payload?.codigoProduto) || discriminacao.slice(0, 20),
  ).trim();
  if (!codigo) {
    throw badRequest('Código/SKU do produto é obrigatório.', { code: 'NFE_PRODUTO_CODIGO_MISSING' });
  }

  const fields = {
    ncm: onlyDigits(firstNonEmpty(payload?.ncm), 8),
    cfop: onlyDigits(firstNonEmpty(payload?.cfop, '5102'), 4) || '5102',
    unidade: String(firstNonEmpty(payload?.unidade, 'UN')).trim() || 'UN',
    icmsCsosn: onlyDigits(firstNonEmpty(payload?.icmsCsosn, payload?.csosn, MEI_DEFAULT_NFE_CSOSN), 3),
    pisCst: onlyDigits(firstNonEmpty(payload?.pisCst, MEI_DEFAULT_NFE_PIS_COFINS_CST), 2),
    cofinsCst: onlyDigits(firstNonEmpty(payload?.cofinsCst, MEI_DEFAULT_NFE_PIS_COFINS_CST), 2),
  };

  if (fields.ncm.length !== 8) {
    throw badRequest('NCM deve ter 8 dígitos.', {
      code: 'NFE_PRODUTO_NCM_INVALID',
      botHint: 'Peça o NCM do produto (8 dígitos).',
    });
  }

  const valorRaw = payload?.valorSugerido ?? payload?.valor_sugerido ?? payload?.valor;
  const valor_sugerido = parseValorReais(valorRaw);

  const produto = await criarCatalogoProduto(userId, {
    documentType: 'NFE',
    discriminacao,
    codigo,
    cnae: fields.ncm.slice(0, 7),
    ...(valor_sugerido !== null ? { valor_sugerido } : {}),
    metadata_json: buildNfeCatalogMetadata(fields),
  });

  return { produto };
};

const mapCatalogProdutoToNfeItem = (produto, { quantidade, valorUnitario }) => {
  const fields = nfeCatalogFieldsFromMetadata(produto.metadata_json);
  const codigo = String(produto.codigo || 'CAT').trim();
  const descricao = String(produto.discriminacao || codigo).trim();
  const qtd = quantidade > 0 ? quantidade : 1;
  const vu = valorUnitario > 0
    ? valorUnitario
    : (Number(produto.valor_sugerido) > 0 ? Number(produto.valor_sugerido) : 0);
  if (vu <= 0) {
    throw badRequest('Valor do produto inválido ou ausente.', {
      code: 'NFE_VALOR_MISSING',
      botHint: 'Informe payload.valor ou cadastre valor_sugerido no produto.',
    });
  }

  return {
    codigo,
    descricao,
    ncm: fields.ncm,
    cfop: fields.cfop,
    unidadeComercial: fields.unidade,
    quantidade: { comercial: qtd, tributavel: qtd },
    valorUnitario: { comercial: vu, tributavel: vu },
    valor: qtd * vu,
    tributos: {
      icms: { origem: '0', cst: fields.icmsCsosn },
      pis: { cst: fields.pisCst, baseCalculo: { valor: 0 }, aliquota: 0, valor: 0 },
      cofins: { cst: fields.cofinsCst, baseCalculo: { valor: 0 }, aliquota: 0, valor: 0 },
    },
  };
};

const resolveProdutoNfe = async (userId, payload) => {
  const catalogNfe = await listOpenclawNfeProdutos(userId, { limit: 100 });

  const produtoId = String(payload?.produtoId || payload?.catalogoProdutoId || '').trim();
  if (produtoId) {
    const found = catalogNfe.find((r) => String(r.id) === produtoId);
    if (!found) {
      throw badRequest('Produto não encontrado no catálogo NF-e.', {
        code: 'NFE_PRODUTO_NOT_FOUND',
        botHint: 'Use list_nfe_produtos ou list_catalog_produtos.',
      });
    }
    return found;
  }

  const produtoIndice = pickProdutoIndiceFromPayload(payload);
  if (produtoIndice) {
    const byIndex = pickProdutoCatalogoByIndexResult(catalogNfe, produtoIndice);
    if (byIndex.kind === 'ok') return byIndex.produto;
    throw badRequest(formatNfeCatalogChoiceMessage(catalogNfe), {
      code: 'NFE_PRODUTO_NOT_FOUND',
      produtoIndice,
      botHint: 'Use produtoIndice (1, 2, 3…) da lista list_nfe_produtos.',
    });
  }

  const nomeRaw = pickProdutoNomeFromPayload(payload);
  const indiceFromNome = parseProdutoIndiceFromLabel(nomeRaw);
  if (indiceFromNome) {
    const byIndex = pickProdutoCatalogoByIndexResult(catalogNfe, indiceFromNome);
    if (byIndex.kind === 'ok') return byIndex.produto;
  }

  const nome = isVagueNfItemLabel(nomeRaw) ? '' : nomeRaw;

  if (!nome) {
    if (!catalogNfe.length) {
      throw badRequest(
        'Nenhum produto cadastrado para NF-e. Cadastre na app (MEI → Notas) ou use register_nfe_produto.',
        {
          code: 'NFE_PRODUTO_CATALOG_EMPTY',
          botHint: 'Use list_nfe_produtos. Não chame preview_nfe sem produto no catálogo.',
        },
      );
    }
    if (catalogNfe.length === 1) return catalogNfe[0];
    throw badRequest(formatNfeCatalogChoiceMessage(catalogNfe), {
      code: 'NFE_PRODUTO_CHOICE_REQUIRED',
      produtos: catalogNfe.map((p) => ({
        id: p.id,
        discriminacao: p.discriminacao,
        codigo: p.codigo,
      })),
      botHint:
        'O utilizador não disse qual produto. Liste com list_nfe_produtos e use produtoIndice '
        + '(número da lista) ou produtoNome exato.',
    });
  }

  const lookup = await findProdutoCatalogoNfeByNome(userId, nome);
  if (lookup.kind === 'not_found') {
    throw badRequest(formatNfCatalogNotFoundMessage(nome, catalogNfe, 'NFE'), {
      code: 'NFE_PRODUTO_NOT_IN_CATALOG',
      produtoNome: nome,
      botHint: 'Liste o catálogo e use produtoIndice (número) ou produtoNome exato.',
    });
  }
  if (lookup.kind === 'ambiguous') {
    const ambIndice = parseProdutoIndiceFromText(
      firstNonEmpty(payload?.opcao, payload?.escolha, payload?.numero, nomeRaw),
    );
    if (ambIndice) {
      const byAmbIndex = pickProdutoCatalogoByIndexResult(lookup.matches, ambIndice);
      if (byAmbIndex.kind === 'ok') return byAmbIndex.produto;
    }

    const codigoRef = normalizeProdutoCodigoForMatch(lookup.matches?.[0]?.codigo);
    const allIdentical = (lookup.matches || []).every(
      (row) => normalizeProdutoCodigoForMatch(row.codigo) === codigoRef
        && normalizeCatalogDiscriminacao(row.discriminacao)
          === normalizeCatalogDiscriminacao(lookup.matches[0].discriminacao),
    );
    if (allIdentical && lookup.matches?.[0]) return lookup.matches[0];

    throw badRequest(formatNfCatalogAmbiguousMessage(nome, lookup.matches, 'NFE'), {
      code: 'NFE_PRODUTO_AMBIGUOUS',
      matches: (lookup.matches || []).map((p) => ({
        id: p.id,
        discriminacao: p.discriminacao,
        codigo: p.codigo,
      })),
      botHint: 'Mostre a lista numerada e use produtoIndice (1, 2, 3…) ou produtoNome exato.',
    });
  }
  return lookup.produto;
};

const resolveDestinatarioNfe = async (userId, payload) => {
  const tomador = await resolveOpenclawTomador(userId, {
    tomadorCpfCnpj:
      payload?.destinatarioCpfCnpj
      || payload?.tomadorCpfCnpj
      || payload?.documento
      || payload?.cnpj
      || payload?.cpfCnpj,
    tomadorNome:
      payload?.destinatarioNome
      || payload?.destinatarioRazaoSocial
      || payload?.tomadorNome
      || payload?.tomadorRazaoSocial
      || payload?.cliente
      || payload?.nome,
    tomadorRazaoSocial: payload?.destinatarioRazaoSocial || payload?.tomadorRazaoSocial,
  });

  const { listarCatalogoClientes } = await import('./mei-notas.service.js');
  const docTomador = tomador.tomadorCpfCnpj;
  let catalogo = null;

  if (docTomador) {
    const clientes = await listarCatalogoClientes(userId, {
      q: docTomador,
      limit: 5,
      documentType: 'NFE',
    });
    catalogo = (clientes || []).find(
      (c) => normalizeDoc(c.documento) === docTomador,
    );
    if (!catalogo) {
      const all = await listarCatalogoClientes(userId, { limit: 100, documentType: 'NFE' });
      catalogo = (all || []).find(
        (c) => normalizeDoc(c.documento) === docTomador,
      );
    }
  }

  if (!catalogo && tomador.tomadorRazaoSocial) {
    const nomeNorm = normalizeCatalogDiscriminacao(tomador.tomadorRazaoSocial);
    const all = await listarCatalogoClientes(userId, { limit: 100, documentType: 'NFE' });
    catalogo = (all || []).find(
      (c) => normalizeCatalogDiscriminacao(c.nome) === nomeNorm,
    );
  }

  let endereco = toObject(catalogo?.metadata_json?.endereco);
  if (!hasCompleteNfeEndereco(endereco) && docTomador.length === 14) {
    try {
      const lookup = await lookupCnpjBrasilApi(tomador.tomadorCpfCnpj);
      const fromLookup = enderecoFromCnpjLookup(lookup);
      if (fromLookup) endereco = fromLookup;
    } catch {
      /* segue */
    }
  }

  endereco = await enrichDestinatarioEnderecoForNfeEmit(endereco);

  if (!hasCompleteNfeEndereco(endereco)) {
    throw badRequest('Cliente sem endereço completo para NF-e.', {
      code: 'NFE_DESTINATARIO_ENDERECO_MISSING',
      catalogoClienteId: catalogo?.id,
      botHint: 'Use register_nfe_cliente com CEP, logradouro, número, bairro, cidade, UF e IBGE.',
    });
  }

  const doc = tomador.tomadorCpfCnpj;
  const consumidorFinal = doc.length === 11 || String(catalogo?.metadata_json?.indIEDest || '9') === '9';

  return {
    cpfCnpj: doc,
    razaoSocial: tomador.tomadorRazaoSocial,
    ...(tomador.tomadorEmail ? { email: tomador.tomadorEmail } : {}),
    indIEDest: '9',
    endereco,
    consumidorFinal,
    catalogoClienteId: catalogo?.id,
  };
};

const parseQuantidade = (raw) => {
  if (raw === undefined || raw === null || raw === '') return 1;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 1;
};

const resolveNfeItemPricing = (produto, spec, payload, { singleItem }) => {
  const qtyRaw = pickExplicitNfeQuantidade(spec, payload, { singleItem });
  const valorRaw = pickExplicitNfeValorUnitario(spec, payload, { singleItem });
  const missingQuantidade = qtyRaw === undefined;
  const missingValor = valorRaw === undefined && !catalogHasNfeValorSugerido(produto);
  return {
    produto,
    missingQuantidade,
    missingValor,
    quantidade: missingQuantidade ? null : parseQuantidade(qtyRaw),
    valorUnitario: parseValorReais(valorRaw)
      ?? (catalogHasNfeValorSugerido(produto) ? Number(produto.valor_sugerido) : 0),
  };
};

/** Payload legado (1 produto no root) ou array `itens` / `produtos` / `items`. */
export const extractNfeItemSpecsFromPayload = (payload = {}) => {
  const rawList = payload?.itens || payload?.produtos || payload?.items;
  if (Array.isArray(rawList) && rawList.length > 0) {
    return rawList.map((entry) => ({
      ...(entry && typeof entry === 'object' ? entry : {}),
      produtoNome: pickProdutoNomeFromPayload(entry),
      produtoId: entry?.produtoId || entry?.catalogoProdutoId,
      produtoIndice: entry?.produtoIndice ?? entry?.indice,
      valorUnitario: entry?.valorUnitario ?? entry?.valor ?? entry?.valorReais,
      quantidade: entry?.quantidade ?? entry?.qtd,
    }));
  }
  return [payload];
};

const resolveProdutoNfeByIndice = async (userId, indiceRaw) => {
  const indice = parseOrdinalToken(indiceRaw) ?? Number(indiceRaw);
  if (!Number.isFinite(indice) || indice < 1) return null;
  const catalogNfe = await listOpenclawNfeProdutos(userId, { limit: 100 });
  const byIndex = pickProdutoCatalogoByIndexResult(catalogNfe, indice);
  return byIndex.kind === 'ok' ? byIndex.produto : null;
};

const resolveProdutoNfeFromSpec = async (userId, payload, spec = {}) => {
  if (spec?.produtoIndice != null || spec?.indice != null) {
    const byIndex = await resolveProdutoNfeByIndice(
      userId,
      spec?.produtoIndice ?? spec?.indice,
    );
    if (byIndex) return byIndex;
    throw badRequest('Índice de produto inválido no catálogo NF-e.', {
      code: 'NFE_PRODUTO_INDEX_INVALID',
      botHint: 'Use list_nfe_produtos e informe produtoNome ou produtoIndice válido.',
    });
  }
  return resolveProdutoNfe(userId, { ...payload, ...spec });
};

const buildNfeItemFromCatalog = async (userId, payload, spec, { singleItem = true } = {}) => {
  const produto = await resolveProdutoNfeFromSpec(userId, payload, spec);
  const pricing = resolveNfeItemPricing(produto, spec, payload, { singleItem });
  if (pricing.missingQuantidade || pricing.missingValor) {
    return { produto, pricing, incomplete: true };
  }
  const item = mapCatalogProdutoToNfeItem(produto, {
    quantidade: pricing.quantidade,
    valorUnitario: pricing.valorUnitario,
  });
  return { item, produto, pricing, incomplete: false };
};

const resolveNfeItensFromPayload = async (userId, payload) => {
  const specs = extractNfeItemSpecsFromPayload(payload);
  const singleItem = specs.length === 1;
  const built = [];
  const gaps = [];
  for (const spec of specs) {
    const row = await buildNfeItemFromCatalog(userId, payload, spec, { singleItem });
    if (row.incomplete) {
      gaps.push({
        nome: String(row.produto?.discriminacao || spec?.produtoNome || 'Produto').trim(),
        missingQuantidade: row.pricing.missingQuantidade,
        missingValor: row.pricing.missingValor,
      });
      continue;
    }
    built.push(row);
  }
  if (gaps.length) {
    throw badRequest(formatNfeAskItemDetailsMessage(gaps), {
      code: 'NFE_ITEM_DETAILS_MISSING',
      missingItemDetails: gaps,
      botHint:
        'Repita APENAS message. Espere o utilizador mandar quantidade e preço UNITÁRIO '
        + '(não o total). Depois preview_nfe de novo com itens[].quantidade e itens[].valor (unitário).',
    });
  }
  return built;
};

const formatNfePreviewItem = (item) => ({
  produtoDescricao: item.descricao,
  produtoCodigo: item.codigo,
  ncm: item.ncm,
  cfop: item.cfop,
  quantidade: item.quantidade?.comercial,
  valorUnitario: item.valorUnitario?.comercial,
  valorTotal: item.valor,
});

/** Preview a partir do input já montado (vários itens + total). */
export const buildNfePreviewFromEmitInput = (input = {}) => {
  const previewItens = (Array.isArray(input.itens) ? input.itens : []).map(formatNfePreviewItem);
  const valorTotal = (Array.isArray(input.itens) ? input.itens : [])
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const first = previewItens[0] || {};
  return {
    documentType: 'NFE',
    destinatarioCpfCnpj: input.destinatario?.cpfCnpj,
    destinatarioRazaoSocial: input.destinatario?.razaoSocial,
    destinatarioUf: input.destinatario?.endereco?.estado,
    emitenteUf: input.emitente?.endereco?.estado,
    itens: previewItens,
    produtoDescricao: previewItens.map((row) => row.produtoDescricao).join('; '),
    produtoCodigo: first.produtoCodigo,
    ncm: first.ncm,
    cfop: first.cfop,
    quantidade: first.quantidade,
    valorUnitario: first.valorUnitario,
    valorTotal,
    emitenteCnpj: input.emitente?.cpfCnpj,
  };
};

const matchCatalogIdForTaxItem = (itens, catalogoProdutoIds, codigo, ncm) => {
  const ids = Array.isArray(catalogoProdutoIds) ? catalogoProdutoIds : [catalogoProdutoIds];
  const list = Array.isArray(itens) ? itens : [];
  const codigoNorm = String(codigo || '').trim();
  const ncmNorm = String(ncm || '').replace(/\D/g, '').slice(0, 8);
  const idx = list.findIndex((item) => {
    const itemCodigo = String(item?.codigo || item?.sku || '').trim();
    const itemNcm = String(item?.ncm || '').replace(/\D/g, '').slice(0, 8);
    if (codigoNorm && itemCodigo === codigoNorm) return true;
    if (ncmNorm && itemNcm === ncmNorm) return true;
    return false;
  });
  if (idx >= 0 && ids[idx]) return ids[idx];
  return ids[0] || null;
};

const recalculateOpenclawNfeTaxes = async (userId, input, catalogoProdutoIds) => {
  const businessType = await getBusinessTypeMirror(userId);
  const tenantId = await resolveFiscalTenantId(userId, input?.metadata?.empresaId);
  const payload = {
    emitente: input.emitente,
    destinatario: input.destinatario,
    consumidorFinal: input.consumidorFinal,
    itens: input.itens,
    pagamentos: input.pagamentos,
    config: input.config,
  };

  const recalculated = await recalculateNfeLikePayloadTaxForEmit(payload, {
    businessType,
    tenantId,
    resolveCatalogProductId: async (codigo, ncm) =>
      matchCatalogIdForTaxItem(input.itens, catalogoProdutoIds, codigo, ncm),
  });

  return {
    ...input,
    itens: recalculated.itens ?? input.itens,
    pagamentos: recalculated.pagamentos ?? input.pagamentos,
    config: recalculated.config ?? input.config,
  };
};

/**
 * Monta input de emissão NF-e para o bot.
 * Aceita 1 produto no root (legado) ou vários em `itens` / `produtos` / `items`.
 */
export const buildOpenclawNfeEmitInput = async (userId, payload = {}) => {
  await assertNfePermitida(userId);

  const { hasCertificate, getEmitenteNfseSnapshot } = await import('./mei-certificate-store.js');
  const certOk = await hasCertificate(userId);
  const emitenteRaw = await getEmitenteNfseSnapshot(userId);
  const { emitente } = await resolveEmitenteForNfseSetup(userId, emitenteRaw, certOk);
  if (!emitente || emitenteMissingAddressFields(emitente)) {
    throw badRequest('Dados fiscais do emitente incompletos.', {
      code: 'NFE_EMITENTE_MISSING',
      botHint: 'Configure certificado e empresa na app MEI.',
    });
  }

  const prestador = emitenteToPrestadorInput(emitente);
  const destinatario = await resolveDestinatarioNfe(userId, payload);
  const builtItems = await resolveNfeItensFromPayload(userId, payload);
  const itens = builtItems.map((entry) => entry.item);
  const catalogoProdutoIds = builtItems.map((entry) => entry.produto.id);
  const total = itens.reduce((acc, item) => acc + Number(item.valor || 0), 0);

  const baseInput = {
    documentType: 'NFE',
    emitente: {
      cpfCnpj: prestador.prestadorCpfCnpj,
      razaoSocial: prestador.prestadorRazaoSocial,
      endereco: prestador.prestadorEndereco,
      crt: 1,
      ...(String(emitente.inscricaoEstadual || '').trim()
        ? { inscricaoEstadual: String(emitente.inscricaoEstadual).trim() }
        : {}),
    },
    destinatario: {
      cpfCnpj: destinatario.cpfCnpj,
      razaoSocial: destinatario.razaoSocial,
      ...(destinatario.email ? { email: destinatario.email } : {}),
      indIEDest: destinatario.indIEDest,
      endereco: destinatario.endereco,
    },
    consumidorFinal: destinatario.consumidorFinal,
    itens,
    pagamentos: [{ meio: '99', valor: total, descricaoMeio: 'Outros' }],
    config: { producao: true },
    metadata: {
      source: 'openclaw_whatsapp',
      catalogoProdutoId: catalogoProdutoIds[0],
      catalogoProdutoIds,
      catalogoClienteId: destinatario.catalogoClienteId,
    },
  };

  return recalculateOpenclawNfeTaxes(userId, baseInput, catalogoProdutoIds);
};

export const previewOpenclawNfeEmit = async (userId, payload = {}) => {
  const input = await buildOpenclawNfeEmitInput(userId, payload);
  return buildNfePreviewFromEmitInput(input);
};

export const emitOpenclawNfe = async (userId, payload = {}) => {
  const input = await buildOpenclawNfeEmitInput(userId, payload);
  if (!isNfEmitConfirmed(payload)) {
    return {
      preview: buildNfePreviewFromEmitInput(input),
      requiresConfirm: true,
      notEmitted: true,
    };
  }

  const fingerprint = buildOpenclawNfeEmitFingerprint(userId, input);
  const { nota: created, deduplicated } = await runOpenclawEmitWithDedup(
    fingerprint,
    () => emitirNota(userId, input),
  );
  return {
    nota: created,
    preview: buildNfePreviewFromEmitInput(input),
    requiresConfirm: false,
    notEmitted: false,
    deduplicated: deduplicated === true,
  };
};

export const rethrowNfeErrorForBot = (err) => {
  try {
    rethrowNfseErrorForBot(err);
  } catch (e) {
    const code = e?.errors?.code || e?.code;
    const existingHint = e?.errors?.botHint || e?.botHint;
    const rawMsg = String(e?.message || '');
    const userMessage = formatNfeEmitErrorForUser(rawMsg, {
      nfeAtivo: e?.errors?.nfeAtivo,
    });
    const loopGuard = `${BOT_NF_EMIT_FAILED_INSTRUCTION} ${existingHint || ''}`.trim();

    if (code === 'NFE_ITEM_DETAILS_MISSING') {
      throw badRequest(rawMsg, {
        code,
        missingItemDetails: e?.errors?.missingItemDetails,
        botHint:
          existingHint
          || 'Repita APENAS message. Espere quantidade e preço unitário. valor no payload é o preço de 1 item.',
      });
    }

    if (existingHint) {
      throw badRequest(userMessage, { code, botHint: loopGuard });
    }

    if (/NF-e|NFE|produto|destinatário|plugnotas|erro interno/i.test(rawMsg)) {
      throw badRequest(userMessage, {
        code: code || 'NFE_OPENCLAW',
        botHint: loopGuard || 'Use list_nfe_produtos, register_nfe_cliente e register_nfe_produto antes de emit_nfe.',
      });
    }
    throw e;
  }
};
