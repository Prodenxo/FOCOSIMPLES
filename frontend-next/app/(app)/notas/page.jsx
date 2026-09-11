'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  KeyRound,
  List,
  Loader2,
  Receipt,
} from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import {
  fetchCertificateStatus,
  fetchDasPeriods,
  fetchFiscalCompany,
  fetchLimiteFaturamento,
  fetchNotas,
  fetchParcelamentos,
} from '@/lib/fiscalApi';
import {
  describeCertificateState,
  resolveCertificateState,
} from '@/lib/fiscalFormat';
import { computeMeiLimiteProgresso } from '@/lib/meiLimiteFaturamento';
import { getVigenciaLabelParaAno } from '@/lib/meiLimiteFaturamentoConfig';
import { LimiteFaturamentoCard } from '@/components/notas/LimiteFaturamentoCard';
import { Card } from '@/components/ui/Card';

function isParcelamentoEmAberto(situacao) {
  return /em\s*parcelamento/i.test(situacao || '');
}

export default function NotasInicioPage() {
  const { userId } = useAuth();
  const anoCivil = new Date().getFullYear();

  const [certStatus, setCertStatus] = useState(null);
  const [company, setCompany] = useState(null);
  const [notas, setNotas] = useState([]);
  const [dasPeriods, setDasPeriods] = useState([]);
  const [parcelamentos, setParcelamentos] = useState([]);
  const [limiteServidor, setLimiteServidor] = useState(null);

  const [loadingCert, setLoadingCert] = useState(true);
  const [loadingNotas, setLoadingNotas] = useState(true);
  const [loadingDas, setLoadingDas] = useState(true);
  const [loadingParc, setLoadingParc] = useState(true);
  const [loadingLimite, setLoadingLimite] = useState(true);

  const cnpj = company?.cpfCnpj || company?.cnpj || certStatus?.documento || null;
  const hasUserCertificate = Boolean(certStatus?.hasUserCertificate);
  const hasCertificate = Boolean(certStatus?.hasUserCertificate || certStatus?.hasEnvCertificate);

  const loadOverview = useCallback(async () => {
    if (!userId) return;

    setLoadingCert(true);
    setLoadingNotas(true);
    setLoadingDas(true);
    setLoadingParc(true);
    setLoadingLimite(true);

    let cert = null;
    try {
      cert = await fetchCertificateStatus();
      setCertStatus(cert);
    } catch {
      setCertStatus(null);
    } finally {
      setLoadingCert(false);
    }

    const doc = cert?.documento || null;
    if (doc) {
      try {
        const comp = await fetchFiscalCompany(doc);
        setCompany(comp);
      } catch {
        setCompany(null);
      }
    } else {
      setCompany(null);
    }

    const cnpjDigits = doc || null;

    try {
      const list = await fetchNotas();
      setNotas(Array.isArray(list) ? list : []);
    } catch {
      setNotas([]);
    } finally {
      setLoadingNotas(false);
    }

    if (cnpjDigits) {
      try {
        const data = await fetchDasPeriods(cnpjDigits, undefined, false);
        const list = Array.isArray(data) ? data : (data?.periods || data?.items || []);
        setDasPeriods(list.filter((p) => p && p.status !== 'indisponivel'));
      } catch {
        setDasPeriods([]);
      } finally {
        setLoadingDas(false);
      }

      try {
        const parc = await fetchParcelamentos(cnpjDigits);
        setParcelamentos(Array.isArray(parc) ? parc : (parc?.items || parc?.parcelamentos || []));
      } catch {
        setParcelamentos([]);
      } finally {
        setLoadingParc(false);
      }
    } else {
      setDasPeriods([]);
      setParcelamentos([]);
      setLoadingDas(false);
      setLoadingParc(false);
    }

    const hasCertNow = Boolean(cert?.hasUserCertificate || cert?.hasEnvCertificate);
    if (hasCertNow) {
      try {
        const data = await fetchLimiteFaturamento(anoCivil);
        setLimiteServidor(data || null);
      } catch {
        setLimiteServidor(null);
      } finally {
        setLoadingLimite(false);
      }
    } else {
      setLimiteServidor(null);
      setLoadingLimite(false);
    }
  }, [userId, anoCivil]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onRefresh = () => loadOverview();
    window.addEventListener('focosimples:fiscal-refresh', onRefresh);
    return () => window.removeEventListener('focosimples:fiscal-refresh', onRefresh);
  }, [loadOverview]);

  const certState = resolveCertificateState({
    loading: loadingCert,
    error: null,
    hasUserCertificate: Boolean(certStatus?.hasUserCertificate),
    hasEnvCertificate: Boolean(certStatus?.hasEnvCertificate),
    validTo: certStatus?.certValidTo || null,
  });
  const certInfo = describeCertificateState(certState);

  const dasEmAberto = useMemo(
    () => dasPeriods.filter((p) => p.status === 'a_pagar'),
    [dasPeriods],
  );

  const dasMetric = useMemo(() => {
    const aguardando = hasCertificate && cnpj && dasPeriods.length === 0 && loadingDas;
    const tudoEmDia = dasEmAberto.length === 0
      && hasCertificate
      && cnpj
      && !aguardando
      && dasPeriods.length > 0;
    return {
      tudoEmDia,
      texto: aguardando ? '…' : tudoEmDia ? 'Tudo em dia' : String(dasEmAberto.length),
    };
  }, [dasEmAberto.length, hasCertificate, cnpj, loadingDas, dasPeriods.length]);

  const parcMetric = useMemo(() => {
    const ativos = parcelamentos.filter((p) => isParcelamentoEmAberto(p.situacao));
    const aguardando = hasCertificate && cnpj && parcelamentos.length === 0 && loadingParc;
    const tudoEmDia = ativos.length === 0 && hasCertificate && cnpj && !aguardando && !loadingParc;
    return {
      tudoEmDia,
      texto: aguardando ? '…' : tudoEmDia ? 'Tudo em dia' : String(ativos.length || parcelamentos.length),
    };
  }, [parcelamentos, hasCertificate, cnpj, loadingParc]);

  const limiteProgresso = useMemo(() => computeMeiLimiteProgresso([], {
    anoCivil,
    regime: 'simples',
    agregadoServidor: limiteServidor
      ? {
        totalUtilizadoReais: limiteServidor.totalUtilizadoReais ?? 0,
        notasConsideradas: limiteServidor.notasConsideradas ?? 0,
      }
      : { totalUtilizadoReais: 0, notasConsideradas: 0 },
  }), [anoCivil, limiteServidor]);

  const vigenciaLabel = getVigenciaLabelParaAno(anoCivil, 'simples');

  return (
    <div className="flex flex-col gap-5">
      <LimiteFaturamentoCard
        anoCivil={anoCivil}
        progresso={limiteProgresso}
        vigenciaLabel={vigenciaLabel}
        loading={loadingLimite && hasCertificate}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          href="/notas/certificado"
          icon={KeyRound}
          iconTone={hasUserCertificate ? 'success' : 'danger'}
          title="Certificado digital"
          description={
            hasUserCertificate
              ? 'Certificado A1 instalado e válido para emissão.'
              : 'Envie o certificado A1 para emitir notas e baixar guias.'
          }
          metricLabel="Status"
          metricValue={loadingCert ? '…' : hasUserCertificate ? 'Pronto' : 'Pendente'}
          metricTone={hasUserCertificate ? 'success' : 'danger'}
          cta="Gerenciar →"
          loading={loadingCert}
        />

        <OverviewCard
          href="/notas/das"
          icon={FileText}
          iconTone="warning"
          title="DAS · Simples Nacional"
          description="Gere e baixe as guias do Simples Nacional mês a mês."
          metricLabel="Guias em aberto"
          metricValue={dasMetric.texto}
          metricTone={dasMetric.tudoEmDia ? 'success' : 'warning'}
          cta="Abrir guias →"
          loading={loadingDas}
        />

        <OverviewCard
          href="/notas/notas-fiscais"
          icon={Receipt}
          title="Notas fiscais"
          description="NFS-e e NF-e emitidas. Tabela completa com filtros e ações por nota."
          metricLabel="Total emitidas"
          metricValue={loadingNotas ? '…' : String(notas.length)}
          cta="Ver notas →"
          loading={loadingNotas}
        />

        <OverviewCard
          href="/notas/parcelamentos"
          icon={List}
          title="Parcelamentos"
          description="Consulte parcelamentos ativos e baixe os PDFs disponíveis."
          metricLabel="Ativos"
          metricValue={parcMetric.texto}
          metricTone={parcMetric.tudoEmDia ? 'success' : undefined}
          cta="Ver detalhes →"
          loading={loadingParc}
        />
      </div>

      {!hasCertificate && !loadingCert ? (
        <p className="text-xs text-[var(--text-muted)]">
          Certificado {certInfo.label.toLowerCase()} — configure em Certificado para liberar emissão e consultas completas.
        </p>
      ) : null}
    </div>
  );
}

function OverviewCard({
  href,
  icon: Icon,
  iconTone,
  title,
  description,
  metricLabel,
  metricValue,
  metricTone,
  cta,
  loading,
}) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="relative flex h-full flex-col p-5 transition-shadow hover:shadow-md">
        <div
          className={`mb-4 flex h-11 w-11 items-center justify-center rounded-[12px] ${
            iconTone === 'success'
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              : iconTone === 'danger'
                ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : iconTone === 'warning'
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-[var(--accent-soft)] text-[var(--accent)]'
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>

        <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>

        <div className="mt-4 border-t border-[var(--card-border)] pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {metricLabel}
          </p>
          <p
            className={`mt-0.5 text-lg font-bold ${
              metricTone === 'success'
                ? 'text-emerald-600 dark:text-emerald-400'
                : metricTone === 'danger'
                  ? 'text-red-600 dark:text-red-400'
                  : metricTone === 'warning'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-[var(--text-primary)]'
            }`}
          >
            {metricValue}
          </p>
        </div>

        <p className="mt-3 text-sm font-semibold text-[var(--accent)] group-hover:underline">
          {cta}
        </p>

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-[var(--card-bg)]/70 backdrop-blur-[1px]">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" aria-hidden />
          </div>
        ) : null}
      </Card>
    </Link>
  );
}
