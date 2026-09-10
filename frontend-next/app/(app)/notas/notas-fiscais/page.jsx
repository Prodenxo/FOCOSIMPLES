'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import {
  arquivarNota,
  atualizarNota,
  cancelarNota,
  downloadNotaPdf,
  downloadNotaXml,
  fetchCatalogoClientes,
  fetchCatalogoProdutos,
  fetchCertificateStatus,
  fetchFiscalCompany,
  fetchNota,
  fetchNotas,
  syncNotasEmProcessamento,
} from '@/lib/fiscalApi';
import {
  allowedEmitDocumentTypes,
  resolveDocumentosPermitidos,
} from '@/lib/documentosAtivos';
import {
  describeDocumentType,
  downloadBlob,
  formatCurrencyBRL,
  formatDateBR,
} from '@/lib/fiscalFormat';
import {
  formatNfseStatus,
  getNfseStatusKey,
  normalizeNotaForUi,
  notaFiscalPodeSincronizarEstadoEmissor,
  notaFiscalStatusPrecisaSyncAutomatico,
} from '@/lib/notaFiscalDisplay';
import { Card } from '@/components/ui/Card';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { LoadingPanel } from '@/components/ui/LoadingPanel';
import { Pagination } from '@/components/ui/Pagination';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { NotasEmptyIllustration } from '@/components/illustrations/NotasEmptyIllustration';
import { EmitirNotaModal } from '@/components/notas/EmitirNotaModal';
import { ClienteModal } from '@/components/notas/ClienteModal';
import { ProdutoModal } from '@/components/notas/ProdutoModal';
import { NotaFiscalFailureBanner } from '@/components/notas/NotaFiscalFailureBanner';

/**
 * Aba Notas fiscais — gestão de NF-e, NFC-e e NFS-e.
 * Documentação:
 * - Filtros: tipo (documentType), arquivadas (includeArchived), busca por texto.
 * - Listagem compacta com documento, cliente, data, tipo, valor e situação.
 * - Detalhes via modal com ações suportadas: download PDF/XML, arquivar, cancelar.
 * - "Emitir nota" abre o modal completo de emissão (tipo, cliente, itens, revisão e envio).
 * - Clientes/Catálogo: listas simples para consulta rápida com busca.
 * - Arquivar ≠ cancelar fiscalmente (mensagem explícita).
 */
export default function NotasFiscaisPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [company, setCompany] = useState(null);
  const [certStatus, setCertStatus] = useState(null);

  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [documentType, setDocumentType] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [clientes, setClientes] = useState([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clientesError, setClientesError] = useState(null);
  const [clienteSearch, setClienteSearch] = useState('');

  const [produtos, setProdutos] = useState([]);
  const [produtosLoading, setProdutosLoading] = useState(false);
  const [produtosError, setProdutosError] = useState(null);
  const [produtoSearch, setProdutoSearch] = useState('');

  const [showClienteModal, setShowClienteModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [showProdutoModal, setShowProdutoModal] = useState(false);
  const [editingProduto, setEditingProduto] = useState(null);

  const [actionMsg, setActionMsg] = useState(null);
  const [acting, setActing] = useState(null);
  const notasRef = useRef([]);
  const notasSyncInFlightRef = useRef(false);

  const cnpj = company?.cpfCnpj || company?.cnpj || certStatus?.documento || null;

  const documentosPermitidos = useMemo(
    () => resolveDocumentosPermitidos(certStatus, company),
    [certStatus, company],
  );

  const documentTypeOptions = useMemo(() => {
    const labels = { nfse: 'NFS-e', nfe: 'NF-e', nfce: 'NFC-e' };
    const allowed = allowedEmitDocumentTypes(documentosPermitidos);
    const base = [{ value: 'all', label: 'Todos os tipos' }];
    allowed.forEach((type) => {
      const key = type.toLowerCase();
      base.push({ value: key, label: labels[key] || type });
    });
    if (base.length === 1) {
      return [
        { value: 'all', label: 'Todos os tipos' },
        { value: 'nfse', label: 'NFS-e' },
        { value: 'nfe', label: 'NF-e' },
        { value: 'nfce', label: 'NFC-e' },
      ];
    }
    return base;
  }, [documentosPermitidos]);

  const showClientes = searchParams.get('clientes') === '1';
  const showCatalogo = searchParams.get('catalogo') === '1';
  const showEmitir = searchParams.get('emitir') === '1';

  const loadShared = useCallback(async () => {
    try {
      const cert = await fetchCertificateStatus().catch(() => null);
      setCertStatus(cert);
      const doc = cert?.documento;
      if (doc) {
        const comp = await fetchFiscalCompany(doc).catch(() => null);
        setCompany(comp);
      } else {
        setCompany(null);
      }
    } catch (err) {
      console.warn('Falha ao carregar contexto fiscal:', err);
    }
  }, []);

  const loadNotas = useCallback(async ({ syncPending = true, silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchNotas({
        documentType: documentType === 'all' ? undefined : documentType,
        includeArchived,
      });
      const list = Array.isArray(data) ? data : (data?.notas || data?.items || []);
      const next = syncPending ? await syncNotasEmProcessamento(list) : list.map(normalizeNotaForUi);
      setNotas(next);
      notasRef.current = next;
      return next;
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar notas.');
        setNotas([]);
        notasRef.current = [];
      }
      return notasRef.current;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [documentType, includeArchived]);

  const refreshPendingNotasStatus = useCallback(async () => {
    if (notasSyncInFlightRef.current) return;
    const current = notasRef.current;
    const hasPending = current.some(
      (n) => notaFiscalStatusPrecisaSyncAutomatico(n.status) && notaFiscalPodeSincronizarEstadoEmissor(n),
    );
    if (!hasPending) return;

    notasSyncInFlightRef.current = true;
    try {
      const updated = await syncNotasEmProcessamento(current);
      setNotas(updated);
      notasRef.current = updated;
    } finally {
      notasSyncInFlightRef.current = false;
    }
  }, []);

  const loadClientes = useCallback(async () => {
    setClientesLoading(true);
    setClientesError(null);
    try {
      const data = await fetchCatalogoClientes({ q: clienteSearch, limit: 50 });
      setClientes(Array.isArray(data) ? data : (data?.clientes || data?.items || []));
    } catch (err) {
      setClientesError(err instanceof Error ? err.message : 'Falha ao carregar clientes.');
      setClientes([]);
    } finally {
      setClientesLoading(false);
    }
  }, [clienteSearch]);

  const loadProdutos = useCallback(async () => {
    setProdutosLoading(true);
    setProdutosError(null);
    try {
      const data = await fetchCatalogoProdutos({ q: produtoSearch, limit: 50 });
      setProdutos(Array.isArray(data) ? data : (data?.produtos || data?.items || []));
    } catch (err) {
      setProdutosError(err instanceof Error ? err.message : 'Falha ao carregar catálogo.');
      setProdutos([]);
    } finally {
      setProdutosLoading(false);
    }
  }, [produtoSearch]);

  useEffect(() => {
    if (!userId) return;
    loadShared();
  }, [userId, loadShared]);

  useEffect(() => {
    if (!userId) return;
    loadNotas({ syncPending: true });
  }, [userId, loadNotas]);

  useEffect(() => {
    notasRef.current = notas;
  }, [notas]);

  useEffect(() => {
    const hasPending = notas.some(
      (n) => notaFiscalStatusPrecisaSyncAutomatico(n.status) && notaFiscalPodeSincronizarEstadoEmissor(n),
    );
    if (!hasPending) return undefined;

    const quick = setTimeout(() => {
      void refreshPendingNotasStatus();
    }, 4000);
    const timer = setInterval(() => {
      void refreshPendingNotasStatus();
    }, 20000);

    return () => {
      clearTimeout(quick);
      clearInterval(timer);
    };
  }, [notas, refreshPendingNotasStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onRefresh = () => {
      loadShared();
      loadNotas();
    };
    window.addEventListener('focosimples:fiscal-refresh', onRefresh);
    return () => window.removeEventListener('focosimples:fiscal-refresh', onRefresh);
  }, [loadShared, loadNotas]);

  useEffect(() => {
    if (!showClientes) return;
    loadClientes();
  }, [showClientes, loadClientes]);

  useEffect(() => {
    if (!showCatalogo) return;
    loadProdutos();
  }, [showCatalogo, loadProdutos]);

  const filteredNotas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notas.filter((nota) => {
      if (term) {
        const haystack = [
          nota.documento, nota.numero, nota.cliente, nota.destinatarioNome,
          nota.situacao, nota.status, nota.tipo,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (documentType !== 'all') {
        const tipo = String(nota.tipo || nota.documentType || '').toLowerCase();
        if (tipo !== documentType.toLowerCase()) return false;
      }
      if (!includeArchived && (nota.arquivada || nota.archived)) return false;
      return true;
    });
  }, [notas, search, documentType, includeArchived]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredNotas.length / pageSize));
  const pagedNotas = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredNotas.slice(start, start + pageSize);
  }, [filteredNotas, page]);

  useEffect(() => {
    setPage(1);
  }, [search, documentType, includeArchived]);

  const openDetails = async (nota) => {
    setSelected(nota);
    setDetailLoading(true);
    try {
      const data = await fetchNota(nota.id);
      setSelected(normalizeNotaForUi(data || nota));
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao carregar detalhes.',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadPdf = async (nota) => {
    if (!nota?.id) return;
    setActing(`pdf-${nota.id}`);
    setActionMsg(null);
    try {
      const blob = await downloadNotaPdf(nota.id);
      downloadBlob(blob, `nota-${nota.documento || nota.numero || nota.id}.pdf`);
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha no download do PDF.',
      });
    } finally {
      setActing(null);
    }
  };

  const handleDownloadXml = async (nota) => {
    if (!nota?.id) return;
    setActing(`xml-${nota.id}`);
    setActionMsg(null);
    try {
      const blob = await downloadNotaXml(nota.id);
      downloadBlob(blob, `nota-${nota.documento || nota.numero || nota.id}.xml`);
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha no download do XML.',
      });
    } finally {
      setActing(null);
    }
  };

  const handleArquivar = async (nota) => {
    if (!nota?.id) return;
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'Arquivar esta nota? Ela ficará fora da lista principal, mas o registro fiscal é preservado. ' +
        'Arquivar NÃO substitui o cancelamento fiscal.',
      );
      if (!ok) return;
    }
    setActing(`arch-${nota.id}`);
    setActionMsg(null);
    try {
      await arquivarNota(nota.id);
      setActionMsg({ type: 'success', text: 'Nota arquivada.' });
      setSelected(null);
      await loadNotas();
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao arquivar nota.',
      });
    } finally {
      setActing(null);
    }
  };

  const handleSyncNota = async (nota) => {
    if (!nota?.id) return;
    setActing(`sync-${nota.id}`);
    setActionMsg(null);
    try {
      const updated = await fetchNota(nota.id, { sync: true });
      const normalized = normalizeNotaForUi(updated);
      setNotas((current) => {
        const next = current.map((item) => (item.id === nota.id ? normalized : item));
        notasRef.current = next;
        return next;
      });
      setSelected(normalized);
      setActionMsg({ type: 'success', text: 'Status da nota atualizado.' });
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao sincronizar status da nota.',
      });
    } finally {
      setActing(null);
    }
  };

  const handleSaveDescricao = async (nota, descricaoInterna) => {
    if (!nota?.id) return;
    setActing(`desc-${nota.id}`);
    setActionMsg(null);
    try {
      const updated = await atualizarNota(nota.id, {
        descricaoInterna: descricaoInterna.trim() || undefined,
      });
      const normalized = normalizeNotaForUi(updated);
      setNotas((current) => {
        const next = current.map((item) => (item.id === nota.id ? normalized : item));
        notasRef.current = next;
        return next;
      });
      setSelected(normalized);
      setActionMsg({ type: 'success', text: 'Descrição interna salva.' });
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao salvar descrição.',
      });
    } finally {
      setActing(null);
    }
  };

  const handleCancelar = async (nota) => {
    if (!nota?.id) return;
    const isRetry = getNfseStatusKey(nota.status) === 'cancelamento_pendente';
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        isRetry
          ? 'Reenviar o pedido de cancelamento desta nota no emissor fiscal?'
          : 'Cancelar esta nota fiscalmente? Esta ação é definitiva e será comunicada à Receita/Prefeitura.',
      );
      if (!ok) return;
    }
    setActing(`cancel-${nota.id}`);
    setActionMsg(null);
    try {
      const updated = await cancelarNota(nota.id);
      let nextList = notasRef.current.map((item) => (
        item.id === nota.id ? normalizeNotaForUi(updated) : item
      ));
      setNotas(nextList);
      notasRef.current = nextList;

      const statusKey = getNfseStatusKey(updated?.status);
      if (statusKey === 'cancelamento_pendente' || statusKey === 'cancelado') {
        nextList = await syncNotasEmProcessamento(nextList);
        setNotas(nextList);
        notasRef.current = nextList;
      }

      const finalStatus = getNfseStatusKey(
        nextList.find((item) => item.id === nota.id)?.status ?? updated?.status,
      );
      const cancelMeta = updated?.metadata_json?.cancelamento;

      if (finalStatus === 'cancelado') {
        setActionMsg({ type: 'success', text: 'Nota cancelada no emissor.' });
      } else if (cancelMeta?.providerError) {
        setActionMsg({
          type: 'warning',
          text: `Cancelamento registrado (pendente). Detalhe: ${cancelMeta.providerError}`,
        });
      } else {
        setActionMsg({
          type: 'info',
          text: 'Cancelamento enviado. O status será atualizado quando a SEFAZ confirmar.',
        });
      }
      setSelected(null);
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao cancelar nota.',
      });
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
              Notas fiscais
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Documentos emitidos, recebidos e arquivados via serviço de emissão.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/notas/notas-fiscais?emitir=1"
              className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-card)] hover:opacity-90"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Emitir nota
            </a>
            <button
              type="button"
              onClick={loadNotas}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Atualizar notas"
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
              Atualizar
            </button>
            <a
              href="/notas/notas-fiscais?clientes=1"
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)]"
            >
              <Users className="h-3.5 w-3.5" aria-hidden />
              Clientes
            </a>
            <a
              href="/notas/notas-fiscais?catalogo=1"
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)]"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Catálogo
            </a>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <label className="flex h-10 flex-1 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm">
            <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por documento, cliente ou situação"
              className="w-full bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </label>
          <FilterSelect
            label="Tipo"
            icon={Filter}
            value={documentType}
            onChange={setDocumentType}
            options={documentTypeOptions}
          />
          <label className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--card-border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span className="font-medium text-[var(--text-primary)]">Incluir arquivadas</span>
          </label>
        </div>

        {actionMsg ? (
          <div
            className={`mt-4 flex items-start gap-2 rounded-[12px] border p-3 text-xs ${
              actionMsg.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
                : actionMsg.type === 'warning' || actionMsg.type === 'info'
                  ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200'
            }`}
            role="status"
          >
            {actionMsg.text}
          </div>
        ) : null}
      </Card>

      {/* Painel de Clientes */}
      {showClientes ? (
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Clientes</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Catálogo de clientes para uso nas emissões.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCliente(null);
                  setShowClienteModal(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            </div>
            <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm sm:w-72">
              <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
              <input
                type="search"
                value={clienteSearch}
                onChange={(e) => setClienteSearch(e.target.value)}
                placeholder="Buscar por nome ou documento"
                className="w-full bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-4">
            {clientesLoading ? <LoadingPanel label="Carregando clientes…" />
              : clientesError ? <ErrorPanel message={clientesError} onRetry={loadClientes} />
              : clientes.length === 0 ? <EmptyPanel title="Nenhum cliente cadastrado" description="Cadastre clientes para usar nas emissões." />
              : (
                <ul className="divide-y divide-[var(--card-border)]">
                  {clientes.slice(0, 20).map((c) => (
                    <li key={c.id || c.documento}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCliente(c);
                          setShowClienteModal(true);
                        }}
                        className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-[var(--canvas)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                            {c.nome || c.razaoSocial || c.alias || '—'}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">{c.documento || c.cpfCnpj || '—'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.email ? <span className="text-xs text-[var(--text-muted)]">{c.email}</span> : null}
                          <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </Card>
      ) : null}

      {/* Painel de Catálogo */}
      {showCatalogo ? (
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Catálogo de produtos</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Itens disponíveis para emissão fiscal.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProduto(null);
                  setShowProdutoModal(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            </div>
            <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm sm:w-72">
              <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
              <input
                type="search"
                value={produtoSearch}
                onChange={(e) => setProdutoSearch(e.target.value)}
                placeholder="Buscar por descrição ou código"
                className="w-full bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-4">
            {produtosLoading ? <LoadingPanel label="Carregando catálogo…" />
              : produtosError ? <ErrorPanel message={produtosError} onRetry={loadProdutos} />
              : produtos.length === 0 ? <EmptyPanel title="Nenhum produto cadastrado" description="Importe CNAEs ou adicione produtos manualmente." />
              : (
                <ul className="divide-y divide-[var(--card-border)]">
                  {produtos.slice(0, 20).map((p) => (
                    <li key={p.id || p.codigo}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduto(p);
                          setShowProdutoModal(true);
                        }}
                        className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-[var(--canvas)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                            {p.descricao || p.nome || p.titulo || '—'}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {p.codigo || p.ncm || p.codigoServico || '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">
                            {typeof p.valor_sugerido === 'number' ? formatCurrencyBRL(p.valor_sugerido) :
                             typeof p.valorUnitario === 'number' ? formatCurrencyBRL(p.valorUnitario) : '—'}
                          </span>
                          <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </Card>
      ) : null}

      {/* Modal de emissão de nota */}
      {showEmitir ? (
        <EmitirNotaModal
          company={company}
          certDocumento={certStatus?.documento ?? null}
          documentosPermitidos={documentosPermitidos}
          onClose={() => {
            router.replace('/notas/notas-fiscais');
          }}
          onSuccess={(result) => {
            router.replace('/notas/notas-fiscais');
            setActionMsg({
              type: 'success',
              text: `Nota emitida com sucesso! ${result?.documento ? `Documento: ${result.documento}` : ''}`,
            });
            loadNotas();
          }}
        />
      ) : null}

      {/* Lista */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6"><LoadingPanel label="Carregando notas fiscais…" /></div>
        ) : error ? (
          <div className="p-6"><ErrorPanel message={error} onRetry={loadNotas} /></div>
        ) : filteredNotas.length === 0 ? (
          <div className="p-6">
            <EmptyPanel
              illustration={<NotasEmptyIllustration size={140} />}
              title="Nenhuma nota encontrada"
              description={
                notas.length === 0
                  ? 'Você ainda não emitiu notas fiscais pela sua conta.'
                  : 'Ajuste os filtros ou a busca para encontrar notas.'
              }
              action={
                notas.length === 0 ? (
                  <a
                    href="/notas/notas-fiscais?emitir=1"
                    className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]/80"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Emitir primeira nota
                  </a>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[var(--canvas)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Documento</th>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Data</th>
                    <th className="px-5 py-3 font-medium">Tipo</th>
                    <th className="px-5 py-3 font-medium">Valor</th>
                    <th className="px-5 py-3 font-medium">Situação</th>
                    <th className="px-5 py-3 font-medium text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {pagedNotas.map((nota) => (
                    <tr key={nota.id} className="cursor-pointer hover:bg-[var(--canvas)]/50" onClick={() => openDetails(nota)}>
                      <td className="px-5 py-3 font-medium text-[var(--text-primary)]">
                        {nota.documento || nota.numero || nota.id}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-primary)]">
                        {nota.cliente || nota.destinatarioNome || '—'}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-muted)]">
                        {formatDateBR(nota.dataEmissao || nota.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-muted)]">
                        {describeDocumentType(nota.tipo || nota.documentType)}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-primary)] tabular-nums">
                        {typeof nota.valor === 'number' ? formatCurrencyBRL(nota.valor) : '—'}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-muted)]">
                        {formatNfseStatus(nota.situacao || nota.status)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-[var(--text-muted)]" aria-hidden />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--card-border)] px-5 py-3">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={filteredNotas.length}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </Card>

      {/* Modal de detalhes */}
      {selected ? (
        <NotaDetailModal
          nota={selected}
          loading={detailLoading}
          acting={acting}
          onClose={() => setSelected(null)}
          onDownloadPdf={() => handleDownloadPdf(selected)}
          onDownloadXml={() => handleDownloadXml(selected)}
          onArquivar={() => handleArquivar(selected)}
          onCancelar={() => handleCancelar(selected)}
          onSync={() => handleSyncNota(selected)}
          onSaveDescricao={(desc) => handleSaveDescricao(selected, desc)}
        />
      ) : null}

      {/* Modal de cliente (CRUD) */}
      {showClienteModal ? (
        <ClienteModal
          cliente={editingCliente}
          onClose={() => {
            setShowClienteModal(false);
            setEditingCliente(null);
          }}
          onSuccess={() => {
            setActionMsg({ type: 'success', text: editingCliente ? 'Cliente atualizado.' : 'Cliente criado.' });
            loadClientes();
          }}
        />
      ) : null}

      {/* Modal de produto (CRUD) */}
      {showProdutoModal ? (
        <ProdutoModal
          produto={editingProduto}
          onClose={() => {
            setShowProdutoModal(false);
            setEditingProduto(null);
          }}
          onSuccess={() => {
            setActionMsg({ type: 'success', text: editingProduto ? 'Produto atualizado.' : 'Produto criado.' });
            loadProdutos();
          }}
        />
      ) : null}
    </div>
  );
}

function NotaDetailModal({
  nota,
  loading,
  acting,
  onClose,
  onDownloadPdf,
  onDownloadXml,
  onArquivar,
  onCancelar,
  onSync,
  onSaveDescricao,
}) {
  const [editDescricao, setEditDescricao] = useState('');
  const [descricaoDirty, setDescricaoDirty] = useState(false);

  useEffect(() => {
    setEditDescricao(nota?.descricaoInterna || '');
    setDescricaoDirty(false);
  }, [nota?.id, nota?.descricaoInterna]);

  const isArchived = Boolean(nota.arquivada || nota.archived);
  const statusKey = getNfseStatusKey(nota.situacao || nota.status);
  const cancelDisabled = statusKey === 'cancelado' || statusKey === 'rejeitado' || statusKey === 'interrompido';
  const canSync = notaFiscalPodeSincronizarEstadoEmissor(nota);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes da nota"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Detalhes da nota</p>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              {nota.documento || nota.numero || nota.id}
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {describeDocumentType(nota.tipo || nota.documentType)} ·
              {' '}{formatDateBR(nota.dataEmissao || nota.createdAt)} ·
              {' '}{nota.situacao || nota.status || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--canvas)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {loading ? (
          <div className="p-5"><LoadingPanel label="Carregando detalhes…" /></div>
        ) : (
          <div className="flex flex-col gap-4 px-5 py-5">
            <NotaFiscalFailureBanner nota={nota} />

            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Cliente" value={nota.cliente || nota.destinatarioNome || '—'} />
              <DetailItem label="Documento do destinatário" value={nota.destinatarioDocumento || nota.documentoDestinatario || '—'} />
              <DetailItem label="Valor" value={typeof nota.valor === 'number' ? formatCurrencyBRL(nota.valor) : '—'} />
              <DetailItem label="Tipo" value={describeDocumentType(nota.tipo || nota.documentType)} />
              <DetailItem label="Situação" value={formatNfseStatus(nota.situacao || nota.status)} />
              <DetailItem label="Data de emissão" value={formatDateBR(nota.dataEmissao || nota.createdAt)} />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Descrição interna
              </label>
              <textarea
                value={editDescricao}
                onChange={(e) => {
                  setEditDescricao(e.target.value);
                  setDescricaoDirty(true);
                }}
                rows={2}
                placeholder="Anotações visíveis só para você (não vão na nota fiscal)"
                className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
              {descricaoDirty ? (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onSaveDescricao(editDescricao)}
                    disabled={acting === `desc-${nota.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {acting === `desc-${nota.id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : null}
                    Salvar descrição
                  </button>
                </div>
              ) : null}
            </div>

            {nota.itens && nota.itens.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Itens
                </p>
                <ul className="divide-y divide-[var(--card-border)] rounded-[12px] border border-[var(--card-border)]">
                  {nota.itens.slice(0, 8).map((item, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-[var(--text-primary)]">
                        {item.descricao || item.nome || 'Item'}
                      </span>
                      <span className="text-xs tabular-nums text-[var(--text-muted)]">
                        {typeof item.quantidade === 'number' ? `${item.quantidade}× ` : ''}
                        {typeof item.valorUnitario === 'number' ? formatCurrencyBRL(item.valorUnitario) : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--card-border)] bg-[var(--canvas)]/40 px-5 py-3">
          {canSync ? (
            <button
              type="button"
              onClick={onSync}
              disabled={acting === `sync-${nota.id}`}
              className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)] disabled:opacity-60"
            >
              {acting === `sync-${nota.id}` ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
              )}
              Sincronizar status
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={acting === `pdf-${nota.id}`}
            className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)] disabled:opacity-60"
          >
            {acting === `pdf-${nota.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileDown className="h-3.5 w-3.5" aria-hidden />}
            Baixar PDF
          </button>
          <button
            type="button"
            onClick={onDownloadXml}
            disabled={acting === `xml-${nota.id}`}
            className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)] disabled:opacity-60"
          >
            {acting === `xml-${nota.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
            Baixar XML
          </button>
          <button
            type="button"
            onClick={onArquivar}
            disabled={isArchived || acting === `arch-${nota.id}`}
            className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
          >
            {acting === `arch-${nota.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Archive className="h-3.5 w-3.5" aria-hidden />}
            {isArchived ? 'Já arquivada' : 'Arquivar'}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            disabled={cancelDisabled || acting === `cancel-${nota.id}`}
            className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            {acting === `cancel-${nota.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
            {statusKey === 'cancelamento_pendente' ? 'Reenviar cancelamento' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)]/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

