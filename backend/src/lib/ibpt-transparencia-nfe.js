/**
 * Aplica transparência fiscal (Lei 12.741/2012) em payload NF-e/NFC-e via IBPT.
 */

import { env, normalizeEnvSecret } from '../config/env.js';
import {
  extractNfeItemQuantidade,
  extractNfeItemValorUnitario,
  toPlugnotasNumber,
} from '../services/plugnotas/plugnotas-nfe-payload.js';
import {
  calcularBreakdownTributosIbpt,
  calcularValorTributosIbpt,
  consultarProdutoIbpt,
  formatMoedaBr,
  isIbptConfigured,
  isIbptOfflineError,
  resolveIbptFallbackAliquotas,
} from '../services/ibpt.service.js';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const formatPercentBr = (value) => round2(value).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const emptyIbptMeta = (overrides = {}) => ({
  status: 'skipped',
  tokenConfigured: isIbptConfigured(),
  itemsTotal: 0,
  itemsEnriched: 0,
  itemsFailed: 0,
  itemsEstimated: 0,
  authError: false,
  totalTributos: 0,
  errors: [],
  ...overrides,
});

const extractItemValorProduto = (item) => {
  if (!item || typeof item !== 'object') return 0;
  const valorDireto = toPlugnotasNumber(item.valor);
  if (valorDireto != null && valorDireto > 0) return valorDireto;

  const qtd = extractNfeItemQuantidade(item);
  const vu = extractNfeItemValorUnitario(item);
  if (qtd != null && vu != null && qtd > 0 && vu > 0) return qtd * vu;
  return 0;
};

const resolveEmitenteUf = (payload, empresaPlugnotas) => {
  const fromPayload = String(
    payload?.emitente?.endereco?.estado
    || payload?.emitente?.endereco?.uf
    || '',
  ).trim().toUpperCase().slice(0, 2);
  if (fromPayload.length === 2) return fromPayload;

  const fromEmpresa = String(
    empresaPlugnotas?.endereco?.estado
    || empresaPlugnotas?.endereco?.uf
    || empresaPlugnotas?.uf
    || '',
  ).trim().toUpperCase().slice(0, 2);
  if (fromEmpresa.length === 2) return fromEmpresa;

  return '';
};

const isIbptAuthError = (error) => {
  const status = Number(error?.status);
  if (status === 401 || status === 403) return true;
  const message = String(error?.message || '').toUpperCase();
  return message.includes('IBPT_HTTP_401')
    || message.includes('IBPT_HTTP_403')
    || message.includes('TOKEN')
    || message.includes('IBPT_TOKEN_AUSENTE');
};

export const buildInformacoesComplementaresIbpt = ({
  totalTributos,
  totalValorProdutos,
  fonte,
}) => {
  if (!totalTributos || totalTributos <= 0) return '';

  const pct = totalValorProdutos > 0
    ? round2((totalTributos / totalValorProdutos) * 100)
    : null;
  const pctTxt = pct != null ? ` (${formatPercentBr(pct)}%)` : '';
  const fonteTxt = String(fonte || 'IBPT').trim() || 'IBPT';

  return `Val Aprox Tributos R$ ${formatMoedaBr(totalTributos)}${pctTxt} Fonte: ${fonteTxt}`;
};

export const mergeInformacoesComplementares = (existing, ibptText) => {
  const base = String(existing || '').trim();
  const extra = String(ibptText || '').trim();
  if (!extra) return base || undefined;
  if (!base) return extra;
  if (base.includes(extra)) return base;
  return `${base} ${extra}`.trim();
};

/** Garante texto IBPT em campos aceitos pelo PlugNotas (infCpl) e alias observacoes. */
export const applyIbptComplementarFieldsToPayload = (payload, ibptText) => {
  if (!ibptText) return payload;

  const next = {
    ...payload,
    informacoesComplementares: mergeInformacoesComplementares(payload.informacoesComplementares, ibptText),
  };

  if (payload?.observacoes !== undefined && payload?.observacoes !== null) {
    next.observacoes = mergeInformacoesComplementares(payload.observacoes, ibptText);
  }

  return next;
};

const enrichItemWithAliquotas = (item, aliquotas, valorProduto) => {
  const tributosAtual = item?.tributos && typeof item.tributos === 'object' ? item.tributos : {};
  const origem = item?.tributos?.icms?.origem ?? '0';
  const breakdown = calcularBreakdownTributosIbpt(aliquotas, valorProduto, origem);
  const vTotTrib = breakdown.total > 0
    ? breakdown.total
    : calcularValorTributosIbpt(aliquotas, valorProduto, origem);

  return {
    item: {
      ...item,
      tributos: {
        ...tributosAtual,
        ...(vTotTrib > 0 ? { valorAproximadoTributos: vTotTrib } : {}),
      },
    },
    vTotTrib,
    fonte: aliquotas?.fonte,
    versao: aliquotas?.versao,
    estimated: Boolean(aliquotas?.estimated),
  };
};

/**
 * Enriquece itens com tributos.valorAproximadoTributos e informacoesComplementares da nota.
 * Falhas de rede IBPT usam estimativa local — não bloqueiam emissão.
 * @returns {Promise<{ payload: object, ibpt: object }>}
 */
export const applyIbptTransparenciaToNfePayload = async (payload, options = {}) => {
  if (!payload || typeof payload !== 'object') {
    return { payload, ibpt: emptyIbptMeta({ reason: 'payload_invalido' }) };
  }

  const tokenConfigured = Boolean(isIbptConfigured() || normalizeEnvSecret(options.token));
  if (!tokenConfigured) {
    return {
      payload,
      ibpt: emptyIbptMeta({ reason: 'token_nao_configurado' }),
    };
  }

  const token = normalizeEnvSecret(options.token || env.IBPT_API_TOKEN);
  const cnpj = onlyDigits(options.cnpj || payload?.emitente?.cpfCnpj, 14);
  const uf = resolveEmitenteUf(payload, options.empresaPlugnotas);

  if (!token) {
    return {
      payload,
      ibpt: emptyIbptMeta({ tokenConfigured: false, reason: 'token_vazio' }),
    };
  }
  if (cnpj.length !== 14) {
    return {
      payload,
      ibpt: emptyIbptMeta({ tokenConfigured: true, reason: 'cnpj_emitente_invalido' }),
    };
  }
  if (uf.length !== 2) {
    return {
      payload,
      ibpt: emptyIbptMeta({ tokenConfigured: true, reason: 'uf_emitente_ausente' }),
    };
  }

  const itens = Array.isArray(payload.itens) ? payload.itens : [];
  if (!itens.length) {
    return {
      payload,
      ibpt: emptyIbptMeta({ tokenConfigured: true, reason: 'sem_itens' }),
    };
  }

  let totalNota = 0;
  let totalValorProdutos = 0;
  let fonteRef = null;
  let versaoRef = null;
  let itemsEnriched = 0;
  let itemsFailed = 0;
  let itemsEstimated = 0;
  let authError = false;
  let offlineError = false;
  /** @type {Array<{ ncm: string, message: string, authError?: boolean, offline?: boolean, estimated?: boolean }>} */
  const errors = [];

  const nextItens = [];

  for (const item of itens) {
    const ncm = onlyDigits(item?.ncm, 8);
    const valorProduto = extractItemValorProduto(item);

    if (ncm.length !== 8 || valorProduto <= 0) {
      nextItens.push(item);
      continue;
    }

    totalValorProdutos += valorProduto;

    const tributosAtual = item?.tributos && typeof item.tributos === 'object' ? item.tributos : {};
    const jaInformado = toPlugnotasNumber(tributosAtual.valorAproximadoTributos);
    if (jaInformado != null && jaInformado > 0) {
      totalNota += jaInformado;
      itemsEnriched += 1;
      nextItens.push(item);
      continue;
    }

    const applyEnrichment = (aliquotas) => {
      const enriched = enrichItemWithAliquotas(item, aliquotas, valorProduto);
      if (enriched.vTotTrib > 0) {
        totalNota += enriched.vTotTrib;
        itemsEnriched += 1;
        fonteRef = fonteRef || enriched.fonte;
        versaoRef = versaoRef || enriched.versao;
        if (enriched.estimated) itemsEstimated += 1;
      }
      nextItens.push(enriched.item);
      return enriched;
    };

    try {
      const aliquotas = await consultarProdutoIbpt({
        token,
        cnpj,
        codigoNcm: ncm,
        uf,
        ex: '0',
        descricao: String(item.descricao || 'Produto').trim() || 'Produto',
        unidadeMedida: String(item.unidadeComercial || item.unidade || 'UN').trim() || 'UN',
        valor: valorProduto.toFixed(2),
        gtin: 'SEM GTIN',
      });

      applyEnrichment(aliquotas);
    } catch (err) {
      const auth = isIbptAuthError(err);
      const offline = isIbptOfflineError(err);
      if (auth) authError = true;
      if (offline) offlineError = true;

      if (offline && !auth) {
        const fallback = resolveIbptFallbackAliquotas(ncm);
        const enriched = applyEnrichment(fallback);
        if (enriched.vTotTrib > 0) {
          errors.push({
            ncm,
            message: err instanceof Error ? err.message : String(err),
            offline: true,
            estimated: true,
          });
        } else {
          itemsFailed += 1;
          errors.push({
            ncm,
            message: err instanceof Error ? err.message : String(err),
            offline: true,
          });
          nextItens.pop();
          nextItens.push(item);
        }
        continue;
      }

      itemsFailed += 1;
      errors.push({
        ncm,
        message: err instanceof Error ? err.message : String(err),
        authError: auth,
        offline,
      });
      nextItens.push(item);
    }
  }

  const ibptInfo = buildInformacoesComplementaresIbpt({
    totalTributos: totalNota,
    totalValorProdutos,
    fonte: fonteRef || (itemsEstimated > 0 ? 'IBPT' : null),
  });

  const eligibleItems = itens.filter((item) => {
    const ncm = onlyDigits(item?.ncm, 8);
    const valorProduto = extractItemValorProduto(item);
    return ncm.length === 8 && valorProduto > 0;
  }).length;

  let status = 'skipped';
  if (authError) status = 'auth_error';
  else if (itemsEnriched > 0 && itemsEstimated === itemsEnriched) status = 'offline_estimated';
  else if (itemsEnriched > 0 && itemsEstimated > 0) status = 'partial_estimated';
  else if (offlineError && itemsEnriched === 0) status = 'offline';
  else if (itemsEnriched > 0 && itemsFailed === 0) status = 'ok';
  else if (itemsEnriched > 0 && itemsFailed > 0) status = 'partial';
  else if (itemsFailed > 0) status = offlineError ? 'offline' : 'error';

  const nextPayload = applyIbptComplementarFieldsToPayload(
    { ...payload, itens: nextItens },
    ibptInfo,
  );

  return {
    payload: nextPayload,
    ibpt: {
      status,
      tokenConfigured: true,
      uf,
      itemsTotal: eligibleItems,
      itemsEnriched,
      itemsFailed,
      itemsEstimated,
      authError,
      offline: offlineError,
      estimated: itemsEstimated > 0,
      totalTributos: totalNota,
      fonte: fonteRef,
      versao: versaoRef,
      errors,
    },
  };
};

export const logIbptTransparenciaEmit = (ibptMeta, context = {}) => {
  const meta = ibptMeta || emptyIbptMeta();
  const prefix = '[nfe-emit][ibpt]';
  const line = {
    status: meta.status,
    tokenConfigured: meta.tokenConfigured,
    uf: meta.uf || null,
    itemsTotal: meta.itemsTotal,
    itemsEnriched: meta.itemsEnriched,
    itemsFailed: meta.itemsFailed,
    itemsEstimated: meta.itemsEstimated,
    authError: meta.authError,
    offline: meta.offline,
    estimated: meta.estimated,
    totalTributos: meta.totalTributos,
    cnpjEmitente: context.cnpjEmitente || null,
    documentType: context.documentType || null,
    reason: meta.reason || null,
    errors: meta.errors?.slice(0, 3) || [],
  };

  if (meta.status === 'auth_error' || meta.authError) {
    console.error(`${prefix} falha de autenticação IBPT — verifique IBPT_API_TOKEN`, line);
    return;
  }
  if (meta.status === 'offline_estimated' || meta.status === 'partial_estimated') {
    console.warn(`${prefix} offline — estimativa local IBPT aplicada`, line);
    return;
  }
  if (meta.status === 'offline' || meta.offline) {
    console.warn(`${prefix} offline - emissão mantida`, line);
    return;
  }
  if (meta.status === 'ok' || meta.status === 'partial') {
    console.log(`${prefix} transparência fiscal aplicada`, line);
    return;
  }
  if (meta.status === 'error') {
    console.warn(`${prefix} IBPT indisponível para alguns itens`, line);
    return;
  }
  console.log(`${prefix} IBPT não aplicado`, line);
};
