import { BACKEND_BUILD_ID } from '../build-id.js';
import { badRequest } from '../utils/errors.js';
import {
  getCertificateDocument,
  getDocumentosAtivosMirror,
  getEmitenteNfseSnapshot,
  getPlugNotasCertId,
  hasCertificate,
} from './mei-certificate-store.js';
import {
  empresaJsonToEmitentePartial,
  mergeEmitenteWithEmpresaPartial,
  reconcileEmitenteMirrorFromEmpresaJson,
} from './mei-emitente-empresa-sync.js';
import { consultarEmpresaAndReconcileMirror } from './mei-notas-documentos-mirror.js';
import { resolveCodigoNbsForServico, resolveCodigoTributacaoForServico } from './nfse-codigo-nbs.js';
import {
  atualizarCatalogoCliente,
  baixarPdf,
  criarCatalogoCliente,
  criarCatalogoProduto,
  emitirNota,
  listarCatalogoClientes,
  listarCatalogoProdutos,
  listarNotas,
  obterNota,
  NFSE_SERVICO_CODIGO_MIN_LENGTH,
} from './mei-notas.service.js';
import {
  buildTomadorEnderecoMissingBotHint,
  buildTomadorEnderecoMissingUserMessage,
  hasCompleteTomadorEndereco,
  listMissingTomadorEnderecoFields,
  mergeEnderecoLayers,
  pruneEndereco,
  resolveCatalogClienteEndereco,
  resolveTomadorEmitEndereco,
} from './plugnotas/plugnotas-nfse-email-resolve.js';
import {
  isVagueNfItemLabel,
  formatNfseCatalogChoiceMessage,
  formatNfCatalogAmbiguousMessage,
  formatNfCatalogNotFoundMessage,
  isNfEmitConfirmed,
  BOT_NF_EMIT_FAILED_INSTRUCTION,
  formatNfseEmitErrorForUser,
} from './openclaw-nf-user-messages.js';
import { lookupCnpjBrasilApi } from './cnpj-lookup.service.js';
import { isValidCpfOrCnpj, normalizeDocDigits } from '../utils/cpf-cnpj.js';

const normalizeDoc = (value) => normalizeDocDigits(value);

const firstNonEmpty = (...values) => {
  for (const v of values) {
    const s = v !== undefined && v !== null ? String(v).trim() : '';
    if (s) return s;
  }
  return '';
};

const stripDiacritics = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeNameForMatch = (value) =>
  stripDiacritics(String(value || '').trim().toLowerCase()).replace(/\s+/g, ' ');

/** Normaliza discriminação do catálogo para comparação (pontuação, espaços). */
export const normalizeCatalogDiscriminacao = (value) =>
  normalizeNameForMatch(value)
    .replace(/[.,;:!?…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * O utilizador ou o agente escolheu o serviço de forma inequívoca (não só texto livre do LLM).
 * @param {Record<string, unknown>} [payload]
 */
export const hasExplicitNfseServicoSelection = (payload = {}) => Boolean(
  firstNonEmpty(
    payload?.codigoServico,
    payload?.codigo,
    payload?.servicoIndice,
    payload?.servicoNumero,
    payload?.indice,
    payload?.produtoId,
    payload?.servicoId,
    payload?.catalogoProdutoId,
  ),
);

/** Número em formato BR (1.200,50 / 1.200 / 1200). */
const parseBrNumericToken = (token) => {
  let t = String(token).trim().replace(/\s/g, '');
  if (!t) return NaN;
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Valor da NFSe em reais (texto ou número) — ex.: payload.valor no emit_nfse.
 * @param {unknown} raw
 * @returns {number|null}
 */
export const parseValorReais = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 0 ? raw : null;

  const s = stripDiacritics(String(raw).trim().toLowerCase());
  if (!s) return null;

  const milhaoMatch =
    /^(\d+(?:[.,]\d+)?)\s*milh(?:ao|oes?)\s*(?:e\s+(\d+(?:[.,]\d+)?)\s*mil)?$/.exec(s);
  if (milhaoMatch) {
    const base = parseBrNumericToken(milhaoMatch[1]) * 1_000_000;
    const extra = milhaoMatch[2] ? parseBrNumericToken(milhaoMatch[2]) * 1_000 : 0;
    const total = base + extra;
    return Number.isFinite(total) && total > 0 ? total : null;
  }

  const milMatch = /^(\d+(?:[.,]\d+)?)\s*mil$/.exec(s);
  if (milMatch) {
    const n = parseBrNumericToken(milMatch[1]) * 1_000;
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const n = parseBrNumericToken(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const buildPrestadorLogradouro = (emitente) => {
  const tipo = String(emitente?.tipoLogradouro || '').trim();
  const log = String(emitente?.logradouro || '').trim();
  if (!log) return '';
  if (tipo && !log.toLowerCase().startsWith(tipo.toLowerCase())) {
    return `${tipo} ${log}`.trim();
  }
  return log;
};

const emitenteToPrestadorInput = (emitente) => {
  if (!emitente?.certDocument || normalizeDoc(emitente.certDocument).length !== 14) {
    throw badRequest('CNPJ do prestador não configurado. Complete o cadastro MEI na app.', {
      code: 'NFSE_PRESTADOR_CNPJ_MISSING',
      botHint: 'Oriente a abrir Meu Financeiro → MEI → Certificado / dados fiscais.',
    });
  }
  const logradouro = buildPrestadorLogradouro(emitente);
  const endereco = {
    logradouro,
    numero: String(emitente.numero || '').trim(),
    codigoCidade: String(emitente.codigoCidade || '').trim(),
    cep: normalizeDoc(emitente.cep).slice(0, 8),
    complemento: String(emitente.complemento || '').trim(),
    bairro: String(emitente.bairro || '').trim(),
    estado: String(emitente.estado || '').trim().toUpperCase().slice(0, 2),
    descricaoCidade: String(emitente.descricaoCidade || '').trim(),
  };
  return {
    prestadorCpfCnpj: normalizeDoc(emitente.certDocument),
    prestadorRazaoSocial: String(emitente.razaoSocial || emitente.nomeFantasia || '').trim(),
    prestadorEmail: String(emitente.email || '').trim() || undefined,
    prestadorInscricaoMunicipal: String(emitente.inscricaoMunicipal || '').trim() || undefined,
    prestadorEndereco: endereco,
  };
};

const pickServicoNomeFromPayload = (payload) =>
  firstNonEmpty(
    payload?.produtoNome,
    payload?.produto,
    payload?.servicoNome,
    payload?.servico,
    payload?.discriminacao,
    payload?.descricaoServico,
    payload?.descricao,
  );

/**
 * Escolhe produto/serviço do catálogo NFSe por nome ou discriminação.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} nome
 */
export const pickProdutoCatalogoByNomeResult = (rows, nome) => {
  const q = normalizeCatalogDiscriminacao(nome);
  if (!q) return { kind: 'missing' };
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { kind: 'not_found', q: nome };

  const exact = list.filter(
    (r) => normalizeCatalogDiscriminacao(r.discriminacao) === q,
  );
  if (exact.length === 1) return { kind: 'ok', produto: exact[0] };

  const partial = list.filter((r) => {
    const n = normalizeCatalogDiscriminacao(r.discriminacao);
    return n.includes(q) || q.includes(n);
  });
  if (partial.length === 1) return { kind: 'ok', produto: partial[0] };

  const allWordsMatch = list.filter((r) => {
    const n = normalizeCatalogDiscriminacao(r.discriminacao);
    const words = q.split(' ').filter((w) => w.length >= 3);
    if (!words.length) return false;
    return words.every((w) => n.includes(w));
  });
  if (allWordsMatch.length === 1) return { kind: 'ok', produto: allWordsMatch[0] };

  if (list.length === 1) return { kind: 'ok', produto: list[0] };

  return { kind: 'ambiguous', matches: partial.length ? partial : list, q: nome };
};

const normalizeProdutoCodigoForMatch = (value) =>
  normalizeDoc(value) || String(value || '').replace(/\s/g, '');

const normalizeProdutoCnaeForMatch = (value) => normalizeDoc(value).slice(0, 7);

/**
 * Resolve serviço do catálogo por código municipal (e CNAE opcional).
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} codigo
 * @param {string} [cnae]
 */
export const pickProdutoCatalogoByCodigoResult = (rows, codigo, cnae) => {
  const codigoNorm = normalizeProdutoCodigoForMatch(codigo);
  if (!codigoNorm) return { kind: 'missing' };

  const list = Array.isArray(rows) ? rows : [];
  let matches = list.filter(
    (row) => normalizeProdutoCodigoForMatch(row.codigo) === codigoNorm,
  );

  const cnaeNorm = normalizeProdutoCnaeForMatch(cnae);
  if (cnaeNorm.length === 7) {
    matches = matches.filter(
      (row) => normalizeProdutoCnaeForMatch(row.cnae) === cnaeNorm,
    );
  }

  if (matches.length === 1) return { kind: 'ok', produto: matches[0] };
  if (matches.length > 1) return { kind: 'ambiguous', matches, codigo: codigoNorm, cnae: cnaeNorm };
  return { kind: 'not_found', codigo: codigoNorm, cnae: cnaeNorm };
};

/**
 * Evita duplicar serviço quando o robô reenvia código + CNAE com outra discriminação.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} codigo
 * @param {string} cnae
 */
export const pickProdutoCatalogoByCodigoCnaeResult = (rows, codigo, cnae) =>
  pickProdutoCatalogoByCodigoResult(rows, codigo, cnae);

const findProdutoCatalogoByCodigoCnae = async (userId, codigo, cnae) => {
  const rows = await listarCatalogoProdutos(userId, { limit: 50, documentType: 'NFSE' });
  return pickProdutoCatalogoByCodigoResult(rows, codigo, cnae);
};

const findProdutoCatalogoByNome = async (userId, nome) => {
  const q = String(nome || '').trim();
  if (!q) return { kind: 'missing' };

  let rows = await listarCatalogoProdutos(userId, { q, limit: 20, documentType: 'NFSE' });
  let result = pickProdutoCatalogoByNomeResult(rows, q);
  if (result.kind === 'not_found' || result.kind === 'ambiguous') {
    const all = await listarCatalogoProdutos(userId, { limit: 50, documentType: 'NFSE' });
    result = pickProdutoCatalogoByNomeResult(all, q);
  }
  return result;
};

const pickProdutoCatalogoByIndexResult = (rows, indexRaw) => {
  const index = Number(indexRaw);
  if (!Number.isInteger(index) || index < 1) return { kind: 'missing' };
  const list = Array.isArray(rows) ? rows : [];
  const produto = list[index - 1];
  if (!produto) return { kind: 'not_found', index };
  return { kind: 'ok', produto };
};

const pickProdutoCatalogoByIdResult = (rows, idRaw) => {
  const id = String(idRaw || '').trim();
  if (!id) return { kind: 'missing' };
  const list = Array.isArray(rows) ? rows : [];
  const matches = list.filter((row) => String(row.id || '') === id);
  if (matches.length === 1) return { kind: 'ok', produto: matches[0] };
  return { kind: 'not_found', id };
};

const pickCodigoNbsFromCatalogMetadata = (metadataJson) => {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) {
    return null;
  }
  const raw = metadataJson.codigoNbs ?? metadataJson.codigo_nbs;
  if (raw === undefined || raw === null || raw === '') return null;
  return String(raw).trim();
};

const applyProdutoCatalogoToServico = (produto, refs) => {
  if (!produto) return refs;
  const next = { ...refs };
  if (!next.codigo && produto.codigo) next.codigo = String(produto.codigo);
  if (!next.cnae && produto.cnae) next.cnae = String(produto.cnae);
  if (
    (next.aliquotaRaw === undefined || next.aliquotaRaw === null || next.aliquotaRaw === '')
    && produto.aliquota != null
  ) {
    next.aliquotaRaw = produto.aliquota;
  }
  if (!next.discriminacao && produto.discriminacao) {
    next.discriminacao = String(produto.discriminacao).trim();
  }
  if (!next.codigoNbs) {
    const fromMeta = pickCodigoNbsFromCatalogMetadata(produto.metadata_json);
    if (fromMeta) next.codigoNbs = fromMeta;
  }
  return next;
};

const throwNfseServicoChoiceRequired = (catalogNfse, botHint) => {
  throw badRequest(
    formatNfseCatalogChoiceMessage(catalogNfse, {
      prefix:
        'Você informou cliente e valor, mas ainda não escolheu o serviço. '
        + 'Qual vai na nota? Responda com o número (1, 2, 3…):',
    }),
    {
      code: 'NFSE_SERVICO_CHOICE_REQUIRED',
      servicos: catalogNfse.map((p) => ({
        id: p.id,
        discriminacao: p.discriminacao,
        codigo: p.codigo,
        cnae: p.cnae,
      })),
      botHint,
    },
  );
};

const resolveServicoDefaults = async (userId, payload, emitente) => {
  let discriminacao = firstNonEmpty(
    payload?.discriminacao,
    payload?.descricaoServico,
    payload?.descricao,
    payload?.servico,
  );
  if (isVagueNfItemLabel(discriminacao)) discriminacao = '';

  let codigo = firstNonEmpty(payload?.codigoServico, payload?.codigo);
  let cnae = firstNonEmpty(payload?.cnae);
  let codigoNbs = firstNonEmpty(payload?.codigoNbs, payload?.codigo_nbs);
  let aliquotaRaw = payload?.aliquota ?? payload?.aliquotaIss;

  const catalogNfse = await listarCatalogoProdutos(userId, { limit: 50, documentType: 'NFSE' });

  if (catalogNfse.length > 1 && !hasExplicitNfseServicoSelection(payload)) {
    throwNfseServicoChoiceRequired(
      catalogNfse,
      'O utilizador NÃO informou qual serviço. PROIBIDO inventar descricao/codigoServico. '
      + 'Mostre a lista numerada, espere a escolha (1, 2, 3…) e use preview_nfse com servicoIndice. '
      + 'Não use emit_nfse neste passo.',
    );
  }

  const applyCatalogProduto = (produto) => {
    const merged = applyProdutoCatalogoToServico(produto, {
      codigo,
      cnae,
      codigoNbs,
      aliquotaRaw,
      discriminacao,
    });
    codigo = merged.codigo || codigo;
    cnae = merged.cnae || cnae;
    codigoNbs = merged.codigoNbs || codigoNbs;
    aliquotaRaw = merged.aliquotaRaw ?? aliquotaRaw;
    if (produto?.discriminacao) {
      discriminacao = String(produto.discriminacao).trim();
    } else if (merged.discriminacao) {
      discriminacao = merged.discriminacao;
    }
  };

  const produtoId = firstNonEmpty(payload?.produtoId, payload?.servicoId, payload?.catalogoProdutoId);
  if (produtoId) {
    const byId = pickProdutoCatalogoByIdResult(catalogNfse, produtoId);
    if (byId.kind === 'ok') applyCatalogProduto(byId.produto);
  }

  const servicoIndice = firstNonEmpty(payload?.servicoIndice, payload?.servicoNumero, payload?.indice);
  if (!codigo && servicoIndice) {
    const byIndex = pickProdutoCatalogoByIndexResult(catalogNfse, servicoIndice);
    if (byIndex.kind === 'ok') applyCatalogProduto(byIndex.produto);
  }

  if (codigo && (!cnae || !discriminacao)) {
    const byCodigo = pickProdutoCatalogoByCodigoResult(catalogNfse, codigo, cnae);
    if (byCodigo.kind === 'ok') applyCatalogProduto(byCodigo.produto);
    else if (byCodigo.kind === 'ambiguous') {
      throw badRequest(formatNfCatalogAmbiguousMessage(codigo, byCodigo.matches, 'NFSE'), {
        code: 'NFSE_SERVICO_AMBIGUOUS',
        codigo,
        matches: (byCodigo.matches || []).map((p) => ({
          id: p.id,
          discriminacao: p.discriminacao,
          codigo: p.codigo,
          cnae: p.cnae,
        })),
        botHint: 'Use codigoServico + cnae do catálogo ou servicoIndice (1, 2, 3…).',
      });
    }
  }

  const servicoNomeRaw = pickServicoNomeFromPayload(payload);
  const servicoNome = isVagueNfItemLabel(servicoNomeRaw) ? '' : servicoNomeRaw;
  let servicoLookupKind = servicoNome ? 'pending' : 'missing';

  if (servicoNome && (!codigo || !cnae || !discriminacao)) {
    const lookup = await findProdutoCatalogoByNome(userId, servicoNome);
    servicoLookupKind = lookup.kind;
    if (lookup.kind === 'ok') {
      applyCatalogProduto(lookup.produto);
    } else if (lookup.kind === 'ambiguous') {
      throw badRequest(formatNfCatalogAmbiguousMessage(servicoNome, lookup.matches, 'NFSE'), {
        code: 'NFSE_SERVICO_AMBIGUOUS',
        servicoNome,
        matches: (lookup.matches || []).map((p) => ({
          id: p.id,
          discriminacao: p.discriminacao,
          codigo: p.codigo,
          cnae: p.cnae,
        })),
        botHint: 'Mostre a lista numerada e use servicoIndice ou codigoServico do catálogo.',
      });
    }
  }

  if (!codigo || !cnae || !discriminacao) {
    if (!catalogNfse.length) {
      throw badRequest(
        'Nenhum serviço cadastrado para NFS-e. Cadastre na app (MEI → Notas) ou use register_nfse_produto.',
        {
          code: 'NFSE_SERVICO_CATALOG_EMPTY',
          botHint: 'Não chame preview_nfse sem serviço no catálogo. Oriente cadastro na app.',
        },
      );
    }

    if (catalogNfse.length === 1 && !servicoNome) {
      applyCatalogProduto(catalogNfse[0]);
    } else if (codigo) {
      const byCodigo = pickProdutoCatalogoByCodigoResult(catalogNfse, codigo, cnae);
      if (byCodigo.kind === 'ok') {
        applyCatalogProduto(byCodigo.produto);
      } else if (servicoNome && servicoLookupKind === 'not_found') {
        throw badRequest(
          formatNfCatalogNotFoundMessage(servicoNome, catalogNfse, 'NFSE'),
          {
            code: 'NFSE_SERVICO_NOT_FOUND',
            servicoNome,
            codigo,
            servicos: catalogNfse.map((p) => ({
              id: p.id,
              discriminacao: p.discriminacao,
              codigo: p.codigo,
              cnae: p.cnae,
            })),
            botHint:
              'Use codigoServico do catálogo (ex.: 140101) ou servicoIndice após list_catalog_servicos. '
              + 'Não invente descrição abreviada.',
          },
        );
      }
    } else if (servicoNome && servicoLookupKind === 'not_found') {
      throw badRequest(
        formatNfCatalogNotFoundMessage(servicoNome, catalogNfse, 'NFSE'),
        {
          code: 'NFSE_SERVICO_NOT_FOUND',
          servicoNome,
          servicos: catalogNfse.map((p) => ({
            id: p.id,
            discriminacao: p.discriminacao,
            codigo: p.codigo,
            cnae: p.cnae,
          })),
          botHint: 'Liste o catálogo e use servicoIndice ou codigoServico antes de preview_nfse.',
        },
      );
    } else {
      throw badRequest(formatNfseCatalogChoiceMessage(catalogNfse), {
        code: 'NFSE_SERVICO_CHOICE_REQUIRED',
        servicos: catalogNfse.map((p) => ({
          id: p.id,
          discriminacao: p.discriminacao,
          codigo: p.codigo,
          cnae: p.cnae,
        })),
        botHint:
          'Use list_catalog_servicos, mostre a lista numerada e chame preview_nfse com servicoIndice '
          + 'ou codigoServico. PROIBIDO inventar serviços que não estão no catálogo.',
      });
    }
  }

  if (!discriminacao || isVagueNfItemLabel(discriminacao)) {
    throw badRequest(formatNfseCatalogChoiceMessage(catalogNfse), {
      code: 'NFSE_SERVICO_CHOICE_REQUIRED',
      botHint: 'Informe descricao/servicoNome com nome exato do catálogo.',
    });
  }

  if (!codigo) {
    throw badRequest(
      `Informe o código do serviço municipal (mín. ${NFSE_SERVICO_CODIGO_MIN_LENGTH} caracteres) ou cadastre um serviço na app.`,
      {
        code: 'NFSE_CODIGO_SERVICO_MISSING',
        botHint:
          'Use list_nfse_produtos para ver o catálogo. Se não existir: register_nfse_produto com '
          + 'discriminacao, codigo (LC116/municipal) e cnae (7 dígitos). Não peça CNAE se já está no catálogo.',
      },
    );
  }

  const codigoNorm = normalizeDoc(codigo) || String(codigo).replace(/\s/g, '');
  if (codigoNorm.length < NFSE_SERVICO_CODIGO_MIN_LENGTH) {
    throw badRequest(
      `Código do serviço inválido (mín. ${NFSE_SERVICO_CODIGO_MIN_LENGTH} caracteres).`,
      { code: 'NFSE_CODIGO_SERVICO_INVALID' },
    );
  }

  if (!cnae) {
    throw badRequest('Informe o CNAE do serviço ou cadastre um serviço padrão na app.', {
      code: 'NFSE_CNAE_MISSING',
      botHint:
        'Use list_nfse_produtos — o CNAE já pode estar no catálogo. '
        + 'Só peça CNAE se não houver produto cadastrado; senão register_nfse_produto.',
    });
  }

  const cnaeNorm = normalizeDoc(cnae).slice(0, 7);
  if (cnaeNorm.length !== 7) {
    throw badRequest('CNAE deve ter 7 dígitos.', { code: 'NFSE_CNAE_INVALID' });
  }

  let aliquota = 0;
  if (aliquotaRaw !== undefined && aliquotaRaw !== null && aliquotaRaw !== '') {
    const parsed = parseValorReais(aliquotaRaw);
    aliquota = parsed !== null ? parsed : Number(aliquotaRaw);
    if (!Number.isFinite(aliquota) || aliquota < 0) {
      throw badRequest('Alíquota ISS inválida.', { code: 'NFSE_ALIQUOTA_INVALID' });
    }
  } else if (!emitente?.simplesNacional) {
    aliquota = 2;
  }

  const codigoFinal = codigoNorm.length >= NFSE_SERVICO_CODIGO_MIN_LENGTH ? codigoNorm : String(codigo).trim();
  const codigoNbsResolved = resolveCodigoNbsForServico({
    codigo: codigoFinal,
    codigoNbs,
  });
  const codigoTributacao = resolveCodigoTributacaoForServico({
    codigoTributacao: firstNonEmpty(
      payload?.codigoTributacao,
      payload?.codigo_tributacao,
      payload?.cTribMun,
    ),
  });

  const servico = {
    codigo: codigoFinal,
    discriminacao,
    cnae: cnaeNorm,
    codigoTributacao,
    ...(codigoNbsResolved ? { codigoNbs: codigoNbsResolved } : {}),
  };

  // MEI/Simples: não informar alíquota ISS (paridade com mei-notas.service buildServicoFromInput).
  if (!emitente?.simplesNacional && aliquota > 0) {
    servico.aliquota = aliquota;
  }

  return servico;
};

const pickTomadorNomeFromPayload = (payload) =>
  firstNonEmpty(
    payload?.tomadorNome,
    payload?.tomadorRazaoSocial,
    payload?.cliente,
    payload?.nome,
    payload?.tomador,
  );

/**
 * Escolhe um cliente do catálogo a partir do resultado de busca por nome.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} nome
 */
export const pickClienteCatalogoByNomeResult = (rows, nome) => {
  const q = normalizeNameForMatch(nome);
  if (!q) return { kind: 'missing' };
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { kind: 'not_found', q: nome };

  const exact = list.filter((r) => normalizeNameForMatch(r.nome) === q);
  if (exact.length === 1) return { kind: 'ok', cliente: exact[0] };

  const allWordsMatch = list.filter((r) => {
    const n = normalizeNameForMatch(r.nome);
    const words = q.split(' ').filter((w) => w.length >= 2);
    if (!words.length) return false;
    return words.every((w) => n.includes(w));
  });
  if (allWordsMatch.length === 1) return { kind: 'ok', cliente: allWordsMatch[0] };

  if (list.length === 1) return { kind: 'ok', cliente: list[0] };

  return {
    kind: 'ambiguous',
    matches: list,
    q: nome,
  };
};

const NFSE_CATALOG_CLIENTES_OPTS = { documentType: 'NFSE' };

const findClienteCatalogoByDocumento = async (userId, documento) => {
  const doc = normalizeDoc(documento);
  if (!doc) return null;
  const rows = await listarCatalogoClientes(userId, { q: doc, limit: 20, ...NFSE_CATALOG_CLIENTES_OPTS });
  return (rows || []).find((r) => normalizeDoc(r.documento) === doc) || null;
};

const findClienteCatalogoByNome = async (userId, nome) => {
  const q = String(nome || '').trim();
  if (!q) return { kind: 'missing' };
  const rows = await listarCatalogoClientes(userId, { q, limit: 20, ...NFSE_CATALOG_CLIENTES_OPTS });
  return pickClienteCatalogoByNomeResult(rows, q);
};

const mapClienteResumo = (cliente) => ({
  id: cliente.id,
  nome: cliente.nome,
  documento: cliente.documento,
  email: cliente.email ?? null,
});

const assertTomadorDocumentoValido = (tomadorDoc) => {
  if (!tomadorDoc) {
    throw badRequest('CPF ou CNPJ do tomador é obrigatório.', {
      code: 'NFSE_TOMADOR_DOC_MISSING',
      botHint:
        'Se o utilizador disse o nome do cliente, use payload.tomadorNome em preview_nfse/emit_nfse '
        + 'ou list_nfse_clientes com payload.q — o CPF/CNPJ já está no catálogo. '
        + 'Só peça documento se o cliente não existir no catálogo.',
    });
  }
  if (tomadorDoc.length !== 11 && tomadorDoc.length !== 14) {
    throw badRequest('CPF/CNPJ do tomador deve ter 11 ou 14 dígitos.', {
      code: 'NFSE_TOMADOR_DOC_INVALID',
      botHint: 'Não invente documentos. Use list_nfse_clientes ou peça o CPF/CNPJ real.',
    });
  }
  if (!isValidCpfOrCnpj(tomadorDoc)) {
    throw badRequest('CPF ou CNPJ do tomador inválido (dígitos verificadores).', {
      code: 'NFSE_TOMADOR_DOC_INVALID',
      botHint:
        'PROIBIDO usar CPF/CNPJ inventado (ex.: 123456789000110). Confirme com o cliente ou cadastre via register_nfse_cliente.',
    });
  }
};

const resolveTomador = async (userId, payload) => {
  let tomadorDoc = normalizeDoc(
    payload?.tomadorCpfCnpj
      || payload?.tomadorCnpj
      || payload?.cnpjTomador
      || payload?.cnpj
      || payload?.cpfCnpj
      || payload?.documento,
  );

  let catalogo = null;

  if (tomadorDoc) {
    assertTomadorDocumentoValido(tomadorDoc);
    catalogo = await findClienteCatalogoByDocumento(userId, tomadorDoc);
  } else {
    const tomadorNome = pickTomadorNomeFromPayload(payload);
    if (!tomadorNome) {
      throw badRequest('Informe o cliente (nome ou CPF/CNPJ).', {
        code: 'NFSE_TOMADOR_MISSING',
        botHint:
          'Quando o utilizador disser "nota para Rafael Reis", use tomadorNome no payload '
          + 'ou list_nfse_clientes com q=Rafael Reis — não peça CPF se o cliente já está cadastrado.',
      });
    }
    const lookup = await findClienteCatalogoByNome(userId, tomadorNome);
    if (lookup.kind === 'not_found') {
      throw badRequest(`Cliente "${tomadorNome}" não encontrado no catálogo NFSe.`, {
        code: 'NFSE_TOMADOR_NOT_IN_CATALOG',
        tomadorNome,
        botHint:
          'Use register_nfse_cliente para cadastrar ou list_nfse_clientes para confirmar o nome.',
      });
    }
    if (lookup.kind === 'ambiguous') {
      throw badRequest(`Vários clientes encontrados para "${tomadorNome}".`, {
        code: 'NFSE_TOMADOR_AMBIGUOUS',
        tomadorNome,
        matches: (lookup.matches || []).map(mapClienteResumo),
        botHint: 'Liste nome + documento de cada match (só catálogo NFSe) e peça ao utilizador para escolher um.',
      });
    }
    catalogo = lookup.cliente;
    tomadorDoc = normalizeDoc(catalogo?.documento || '');
    assertTomadorDocumentoValido(tomadorDoc);
  }

  if (!catalogo) {
    throw badRequest('Cliente não está cadastrado no catálogo NFSe.', {
      code: 'NFSE_TOMADOR_NOT_IN_CATALOG',
      tomadorDocumento: tomadorDoc,
      botHint:
        '1) list_nfse_clientes com nome ou documento. '
        + '2) Se não existir: peça CPF/CNPJ válido, nome/razão social e e-mail; use register_nfse_cliente. '
        + '3) Depois preview_nfse e emit_nfse com confirm:true. Não emita com cliente fantasma.',
    });
  }

  const razaoSocial = String(catalogo.nome || catalogo.metadata_json?.razaoSocial || '').trim();
  if (!razaoSocial) {
    throw badRequest('Cliente no catálogo sem nome. Atualize o cadastro na app ou register_nfse_cliente.', {
      code: 'NFSE_TOMADOR_NOME_MISSING',
      catalogoClienteId: catalogo.id,
    });
  }

  return {
    tomadorCpfCnpj: tomadorDoc,
    tomadorRazaoSocial: razaoSocial,
    tomadorEmail: catalogo.email ? String(catalogo.email).trim() : undefined,
    catalogoClienteId: catalogo.id,
  };
};

const resolveEnderecoForOpenclawCliente = async (userId, documento, payload) => (
  resolveTomadorEmitEndereco(userId, documento, payload)
);

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const mergeClienteMetadataEndereco = (existingMetadata, endereco) => {
  const pruned = pruneEndereco(isPlainObject(endereco) ? endereco : null);
  if (!pruned) return undefined;
  const base = typeof existingMetadata === 'object' && existingMetadata ? existingMetadata : {};
  const existingEndereco = isPlainObject(base.endereco) ? base.endereco : null;
  return {
    ...base,
    endereco: mergeEnderecoLayers(existingEndereco, pruned),
  };
};

const buildClienteMetadataFromEndereco = (endereco, existingMetadata = {}) => (
  mergeClienteMetadataEndereco(existingMetadata, endereco)
);

const buildTomadorEnderecoIncompleteResult = (cliente, savedEndereco) => {
  const nome = String(cliente?.nome || 'Cliente').trim();
  const missingEnderecoFields = listMissingTomadorEnderecoFields(savedEndereco);
  const nextEnderecoField = missingEnderecoFields[0] || null;
  const userMessage = buildTomadorEnderecoMissingUserMessage(nome, savedEndereco);
  const botHint = buildTomadorEnderecoMissingBotHint(nome, savedEndereco);
  return {
    enderecoIncomplete: true,
    enderecoEnriched: Boolean(savedEndereco),
    missingEnderecoFields,
    nextEnderecoField,
    enderecoSalvo: savedEndereco || null,
    userMessage,
    botHint,
  };
};

const persistCatalogEnderecoIfResolved = async (userId, catalogoClienteId, existingMetadata, endereco) => {
  const metadata_json = mergeClienteMetadataEndereco(existingMetadata, endereco);
  if (!metadata_json?.endereco || !catalogoClienteId) return null;
  return atualizarCatalogoCliente(userId, catalogoClienteId, { metadata_json });
};

/**
 * Cadastra tomador no catálogo NFSe (WhatsApp) antes da emissão.
 */
export const registerOpenclawNfseCliente = async (userId, payload = {}) => {
  let documento = normalizeDoc(
    payload?.documento
      || payload?.tomadorCpfCnpj
      || payload?.cnpj
      || payload?.cpfCnpj,
  );

  let existing = documento ? await findClienteCatalogoByDocumento(userId, documento) : null;

  if (!documento) {
    const tomadorNome = pickTomadorNomeFromPayload(payload);
    if (tomadorNome) {
      const lookup = await findClienteCatalogoByNome(userId, tomadorNome);
      if (lookup.kind === 'ok') {
        existing = lookup.cliente;
        documento = normalizeDoc(existing?.documento || '');
      } else if (lookup.kind === 'ambiguous') {
        throw badRequest(`Vários clientes encontrados para "${tomadorNome}".`, {
          code: 'NFSE_TOMADOR_AMBIGUOUS',
          tomadorNome,
          matches: (lookup.matches || []).map(mapClienteResumo),
          botHint: 'Liste nome + documento de cada match e peça ao utilizador para escolher um.',
        });
      }
    }
  }

  assertTomadorDocumentoValido(documento);

  if (!existing) {
    existing = await findClienteCatalogoByDocumento(userId, documento);
  }

  if (existing) {
    const catalogEndereco = await resolveCatalogClienteEndereco(userId, documento);
    if (hasCompleteTomadorEndereco(catalogEndereco)) {
      return {
        alreadyRegistered: true,
        cliente: existing,
      };
    }

    const endereco = await resolveEnderecoForOpenclawCliente(userId, documento, payload);
    const metadata_json = mergeClienteMetadataEndereco(existing.metadata_json, endereco);
    if (metadata_json?.endereco) {
      const cliente = await atualizarCatalogoCliente(userId, existing.id, { metadata_json });
      const savedEndereco = metadata_json.endereco;
      if (hasCompleteTomadorEndereco(savedEndereco)) {
        return {
          alreadyRegistered: true,
          cliente,
          enderecoEnriched: true,
        };
      }
      return {
        alreadyRegistered: true,
        cliente,
        enderecoEnriched: true,
        ...buildTomadorEnderecoIncompleteResult(cliente, savedEndereco),
      };
    }

    return {
      alreadyRegistered: true,
      cliente: existing,
      ...(documento.length === 14
        ? buildTomadorEnderecoIncompleteResult(existing, catalogEndereco)
        : {}),
    };
  }

  let nome = firstNonEmpty(
    payload?.nome,
    payload?.tomadorRazaoSocial,
    payload?.tomadorNome,
    payload?.razaoSocial,
    payload?.cliente,
  );

  if (!nome && documento.length === 14) {
    try {
      const lookup = await lookupCnpjBrasilApi(documento);
      nome = String(lookup?.razaoSocial || lookup?.nomeFantasia || '').trim();
    } catch {
      /* segue */
    }
  }

  if (!nome) {
    throw badRequest('Nome ou razão social do cliente é obrigatório para cadastro.', {
      code: 'NFSE_CLIENTE_NOME_MISSING',
      botHint: 'Peça o nome completo (PF) ou razão social (PJ) antes de register_nfse_cliente.',
    });
  }

  const emailRaw = firstNonEmpty(payload?.email, payload?.tomadorEmail);
  const endereco = await resolveEnderecoForOpenclawCliente(userId, documento, payload);
  const metadata_json = buildClienteMetadataFromEndereco(endereco);
  const cliente = await criarCatalogoCliente(userId, {
    documento,
    nome,
    ...(emailRaw ? { email: emailRaw } : {}),
    ...(metadata_json ? { metadata_json } : {}),
  });

  const savedEndereco = metadata_json?.endereco;
  const enderecoComplete = hasCompleteTomadorEndereco(savedEndereco);

  return {
    alreadyRegistered: false,
    cliente,
    ...(documento.length === 14 && !enderecoComplete
      ? buildTomadorEnderecoIncompleteResult(cliente, savedEndereco)
      : {}),
  };
};

const assertProdutoCodigoValido = (codigo) => {
  const codigoNorm = normalizeDoc(codigo) || String(codigo || '').replace(/\s/g, '');
  if (codigoNorm.length < NFSE_SERVICO_CODIGO_MIN_LENGTH) {
    throw badRequest(
      `Código do serviço inválido (mín. ${NFSE_SERVICO_CODIGO_MIN_LENGTH} caracteres).`,
      { code: 'NFSE_CODIGO_SERVICO_INVALID' },
    );
  }
  return codigoNorm.length >= NFSE_SERVICO_CODIGO_MIN_LENGTH ? codigoNorm : String(codigo).trim();
};

const assertProdutoCnaeValido = (cnae) => {
  const cnaeNorm = normalizeDoc(cnae).slice(0, 7);
  if (cnaeNorm.length !== 7) {
    throw badRequest('CNAE deve ter 7 dígitos.', { code: 'NFSE_CNAE_INVALID' });
  }
  return cnaeNorm;
};

/**
 * Cadastra serviço/produto no catálogo NFSe (WhatsApp).
 */
export const registerOpenclawNfseProduto = async (userId, payload = {}) => {
  const discriminacao = firstNonEmpty(
    payload?.discriminacao,
    payload?.descricao,
    payload?.descricaoServico,
    payload?.produtoNome,
    payload?.produto,
    payload?.servico,
    payload?.nome,
  );
  if (!discriminacao) {
    throw badRequest('Descrição do serviço (discriminação) é obrigatória.', {
      code: 'NFSE_PRODUTO_DISCRIMINACAO_MISSING',
      botHint: 'Peça: nome/descrição do serviço, código municipal (LC116) e CNAE (7 dígitos).',
    });
  }

  const codigo = assertProdutoCodigoValido(
    firstNonEmpty(payload?.codigoServico, payload?.codigo),
  );
  const cnae = assertProdutoCnaeValido(firstNonEmpty(payload?.cnae));

  const existingByCodigoCnae = await findProdutoCatalogoByCodigoCnae(userId, codigo, cnae);
  if (existingByCodigoCnae.kind === 'ok') {
    return {
      alreadyRegistered: true,
      produto: existingByCodigoCnae.produto,
      dedupeReason: 'codigo_cnae',
    };
  }
  if (existingByCodigoCnae.kind === 'ambiguous') {
    return {
      alreadyRegistered: true,
      produto: existingByCodigoCnae.matches[0],
      dedupeReason: 'codigo_cnae_duplicados',
    };
  }

  const existingLookup = await findProdutoCatalogoByNome(userId, discriminacao);
  if (existingLookup.kind === 'ok') {
    return { alreadyRegistered: true, produto: existingLookup.produto, dedupeReason: 'discriminacao' };
  }

  const aliquotaRaw = payload?.aliquota ?? payload?.aliquotaIss;
  const valorRaw = payload?.valorSugerido ?? payload?.valor_sugerido ?? payload?.valor;

  const produto = await criarCatalogoProduto(userId, {
    discriminacao,
    codigo,
    cnae,
    ...(aliquotaRaw !== undefined && aliquotaRaw !== null && aliquotaRaw !== ''
      ? { aliquota: aliquotaRaw }
      : {}),
    ...(valorRaw !== undefined && valorRaw !== null && valorRaw !== ''
      ? { valor_sugerido: valorRaw }
      : {}),
  });

  return { alreadyRegistered: false, produto };
};

const emitenteMissingAddressFields = (emitente) => {
  if (!emitente) return true;
  if (!buildPrestadorLogradouro(emitente)) return true;
  if (!String(emitente.numero || '').trim()) return true;
  if (!String(emitente.codigoCidade || '').trim()) return true;
  if (normalizeDoc(emitente.cep).length !== 8) return true;
  return false;
};

const sanitizeHealError = (err) => {
  const code = err?.errors?.plugnotasCode || err?.code || null;
  const status = err?.status || err?.errors?.status || null;
  const message = String(err?.message || '').trim().slice(0, 180) || null;
  return { code, status, message };
};

const completeEmitenteFromEmpresaJson = async (userId, emitente, empresaJson, source) => {
  const partial = empresaJsonToEmitentePartial(empresaJson);
  if (!partial) return null;
  await reconcileEmitenteMirrorFromEmpresaJson(userId, empresaJson).catch(() => {});
  const synced = await getEmitenteNfseSnapshot(userId);
  if (synced && !emitenteMissingAddressFields(synced)) {
    return {
      emitente: synced,
      heal: { attempted: true, ok: true, source: `${source}_mirror` },
    };
  }
  const merged = mergeEmitenteWithEmpresaPartial(emitente, partial);
  if (merged && !emitenteMissingAddressFields(merged)) {
    return {
      emitente: merged,
      heal: { attempted: true, ok: true, source: `${source}_merge` },
    };
  }
  return null;
};

/** Preenche emitente a partir do Plugnotas (ou BrasilAPI) quando o espelho local está incompleto. */
const resolveEmitenteForNfseSetup = async (userId, emitenteRaw, certOk) => {
  let emitente = emitenteRaw || null;
  let cnpj = normalizeDoc(emitente?.certDocument || '');
  if (cnpj.length !== 14 && certOk) {
    const doc = await getCertificateDocument(userId);
    cnpj = normalizeDoc(doc || '');
    if (cnpj.length === 14) {
      emitente = { ...(emitente || {}), certDocument: cnpj };
    }
  }
  if (cnpj.length !== 14) {
    return { emitente, heal: { attempted: false, reason: 'cnpj_missing' } };
  }
  if (emitente && !emitenteMissingAddressFields(emitente)) {
    return { emitente, heal: { attempted: false, reason: 'already_complete' } };
  }

  let plugnotasError = null;
  try {
    const empresa = await consultarEmpresaAndReconcileMirror(userId, cnpj);
    const fromPlugnotas = await completeEmitenteFromEmpresaJson(
      userId,
      emitente,
      empresa,
      'plugnotas_empresa',
    );
    if (fromPlugnotas) return fromPlugnotas;
  } catch (err) {
    plugnotasError = sanitizeHealError(err);
  }

  try {
    const lookup = await lookupCnpjBrasilApi(cnpj);
    const fromBrasilApi = await completeEmitenteFromEmpresaJson(
      userId,
      emitente,
      lookup,
      'brasilapi_cnpj',
    );
    if (fromBrasilApi) {
      return {
        ...fromBrasilApi,
        heal: {
          ...fromBrasilApi.heal,
          plugnotasError,
        },
      };
    }
  } catch (brasilApiError) {
    return {
      emitente,
      heal: {
        attempted: true,
        ok: false,
        reason: 'all_sources_failed',
        plugnotasError,
        brasilApiError: sanitizeHealError(brasilApiError),
      },
    };
  }

  return {
    emitente,
    heal: {
      attempted: true,
      ok: false,
      reason: 'endereco_nao_resolvido',
      plugnotasError,
    },
  };
};

/**
 * Monta input de emissão NFSe para o bot (validação sem chamar Plugnotas).
 * @param {string} userId
 * @param {object} payload
 */
export const buildOpenclawNfseEmitInput = async (userId, payload = {}) => {
  const certOk = await hasCertificate(userId);
  const emitenteRaw = await getEmitenteNfseSnapshot(userId);
  const { emitente } = await resolveEmitenteForNfseSetup(userId, emitenteRaw, certOk);
  if (!emitente || emitenteMissingAddressFields(emitente)) {
    throw badRequest('Dados fiscais do prestador incompletos. Configure na app Meu Financeiro → MEI.', {
      code: 'NFSE_EMITENTE_MISSING',
      botHint: 'Certificado A1 + endereço fiscal na app.',
    });
  }

  const valorServico = parseValorReais(
    payload?.valorServico ?? payload?.valor ?? payload?.valorReais,
  );
  if (valorServico === null) {
    throw badRequest('Valor do serviço inválido ou ausente.', {
      code: 'NFSE_VALOR_MISSING',
      botHint: 'Ex.: 1200 ou "1.200,00".',
    });
  }

  const servicoBase = await resolveServicoDefaults(userId, payload, emitente);
  const tomador = await resolveTomador(userId, payload);
  const prestador = emitenteToPrestadorInput(emitente);
  const tomadorDoc = normalizeDoc(tomador.tomadorCpfCnpj || '');
  const tomadorEndereco = tomadorDoc.length === 14
    ? await resolveTomadorEmitEndereco(userId, tomadorDoc, payload)
    : null;

  if (tomadorDoc.length === 14 && !hasCompleteTomadorEndereco(tomadorEndereco)) {
    const tomadorNome = String(tomador.tomadorRazaoSocial || payload?.tomadorNome || '').trim();
    const userMessage = buildTomadorEnderecoMissingUserMessage(tomadorNome, tomadorEndereco);
    throw badRequest(userMessage || 'Endereço fiscal do tomador (CNPJ) incompleto.', {
      code: 'NFSE_TOMADOR_ENDERECO_INCOMPLETE',
      missingEnderecoFields: listMissingTomadorEnderecoFields(tomadorEndereco),
      nextEnderecoField: listMissingTomadorEnderecoFields(tomadorEndereco)[0] || null,
      botHint: buildTomadorEnderecoMissingBotHint(tomadorNome, tomadorEndereco),
    });
  }

  if (tomadorDoc.length === 14 && hasCompleteTomadorEndereco(tomadorEndereco) && tomador.catalogoClienteId) {
    try {
      const catalogo = await findClienteCatalogoByDocumento(userId, tomadorDoc);
      await persistCatalogEnderecoIfResolved(
        userId,
        tomador.catalogoClienteId,
        catalogo?.metadata_json,
        tomadorEndereco,
      );
    } catch {
      /* catálogo opcional na emissão */
    }
  }

  return {
    documentType: 'NFSE',
    ...prestador,
    ...tomador,
    ...(tomadorEndereco ? { tomadorEndereco } : {}),
    servico: {
      ...servicoBase,
      valorServico,
    },
    metadata: {
      source: 'openclaw_whatsapp',
      ...(payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    },
  };
};

/**
 * Estado de prontidão para emitir NFSe pelo WhatsApp.
 */
export const getOpenclawNfseSetupStatus = async (userId) => {
  const [certOk, plugId, emitenteRaw] = await Promise.all([
    hasCertificate(userId),
    getPlugNotasCertId(userId),
    getEmitenteNfseSnapshot(userId),
  ]);

  const { emitente, heal } = await resolveEmitenteForNfseSetup(userId, emitenteRaw, certOk);

  const missing = [];
  if (!certOk) missing.push('certificado_a1');
  if (!plugId) missing.push('plugnotas_certificado');
  if (!emitente) missing.push('dados_fiscais_prestador');
  else {
    const cnpj = normalizeDoc(emitente.certDocument || '');
    if (cnpj.length !== 14) missing.push('prestador_cnpj');
    const logradouro = buildPrestadorLogradouro(emitente);
    if (!logradouro) missing.push('prestador_logradouro');
    if (!String(emitente.numero || '').trim()) missing.push('prestador_numero');
    if (!String(emitente.codigoCidade || '').trim()) missing.push('prestador_codigo_ibge');
    if (normalizeDoc(emitente.cep).length !== 8) missing.push('prestador_cep');
  }

  let defaultServico = null;
  let catalogCounts = { nfse: 0, nfe: 0 };
  let documentosPermitidos = { nfse: true, nfe: false, nfce: false };
  try {
    const [produtosNfse, produtosNfe, docs] = await Promise.all([
      listarCatalogoProdutos(userId, { limit: 30, documentType: 'NFSE' }),
      listarCatalogoProdutos(userId, { limit: 30, documentType: 'NFE' }),
      getDocumentosAtivosMirror(userId),
    ]);
    catalogCounts = { nfse: produtosNfse.length, nfe: produtosNfe.length };
    documentosPermitidos = docs;
    if (produtosNfse?.[0]) {
      defaultServico = {
        codigo: produtosNfse[0].codigo,
        cnae: produtosNfse[0].cnae,
        discriminacao: produtosNfse[0].discriminacao,
        aliquota: produtosNfse[0].aliquota,
      };
    }
  } catch {
    /* opcional */
  }

  return {
    buildId: BACKEND_BUILD_ID,
    ready: missing.length === 0,
    missing,
    hasCertificate: certOk,
    hasPlugnotasCertId: Boolean(plugId),
    prestadorCnpj: emitente?.certDocument ? normalizeDoc(emitente.certDocument) : null,
    prestadorRazaoSocial: emitente?.razaoSocial || null,
    defaultServico,
    catalogCounts,
    documentosPermitidos,
    heal: heal || null,
  };
};

/** Força heal do prestador (Plugnotas → BrasilAPI) e devolve diagnóstico completo. */
export const syncOpenclawNfseEmitente = async (userId) => {
  const [certOk, emitenteRaw] = await Promise.all([
    hasCertificate(userId),
    getEmitenteNfseSnapshot(userId),
  ]);
  const { emitente, heal } = await resolveEmitenteForNfseSetup(userId, emitenteRaw, certOk);
  return {
    buildId: BACKEND_BUILD_ID,
    heal,
    emitente: emitente
      ? {
        certDocument: emitente.certDocument || null,
        razaoSocial: emitente.razaoSocial || null,
        logradouro: emitente.logradouro || null,
        numero: emitente.numero || null,
        codigoCidade: emitente.codigoCidade || null,
        cep: emitente.cep || null,
      }
      : null,
    addressComplete: Boolean(emitente && !emitenteMissingAddressFields(emitente)),
  };
};

export const previewOpenclawNfseEmit = async (userId, payload = {}) => {
  const input = await buildOpenclawNfseEmitInput(userId, payload);
  return {
    documentType: 'NFSE',
    tomadorCpfCnpj: input.tomadorCpfCnpj,
    tomadorRazaoSocial: input.tomadorRazaoSocial,
    valorServico: input.servico.valorServico,
    discriminacao: input.servico.discriminacao,
    codigoServico: input.servico.codigo,
    cnae: input.servico.cnae,
    aliquota: input.servico.aliquota,
    prestadorCnpj: input.prestadorCpfCnpj,
  };
};

/**
 * Emite NFSe (Plugnotas) para utilizador identificado pelo telefone.
 */
export const emitOpenclawNfse = async (userId, payload = {}) => {
  const input = await buildOpenclawNfseEmitInput(userId, payload);
  if (!isNfEmitConfirmed(payload)) {
    const preview = {
      documentType: 'NFSE',
      tomadorCpfCnpj: input.tomadorCpfCnpj,
      tomadorRazaoSocial: input.tomadorRazaoSocial,
      valorServico: input.servico.valorServico,
      discriminacao: input.servico.discriminacao,
      codigoServico: input.servico.codigo,
      cnae: input.servico.cnae,
      aliquota: input.servico.aliquota,
    };
    return {
      preview,
      requiresConfirm: true,
      notEmitted: true,
    };
  }

  const created = await emitirNota(userId, input);
  const preview = {
    documentType: 'NFSE',
    tomadorRazaoSocial: input.tomadorRazaoSocial,
    tomadorCpfCnpj: input.tomadorCpfCnpj,
    valorServico: input.servico.valorServico,
    discriminacao: input.servico.discriminacao,
    codigoServico: input.servico.codigo,
  };
  return { nota: created, preview, requiresConfirm: false, notEmitted: false };
};

export const listOpenclawNfseNotas = async (userId, { limit = 10 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 40);
  const rows = await listarNotas(userId, { documentType: 'NFSE', limit: safeLimit });
  return (rows || []).map((r) => ({
    id: r.id,
    status: r.status,
    plugnotas_id: r.plugnotas_id,
    cnpj_tomador: r.cnpj_tomador,
    created_at: r.created_at,
    pdf_url: r.pdf_url,
    xml_url: r.xml_url,
  }));
};

/** Status em que o PDF costuma existir na Plugnotas. */
export const isNfsePdfReadyStatus = (status) => {
  const s = String(status || '').trim().toLowerCase();
  return s === 'concluido' || s.includes('autoriz');
};

export const consultOpenclawNfse = async (userId, { id, sync = true } = {}) => {
  const recordId = String(id || '').trim();
  if (!recordId) throw badRequest('payload.id da nota é obrigatório');
  const record = await obterNota(userId, recordId, { sync: sync !== false });

  let whatsappDeliveryAttempt = null;
  try {
    const { tryDeliverPendingOpenclawNfseIfReady } = await import('./nfse-whatsapp-delivery.service.js');
    whatsappDeliveryAttempt = await tryDeliverPendingOpenclawNfseIfReady(userId, record);
  } catch (err) {
    console.warn('[openclaw-nfse] entrega WhatsApp pós-consulta falhou', {
      notaId: recordId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    id: record.id,
    status: record.status,
    plugnotas_id: record.plugnotas_id,
    cnpj_tomador: record.cnpj_tomador,
    pdf_url: record.pdf_url,
    xml_url: record.xml_url,
    created_at: record.created_at,
    updated_at: record.updated_at,
    pdfReady: isNfsePdfReadyStatus(record?.status),
    whatsappDeliveryAttempt,
  };
};

const buildNfsePdfFileName = (record) => {
  const short = String(record?.id || 'nota').slice(0, 8);
  const tomador = String(record?.cnpj_tomador || '').replace(/\D/g, '').slice(-6) || 'nfse';
  return `NFSe-${tomador}-${short}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Sincroniza a nota (opcional), valida status e devolve PDF em base64 para OpenClaw / WhatsApp.
 */
export const fetchOpenclawNfsePdfBase64 = async (userId, { id, sync = true } = {}) => {
  const recordId = String(id || '').trim();
  if (!recordId) {
    throw badRequest('payload.id da nota é obrigatório', { code: 'NFSE_ID_REQUIRED' });
  }
  const record = await obterNota(userId, recordId, { sync: sync !== false });
  if (!isNfsePdfReadyStatus(record?.status)) {
    throw badRequest(
      `NFSe ainda não está pronta para PDF (status: ${record?.status || 'processando'}).`,
      {
        code: 'NFSE_PDF_NOT_READY',
        botHint:
          'Consulte com consult_nfse (sync) até status concluido; depois mf-nfse-send.sh TELEFONE UUID.',
        status: record?.status,
        notaId: record.id,
      },
    );
  }
  const file = await baixarPdf(userId, recordId);
  const buffer = file?.buffer;
  if (!buffer?.length) {
    throw badRequest('PDF da NFSe vazio ou indisponível', { code: 'NFSE_PDF_EMPTY' });
  }
  return {
    base64: Buffer.from(buffer).toString('base64'),
    fileName: buildNfsePdfFileName(record),
    mimeType: file.contentType || 'application/pdf',
    nota: {
      id: record.id,
      status: record.status,
      plugnotas_id: record.plugnotas_id,
      cnpj_tomador: record.cnpj_tomador,
    },
  };
};

export const listOpenclawNfseClientes = async (userId, { q = '', limit = 20 } = {}) =>
  listarCatalogoClientes(userId, { q, limit, documentType: 'NFSE' });

export const listOpenclawNfseProdutos = async (userId, { q = '', limit = 20, documentType } = {}) =>
  listarCatalogoProdutos(userId, { q, limit, ...(documentType ? { documentType } : {}) });

export const formatOpenclawNfseProdutosMessage = (produtos) => {
  const list = Array.isArray(produtos) ? produtos : [];
  if (!list.length) {
    return 'Nenhum serviço/produto no catálogo NFSe. Cadastre na app (MEI → Notas) ou use register_nfse_produto.';
  }
  const lines = list.map((p, i) => {
    const nome = String(p.discriminacao || '—').trim();
    const codigo = p.codigo ? `cód. ${p.codigo}` : 'sem código';
    const cnae = p.cnae ? `CNAE ${p.cnae}` : 'sem CNAE';
    const ali = p.aliquota != null ? `ISS ${p.aliquota}%` : '';
    return `${i + 1}. ${nome} (${codigo}, ${cnae}${ali ? `, ${ali}` : ''})`;
  });
  return `${list.length} serviço(s) no catálogo NFSe:\n${lines.join('\n')}`;
};

export const rethrowNfseErrorForBot = (err) => {
  const code = err?.errors?.code || err?.code;
  const existingHint = err?.errors?.botHint || err?.botHint;
  const rawMsg = String(err?.message || '');
  const userMessage = formatNfseEmitErrorForUser(rawMsg);
  const loopGuard = `${BOT_NF_EMIT_FAILED_INSTRUCTION} ${existingHint || ''}`.trim();

  if (code === 'NFSE_TOMADOR_ENDERECO_INCOMPLETE') {
    throw badRequest(rawMsg || userMessage, {
      code,
      botHint: existingHint,
      missingEnderecoFields: err?.errors?.missingEnderecoFields,
      nextEnderecoField: err?.errors?.nextEnderecoField,
    });
  }

  if (existingHint) {
    throw badRequest(userMessage, { code, botHint: loopGuard });
  }
  if (/alinhar a numeração|operation was aborted|aborted/i.test(rawMsg)) {
    throw badRequest(userMessage, {
      code: code || 'NFSE_RPS_SYNC',
      botHint: loopGuard,
    });
  }
  if (/certificado|plugnotas/i.test(rawMsg)) {
    throw badRequest(userMessage, {
      code: code || 'NFSE_PLUGNOTAS',
      botHint: loopGuard,
    });
  }
  throw err;
};

/** Reutilizado por NF-e (OpenClaw). */
export const resolveOpenclawTomador = resolveTomador;
export {
  resolveEmitenteForNfseSetup,
  emitenteMissingAddressFields,
  emitenteToPrestadorInput,
};
