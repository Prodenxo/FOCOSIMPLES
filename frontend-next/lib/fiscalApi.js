import { apiClient, EMIT_FETCH_TIMEOUT_MS } from '@/lib/apiClient';
import { getLocalAccessToken } from '@/lib/authSession';
import {
  normalizeNotaForUi,
  notaFiscalPodeSincronizarEstadoEmissor,
  notaFiscalStatusPrecisaSyncAutomatico,
} from '@/lib/notaFiscalDisplay';

/**
 * Tipos do módulo fiscal (notas, certificado, DAS, parcelamentos).
 * Apenas tipos JSDoc para auxiliar IDEs sem introduzir TypeScript.
 *
 * @typedef {'pago'|'a_pagar'|'sem_debito'|'a_declarar'|'erro'|'indisponivel'} DasStatus
 * @typedef {'pago'|'a_pagar'|'liberada'|'indisponivel'} ParcelaSituacao
 *
 * @typedef DasPeriod
 * @property {string} competencia
 * @property {DasStatus} status
 * @property {boolean} [podeDeclarar]
 * @property {string} [guideId]
 * @property {string} [errorMessage]
 * @property {boolean} [vencida]
 * @property {string} [vencimento]
 * @property {number} [valorTotal]
 * @property {string} [periodoApuracao]
 * @property {string} [numeroDocumento]
 * @property {boolean} [hasLocalPdf]
 * @property {boolean} [hasDas]
 *
 * @typedef CertificateStatus
 * @property {boolean} hasUserCertificate
 * @property {boolean} hasEnvCertificate
 * @property {string|null} [documento]
 * @property {string|null} [certValidFrom]
 * @property {string|null} [certValidTo]
 * @property {{nfse:boolean,nfe:boolean,nfce:boolean}|null} [documentosAtivos]
 *
 * @typedef ParcelamentoItem
 * @property {string} [numero]
 * @property {string} [dataPedido]
 * @property {string} [situacao]
 * @property {string} [dataSituacao]
 * @property {string} [modalidade]
 * @property {number} [valorConsolidado]
 * @property {number} [quantidadeParcelas]
 *
 * @typedef ParcelamentoParcela
 * @property {string} periodoApuracao
 * @property {string} label
 * @property {boolean} [pago]
 * @property {boolean} [emAberto]
 * @property {boolean} [liberadaParaImpressao]
 * @property {ParcelaSituacao} [situacaoParcela]
 * @property {number} [valor]
 * @property {string} [dataArrecadacao]
 *
 * @typedef NotaFiscal
 * @property {string} id
 * @property {string} [documento]
 * @property {string} [numero]
 * @property {string} [cliente]
 * @property {string} [destinatarioNome]
 * @property {string} [dataEmissao]
 * @property {string} [createdAt]
 * @property {string} [tipo]
 * @property {string} [documentType]
 * @property {number} [valor]
 * @property {string} [situacao]
 * @property {string} [status]
 * @property {boolean} [arquivada]
 *
 * @typedef LimiteFaturamento
 * @property {number} [total]
 * @property {number} [limite]
 * @property {number} [documentos]
 * @property {string} [ano]
 * @property {string} [cnpj]
 */

/** Status do certificado digital. */
export async function fetchCertificateStatus() {
  return apiClient.get('/mei-guide/certificate/status');
}

/** Upload do certificado (.pfx). Envia multipart. */
export async function uploadCertificate(file, password) {
  const formData = new FormData();
  formData.append('certificate', file);
  formData.append('password', password);
  const token = typeof window !== 'undefined' ? getLocalAccessToken() : null;
  const apiUrl = (typeof window !== 'undefined' && window.__FOCO_SIMPLES_ENV__?.NEXT_PUBLIC_API_URL)
    || process.env.NEXT_PUBLIC_API_URL
    || process.env.NEXT_PUBLIC_API_URL_DEV
    || 'http://localhost:3333';
  const response = await fetch(`${apiUrl}/api/mei-guide/certificate`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || response.statusText || 'Falha no upload do certificado.');
    }
    return payload.data;
  }
  if (!response.ok) {
    throw new Error(response.statusText || 'Falha no upload do certificado.');
  }
  return response.text();
}

/** Remove o certificado digital do usuário. */
export async function removeCertificate() {
  return apiClient.delete('/mei-guide/certificate');
}

/** Consulta dados da empresa fiscal (CNPJ) no serviço de emissão. */
export async function fetchFiscalCompany(cnpj) {
  const params = new URLSearchParams();
  if (cnpj) params.set('cpfCnpj', cnpj);
  return apiClient.get(`/mei-notas/setup/plugnotas/empresa?${params.toString()}`);
}

/** Cadastra empresa fiscal no emissor (primeira configuração). */
export async function cadastrarFiscalCompany(payload) {
  return apiClient.post('/mei-notas/setup/plugnotas/empresa', { payload });
}

/** Atualiza dados da empresa fiscal. */
export async function updateFiscalCompany(payload) {
  return apiClient.patch('/mei-notas/setup/plugnotas/empresa', { payload });
}

/** Cadastra empresa fiscal + certificado (composite). */
export async function setupEmitenteComposite({ file, password, payload }) {
  const formData = new FormData();
  if (file) formData.append('arquivo', file);
  if (password) formData.append('senha', password);
  if (payload) formData.append('payload', JSON.stringify(payload));
  const token = typeof window !== 'undefined' ? getLocalAccessToken() : null;
  const apiUrl = (typeof window !== 'undefined' && window.__FOCO_SIMPLES_ENV__?.NEXT_PUBLIC_API_URL)
    || process.env.NEXT_PUBLIC_API_URL
    || process.env.NEXT_PUBLIC_API_URL_DEV
    || 'http://localhost:3333';
  const response = await fetch(`${apiUrl}/api/mei-notas/setup/plugnotas/emitente`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || response.statusText || 'Falha ao configurar emitente.');
    }
    return data.data;
  }
  if (!response.ok) {
    throw new Error(response.statusText || 'Falha ao configurar emitente.');
  }
  return response.text();
}

/** Lista competências DAS. */
export async function fetchDasPeriods(cnpj, ano, refresh = false) {
  const params = new URLSearchParams();
  if (cnpj) params.set('cnpj', cnpj);
  if (ano) params.set('ano', String(ano));
  if (refresh) params.set('refresh', 'true');
  return apiClient.get(`/simples-das/periods?${params.toString()}`);
}

/** Status da integração DAS. */
export async function fetchDasIntegrationStatus() {
  return apiClient.get('/simples-das/status');
}

/** Gera guia DAS para uma competência. */
export async function gerarDas(payload) {
  return apiClient.post('/simples-das/gerar', payload);
}

/** Faturamento interno (notas concluídas) para declaração PGDAS-D. */
export async function fetchSimplesDasFaturamento(periodoApuracao) {
  const params = new URLSearchParams({ periodo: periodoApuracao });
  return apiClient.get(`/simples-das/faturamento?${params.toString()}`);
}

/** Declaração PGDAS-D. */
export async function declararDas(payload) {
  return apiClient.post('/simples-das/declarar', payload);
}

/** Download do PDF da guia DAS. */
export async function downloadDasPdf(id) {
  return apiClient.download(`/simples-das/${encodeURIComponent(id)}/download`, { timeoutMs: 60000 });
}

/** Lista parcelamentos. */
export async function fetchParcelamentos(cnpj) {
  const params = new URLSearchParams();
  if (cnpj) params.set('cnpj', cnpj);
  return apiClient.get(`/mei-guide/parcelamentos?${params.toString()}`);
}

/** Lista parcelas de um parcelamento. */
export async function fetchParcelamentoParcelas(numero, cnpj) {
  const params = new URLSearchParams();
  if (cnpj) params.set('cnpj', cnpj);
  return apiClient.get(
    `/mei-guide/parcelamentos/${encodeURIComponent(numero)}/parcelas?${params.toString()}`,
  );
}

/** Download PDF de uma parcela. */
export async function downloadParcelamentoPdf(numero, cnpj, parcela) {
  const params = new URLSearchParams();
  if (cnpj) params.set('cnpj', cnpj);
  if (parcela) params.set('parcela', parcela);
  const qs = params.toString();
  return apiClient.download(
    `/mei-guide/parcelamentos/${encodeURIComponent(numero)}/pdf${qs ? `?${qs}` : ''}`,
    { timeoutMs: 60000 },
  );
}

/** Reconsulta notas pendentes no emissor (processando / cancelamento pendente). */
export async function syncNotasEmProcessamento(lista) {
  const list = Array.isArray(lista) ? lista : [];
  const candidates = list.filter(
    (n) => notaFiscalStatusPrecisaSyncAutomatico(n.status) && notaFiscalPodeSincronizarEstadoEmissor(n),
  );
  if (candidates.length === 0) {
    return list.map(normalizeNotaForUi);
  }

  const results = await Promise.allSettled(
    candidates.map((n) => fetchNota(n.id, { sync: true })),
  );
  const byId = new Map();
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      byId.set(candidates[index].id, normalizeNotaForUi(result.value));
    }
  });
  return list.map((n) => byId.get(n.id) ?? normalizeNotaForUi(n));
}

/** Lista notas fiscais. */
export async function fetchNotas(options = {}) {
  const params = new URLSearchParams();
  if (options.includeArchived) params.set('includeArchived', 'true');
  if (options.documentType) params.set('documentType', options.documentType);
  if (options.limit) params.set('limit', String(options.limit));
  return apiClient.get(`/mei-notas?${params.toString()}`);
}

/** Detalhes de uma nota. Com `sync: true`, reconsulta o emissor (Plugnotas). */
export async function fetchNota(id, { sync = false } = {}) {
  const suffix = sync ? '?sync=true' : '';
  return apiClient.get(
    `/mei-notas/${encodeURIComponent(id)}${suffix}`,
    { timeoutMs: sync ? 60000 : undefined },
  );
}

/** Download do PDF de uma nota. */
export async function downloadNotaPdf(id) {
  return apiClient.download(`/mei-notas/${encodeURIComponent(id)}/pdf`, { timeoutMs: 60000 });
}

/** Download do XML de uma nota. */
export async function downloadNotaXml(id) {
  return apiClient.download(`/mei-notas/${encodeURIComponent(id)}/xml`, { timeoutMs: 60000 });
}

/** Arquiva uma nota. */
export async function arquivarNota(id) {
  return apiClient.post(`/mei-notas/${encodeURIComponent(id)}/arquivar`);
}

/** Cancela uma nota. */
export async function cancelarNota(id) {
  return apiClient.post(`/mei-notas/${encodeURIComponent(id)}/cancelar`, {}, { timeoutMs: 60000 });
}

/** Atualiza dados internos de uma nota (descrição interna, tags). */
export async function atualizarNota(id, payload) {
  return apiClient.patch(`/mei-notas/${encodeURIComponent(id)}`, payload);
}

/** Limite de faturamento agregado por ano. */
export async function fetchLimiteFaturamento(year) {
  const params = new URLSearchParams();
  if (year) params.set('year', String(year));
  return apiClient.get(`/mei-notas/limite-faturamento?${params.toString()}`);
}

/** Emite uma nota fiscal (NFS-e, NF-e ou NFC-e) — endpoint unificado. */
export async function emitirNota(payload) {
  return apiClient.post('/mei-notas/emitir', payload, { timeoutMs: EMIT_FETCH_TIMEOUT_MS });
}

/** Lista catálogo de clientes. */
export async function fetchCatalogoClientes(options = {}) {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.documentType) params.set('documentType', options.documentType);
  if (options.includeInactive) params.set('includeInactive', 'true');
  return apiClient.get(`/mei-notas/catalogo/clientes?${params.toString()}`);
}

/** Cria um cliente no catálogo. */
export async function criarCatalogoCliente(payload) {
  return apiClient.post('/mei-notas/catalogo/clientes', payload);
}

/** Atualiza um cliente do catálogo. */
export async function atualizarCatalogoCliente(id, payload) {
  return apiClient.patch(`/mei-notas/catalogo/clientes/${encodeURIComponent(id)}`, payload);
}

/** Exclui um cliente do catálogo. */
export async function excluirCatalogoCliente(id) {
  return apiClient.delete(`/mei-notas/catalogo/clientes/${encodeURIComponent(id)}`);
}

/** Soft-hide (arquiva) um cliente por documento. */
export async function softHideCatalogoCliente(documento) {
  return apiClient.post('/mei-notas/catalogo/clientes/soft-hide', { documento });
}

/** Sincroniza tipos de documento para um cliente. */
export async function syncCatalogoClienteDocumentTypes(payload) {
  return apiClient.post('/mei-notas/catalogo/clientes/sync', payload);
}

/** Lista catálogo de produtos/serviços. */
export async function fetchCatalogoProdutos(options = {}) {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.documentType) params.set('documentType', options.documentType);
  return apiClient.get(`/mei-notas/catalogo/produtos?${params.toString()}`);
}

/** Lista códigos de serviço de referência (LC 116). */
export async function fetchCatalogoCodigosServicos(options = {}) {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.limit) params.set('limit', String(options.limit));
  return apiClient.get(`/mei-notas/catalogo/codigos-servicos?${params.toString()}`);
}

/** Sugere códigos de serviço pelo texto. */
export async function sugerirCatalogoCodigosServicos(options = {}) {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.limit) params.set('limit', String(options.limit));
  return apiClient.get(`/mei-notas/catalogo/codigos-servicos/sugerir?${params.toString()}`);
}

/** Lista NCMs de referência. */
export async function fetchCatalogoNcms(options = {}) {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.limit) params.set('limit', String(options.limit));
  return apiClient.get(`/mei-notas/catalogo/ncms?${params.toString()}`);
}

/** Sugere NCMs pelo texto. */
export async function sugerirCatalogoNcms(options = {}) {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.limit) params.set('limit', String(options.limit));
  return apiClient.get(`/mei-notas/catalogo/ncms/sugerir?${params.toString()}`);
}

/** Cria um produto/serviço no catálogo. */
export async function criarCatalogoProduto(payload) {
  return apiClient.post('/mei-notas/catalogo/produtos', payload);
}

/** Atualiza um produto/serviço do catálogo. */
export async function atualizarCatalogoProduto(id, payload) {
  return apiClient.patch(`/mei-notas/catalogo/produtos/${encodeURIComponent(id)}`, payload);
}

/** Exclui um produto/serviço do catálogo. */
export async function excluirCatalogoProduto(id) {
  return apiClient.delete(`/mei-notas/catalogo/produtos/${encodeURIComponent(id)}`);
}

/** Importa produtos a partir dos CNAEs da empresa. */
export async function importCnaesProdutos() {
  return apiClient.post('/mei-notas/catalogo/produtos/from-cnaes');
}

/** Calcula tributação de itens NF-e/NFC-e. */
export async function calcularTributacaoItensNfe(payload) {
  return apiClient.post('/mei-notas/tax/calculate-items', payload);
}

/** Lookup de CNPJ para preenchimento automático de dados. */
export async function lookupCnpj(cnpj) {
  return apiClient.get(`/mei-notas/cnpj-lookup/${encodeURIComponent(String(cnpj || '').replace(/\D/g, ''))}`);
}

/** Lookup de CEP para preenchimento de endereço fiscal. */
export async function lookupCep(cep) {
  const clean = String(cep || '').replace(/\D/g, '').slice(0, 8);
  return apiClient.get(`/mei-notas/cep-lookup/${clean}`);
}

/** Consulta prefill do prestador NFS-e (dados extraídos do certificado PFX). */
export async function fetchNfsePrestadorPrefill() {
  const data = await apiClient.get('/mei-guide/prestador-prefill');
  return data?.prefill ?? {
    prestadorCpfCnpj: null,
    prestadorRazaoSocial: null,
    prestadorEmail: null,
    prestadorInscricaoMunicipal: null,
    prestadorEndereco: null,
  };
}
