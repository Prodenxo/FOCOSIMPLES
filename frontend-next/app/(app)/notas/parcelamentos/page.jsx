'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileDown,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import {
  fetchCertificateStatus,
  fetchFiscalCompany,
  fetchParcelamentoParcelas,
  fetchParcelamentos,
  downloadParcelamentoPdf,
} from '@/lib/fiscalApi';
import {
  describeDasStatus,
  downloadBlob,
  formatCompetenciaShort,
  formatCurrencyBRL,
  formatDateBR,
} from '@/lib/fiscalFormat';
import { Card } from '@/components/ui/Card';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { LoadingPanel } from '@/components/ui/LoadingPanel';

/**
 * Aba Parcelamentos — parcelamentos do Simples Nacional.
 * Documentação:
 * - Lista parcelamentos retornados pela integração.
 * - Ao abrir um item, mostra suas parcelas e PDFs disponíveis.
 * - Não confunde "vazio" com "sem dívidas" — exibe estado vazio explícito.
 * - Diferencia resultado vazio de erro de consulta.
 */
export default function ParcelamentosPage() {
  const { userId } = useAuth();

  const [company, setCompany] = useState(null);
  const [certStatus, setCertStatus] = useState(null);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalidadeErro, setModalidadeErro] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [parcelasById, setParcelasById] = useState({});
  const [parcelaLoading, setParcelaLoading] = useState(null);
  const [parcelaError, setParcelaError] = useState(null);

  const cnpj = company?.cpfCnpj || company?.cnpj || certStatus?.documento || null;

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

  const loadItems = useCallback(async () => {
    if (!cnpj) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchParcelamentos(cnpj);
      const list = result?.parcelamentos || [];
      setItems(Array.isArray(list) ? list : []);
      const erroMsg = result?.termoAutorizacaoErro || null;
      setModalidadeErro(erroMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar parcelamentos.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [cnpj]);

  useEffect(() => {
    if (!userId) return;
    loadShared();
  }, [userId, loadShared]);

  useEffect(() => {
    if (!userId) return;
    loadItems();
  }, [userId, loadItems]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onRefresh = () => {
      loadShared();
      loadItems();
    };
    window.addEventListener('focosimples:fiscal-refresh', onRefresh);
    return () => window.removeEventListener('focosimples:fiscal-refresh', onRefresh);
  }, [loadShared, loadItems]);

  const handleExpand = async (item) => {
    const id = item.numero;
    if (!id) return;
    const willExpand = expandedId !== id;
    setExpandedId(willExpand ? id : null);
    if (!willExpand) return;
    if (parcelasById[id]) return;
    setParcelaLoading(id);
    setParcelaError(null);
    try {
      const result = await fetchParcelamentoParcelas(id, cnpj);
      setParcelasById((prev) => ({ ...prev, [id]: result?.parcelas || [] }));
    } catch (err) {
      setParcelaError(err instanceof Error ? err.message : 'Falha ao consultar parcelas.');
    } finally {
      setParcelaLoading(null);
    }
  };

  const handleDownloadPdf = async (item, parcela) => {
    const id = item.numero;
    if (!id) return;
    setParcelaLoading(`dl-${id}-${parcela?.periodoApuracao || 'all'}`);
    try {
      const blob = await downloadParcelamentoPdf(id, cnpj, item.modalidade, parcela?.periodoApuracao);
      downloadBlob(blob, `parcelamento-${id}${parcela?.periodoApuracao ? `-${parcela.periodoApuracao}` : ''}.pdf`);
    } catch (err) {
      setParcelaError(err instanceof Error ? err.message : 'Falha no download do PDF.');
    } finally {
      setParcelaLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
              Parcelamentos
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Acompanhe os parcelamentos ativos do Simples Nacional retornados pela integração.
            </p>
            {modalidadeErro ? (
              <p className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Algumas modalidades não puderam ser consultadas ({modalidadeErro}).
              </p>
            ) : null}
            {!cnpj ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Configure o CNPJ da empresa para liberar a consulta.
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadItems()}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Atualizar parcelamentos"
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
              Atualizar
            </button>
            <a
              href="https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgparc.app/Identificacao"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]/80"
            >
              Portal Parcelamento
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6"><LoadingPanel label="Carregando parcelamentos…" /></Card>
      ) : error ? (
        <Card className="p-6"><ErrorPanel message={error} onRetry={loadItems} /></Card>
      ) : items.length === 0 ? (
        <Card className="p-6">
          <EmptyPanel
            title="Nenhum parcelamento ativo encontrado"
            description="Esta lista reflete apenas o que foi retornado pela integração. A ausência aqui não descarta outras dívidas fora do Simples Nacional."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.numero}>
              <ParcelamentoRow
                item={item}
                expanded={expandedId === item.numero}
                parcelas={parcelasById[item.numero]}
                loadingParcelas={parcelaLoading === item.numero}
                loadingDownload={typeof parcelaLoading === 'string' && parcelaLoading.startsWith(`dl-${item.numero}`)}
                onToggle={() => handleExpand(item)}
                onDownloadPdf={(parcela) => handleDownloadPdf(item, parcela)}
                onDownloadAll={() => handleDownloadPdf(item, null)}
              />
            </li>
          ))}
        </ul>
      )}

      {parcelaError ? (
        <p className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {parcelaError}
        </p>
      ) : null}
    </div>
  );
}

function ParcelamentoRow({ item, expanded, parcelas, loadingParcelas, loadingDownload, onToggle, onDownloadPdf, onDownloadAll }) {
  const statusLabel = item.situacao || '—';
  return (
    <Card className="p-0">
      <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
              Parcelamento {item.numero || '—'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {item.modalidade || 'Simples Nacional'} · Situação: {statusLabel}
              {item.dataPedido ? ` · Pedido em ${formatDateBR(item.dataPedido)}` : ''}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {typeof item.valorConsolidado === 'number' ? (
            <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
              {formatCurrencyBRL(item.valorConsolidado)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onDownloadAll}
            disabled={loadingDownload}
            className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]/80 disabled:opacity-60"
          >
            {loadingDownload ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileDown className="h-3.5 w-3.5" aria-hidden />}
            PDF
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-[var(--card-border)] bg-[var(--canvas)]/40 px-5 py-4">
          {loadingParcelas ? (
            <LoadingPanel label="Carregando parcelas…" />
          ) : !parcelas || parcelas.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              Nenhuma parcela retornada para este parcelamento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="px-2 py-2 font-medium">Parcela</th>
                    <th className="px-2 py-2 font-medium">Situação</th>
                    <th className="px-2 py-2 font-medium">Vencimento</th>
                    <th className="px-2 py-2 font-medium">Valor</th>
                    <th className="px-2 py-2 font-medium text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {parcelas.map((p) => (
                    <tr key={p.periodoApuracao}>
                      <td className="px-2 py-2 text-[var(--text-primary)]">{p.label || formatCompetenciaShort(p.periodoApuracao)}</td>
                      <td className="px-2 py-2 text-[var(--text-muted)]">{describeDasStatus(mapParcelaSituacao(p))}</td>
                      <td className="px-2 py-2 text-[var(--text-muted)]">{p.dataArrecadacao ? formatDateBR(p.dataArrecadacao) : '—'}</td>
                      <td className="px-2 py-2 text-[var(--text-primary)] tabular-nums">{typeof p.valor === 'number' ? formatCurrencyBRL(p.valor) : '—'}</td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onDownloadPdf(p)}
                          disabled={!p.liberadaParaImpressao && !p.pago}
                          className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)] disabled:opacity-60"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden />
                          Baixar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function mapParcelaSituacao(p) {
  if (p.pago) return 'pago';
  if (p.emAberto) return 'a_pagar';
  if (p.liberadaParaImpressao) return 'a_declarar';
  if (p.situacaoParcela) return p.situacaoParcela;
  return 'indisponivel';
}
