'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileDown,
  Loader2,
  RefreshCcw,
  ScrollText,
} from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import {
  fetchCertificateStatus,
  fetchDasPeriods,
  fetchDasIntegrationStatus,
  downloadDasPdf,
  declararDas,
  fetchSimplesDasFaturamento,
  gerarDas,
  fetchFiscalCompany,
} from '@/lib/fiscalApi';
import {
  competenciaToPeriodoApuracao,
  dasStatusTone,
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
import { FilterSelect } from '@/components/ui/FilterSelect';

/**
 * Aba DAS Simples — guia DAS do Simples Nacional por competência.
 * Documentação:
 * - Lista competências retornadas pelo backend (/simples-das/periods).
 * - Diferencia Pago / A pagar / Sem guia / Falha de consulta.
 * - Não interpreta "Sem guia" como "Pago" e não mostra "Tudo em dia" baseado apenas em lista vazia.
 * - Geração e download preservam o backend existente; nenhum cálculo tributário é inventado.
 */
export default function DasPage() {
  const { userId } = useAuth();
  const searchParams = useSearchParams();

  const [company, setCompany] = useState(null);
  const [certStatus, setCertStatus] = useState(null);
  const [integration, setIntegration] = useState(null);

  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const [actingId, setActingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

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
      const integ = await fetchDasIntegrationStatus().catch(() => null);
      setIntegration(integ);
    } catch (err) {
      // Não bloqueante — falhas parciais são exibidas nas seções correspondentes.
      console.warn('Falha ao carregar contexto fiscal:', err);
    }
  }, []);

  const loadPeriods = useCallback(async () => {
    if (!cnpj) {
      setPeriods([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDasPeriods(cnpj, undefined, true);
      const list = Array.isArray(data) ? data : (data?.periods || data?.items || []);
      setPeriods(list.filter((p) => p && p.status !== 'indisponivel'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar DAS.');
      setPeriods([]);
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
    loadPeriods();
  }, [userId, loadPeriods]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onRefresh = () => {
      loadShared();
      loadPeriods();
    };
    window.addEventListener('focosimples:fiscal-refresh', onRefresh);
    return () => window.removeEventListener('focosimples:fiscal-refresh', onRefresh);
  }, [loadShared, loadPeriods]);

  const availableYears = useMemo(() => {
    const set = new Set();
    periods.forEach((p) => {
      const comp = String(p.competencia || '');
      const year = comp.slice(0, 4);
      if (year) set.add(year);
    });
    return Array.from(set).sort().reverse();
  }, [periods]);

  const filteredPeriods = useMemo(() => {
    return periods.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (yearFilter !== 'all' && !String(p.competencia || '').startsWith(yearFilter)) return false;
      return true;
    });
  }, [periods, statusFilter, yearFilter]);

  const counts = useMemo(() => {
    const acc = { pago: 0, a_pagar: 0, sem_debito: 0, a_declarar: 0, erro: 0 };
    for (const p of periods) {
      if (acc[p.status] !== undefined) acc[p.status] += 1;
    }
    return acc;
  }, [periods]);

  const hasCertificate = Boolean(certStatus?.hasUserCertificate || certStatus?.hasEnvCertificate);

  const handleDeclarar = async (period) => {
    if (!cnpj) return;
    const periodoApuracao = period.periodoApuracao || competenciaToPeriodoApuracao(period.competencia);
    if (!periodoApuracao) {
      setActionMessage({ type: 'error', text: 'Competência inválida para declaração.' });
      return;
    }
    if (!hasCertificate) {
      setActionMessage({
        type: 'error',
        text: 'Envie o certificado A1 da empresa na aba Certificado antes de declarar.',
      });
      return;
    }

    const periodoLabel = formatCompetenciaShort(period.competencia);
    setActingId(`${period.id || period.competencia}`);
    setActionMessage(null);

    let valorOk = 0;
    let count = 0;
    try {
      const fat = await fetchSimplesDasFaturamento(periodoApuracao);
      const total = Number(fat?.total);
      count = Number(fat?.count) || 0;
      valorOk = Number.isFinite(total) ? total : 0;
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível consultar o faturamento interno.',
      });
      setActingId(null);
      return;
    }

    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        `Declarar ${periodoLabel}?\n\n`
        + `Será enviado à Receita o faturamento de ${periodoLabel}, somado das notas concluídas neste app.\n\n`
        + `Valor: ${formatCurrencyBRL(valorOk)} (${count} nota${count === 1 ? '' : 's'} concluída${count === 1 ? '' : 's'})\n\n`
        + 'Depois disso a Receita pode gerar a guia DAS.',
      );
      if (!ok) {
        setActingId(null);
        return;
      }
    }

    try {
      await declararDas({
        confirm: true,
        periodoApuracao,
        cnpj,
        valorReceitaInterna: valorOk,
      });
      const result = await gerarDas({ cnpj, periodoApuracao });
      setActionMessage({
        type: 'success',
        text: result?.message || `Declaração de ${periodoLabel} enviada. Guia DAS gerada.`,
      });
      await loadPeriods();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao declarar e gerar guia DAS.',
      });
    } finally {
      setActingId(null);
    }
  };

  const handleGerar = async (period) => {
    if (!cnpj) return;
    const apuracao = period.periodoApuracao || period.competencia;
    setActingId(`${period.id || period.competencia}`);
    setActionMessage(null);
    try {
      const result = await gerarDas({
        cnpj,
        periodoApuracao: apuracao,
      });
      setActionMessage({
        type: 'success',
        text: result?.message || 'Guia DAS gerada com sucesso.',
      });
      await loadPeriods();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao gerar guia DAS.',
      });
    } finally {
      setActingId(null);
    }
  };

  const handleDownload = async (period) => {
    const id = period.guideId || period.id;
    if (!id) return;
    setActingId(`dl-${id}`);
    setActionMessage(null);
    try {
      const blob = await downloadDasPdf(id);
      const filename = `das-${period.competencia}.pdf`;
      downloadBlob(blob, filename);
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha no download do PDF.',
      });
    } finally {
      setActingId(null);
    }
  };

  const integrationOk = integration?.ok !== false && integration?.integrado !== false;

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
              DAS Simples Nacional
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Consulte, gere e baixe as guias DAS por competência. Origem: Receita Federal (PGDAS-D).
            </p>
            {!cnpj ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Configure o CNPJ da empresa para liberar a consulta.
              </p>
            ) : null}
            {integrationOk === false ? (
              <p className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Integração com a Receita Federal pode estar indisponível no momento.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'pago', label: 'Pago' },
                { value: 'a_pagar', label: 'A pagar' },
                { value: 'sem_debito', label: 'Sem débito' },
                { value: 'a_declarar', label: 'A declarar' },
                { value: 'erro', label: 'Falha' },
              ]}
            />
            <FilterSelect
              label="Ano"
              value={yearFilter}
              onChange={setYearFilter}
              options={[
                { value: 'all', label: 'Todos' },
                ...availableYears.map((y) => ({ value: y, label: y })),
              ]}
            />
            <button
              type="button"
              onClick={() => loadPeriods()}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Atualizar DAS"
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
              Atualizar
            </button>
            <a
              href="https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgdasd.app/Identificacao"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]/80"
            >
              PGDAS-D
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>

        {actionMessage ? (
          <div
            className={`mt-4 flex items-start gap-2 rounded-[12px] border p-3 text-xs ${
              actionMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200'
            }`}
            role="status"
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            {actionMessage.text}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryChip label="Pago" value={counts.pago} tone="success" />
          <SummaryChip label="A pagar" value={counts.a_pagar} tone="warning" />
          <SummaryChip label="A declarar" value={counts.a_declarar} tone="info" />
          <SummaryChip label="Sem débito" value={counts.sem_debito} tone="muted" />
          <SummaryChip label="Falhas" value={counts.erro} tone="danger" />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6"><LoadingPanel label="Carregando competências…" /></div>
        ) : error ? (
          <div className="p-6"><ErrorPanel message={error} onRetry={loadPeriods} /></div>
        ) : filteredPeriods.length === 0 ? (
          <div className="p-6">
            <EmptyPanel
              icon={ScrollText}
              title={periods.length === 0 ? 'Nenhuma competência disponível' : 'Sem resultados para o filtro'}
              description={
                periods.length === 0
                  ? 'A Receita ainda não retornou competências para este CNPJ. Verifique mais tarde.'
                  : 'Ajuste os filtros para visualizar outras competências.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[var(--canvas)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Competência</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Vencimento</th>
                  <th className="px-5 py-3 font-medium">Valor</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                {filteredPeriods.map((period) => {
                  const key = period.id || period.competencia;
                  const status = period.status;
                  const tone = dasStatusTone(status);
                  const generating = actingId === key;
                  const downloading = actingId === `dl-${period.guideId}`;
                  return (
                    <tr key={key} className="hover:bg-[var(--canvas)]/50">
                      <td className="px-5 py-3 font-medium text-[var(--text-primary)]">
                        {formatCompetenciaShort(period.competencia)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge tone={tone} label={describeDasStatus(status)} />
                        {status === 'a_pagar' && period.vencida ? (
                          <span className="ml-2 text-xs text-red-600 dark:text-red-400">vencida</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-muted)]">
                        {period.vencimento ? formatDateBR(period.vencimento) : '—'}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-primary)] tabular-nums">
                        {typeof period.valorTotal === 'number' ? formatCurrencyBRL(period.valorTotal) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          {period.guideId ? (
                            <button
                              type="button"
                              onClick={() => handleDownload(period)}
                              disabled={downloading}
                              className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]/80 disabled:opacity-60"
                            >
                              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileDown className="h-3.5 w-3.5" aria-hidden />}
                              Baixar PDF
                            </button>
                          ) : status === 'a_declarar' || period.podeDeclarar ? (
                            <button
                              type="button"
                              onClick={() => handleDeclarar(period)}
                              disabled={generating || !integrationOk || !hasCertificate}
                              className="inline-flex h-9 items-center gap-1 rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                            >
                              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ScrollText className="h-3.5 w-3.5" aria-hidden />}
                              Declarar e gerar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGerar(period)}
                              disabled={generating || !integrationOk}
                              className="inline-flex h-9 items-center gap-1 rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                            >
                              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
                              Gerar guia
                            </button>
                          )}
                          <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-[var(--text-muted)]">
        Os valores e vencimentos refletem o que foi retornado pela Receita. Em caso de divergência,
        consulte diretamente o portal PGDAS-D.
      </p>
    </div>
  );
}

function StatusBadge({ tone, label }) {
  const cls = {
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    danger: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    info: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    muted: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300',
  }[tone] || 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function SummaryChip({ label, value, tone }) {
  const dotCls = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-sky-500',
    muted: 'bg-slate-400',
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-4 py-3">
      <span className={`h-2 w-2 rounded-full ${dotCls}`} aria-hidden />
      <div>
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">{value}</p>
      </div>
    </div>
  );
}

