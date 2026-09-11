'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, RefreshCcw } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { fetchCertificateStatus, fetchFiscalCompany } from '@/lib/fiscalApi';
import {
  describeCertificateState,
  formatCnpj,
  resolveCertificateState,
} from '@/lib/fiscalFormat';
import { AppFooter } from '@/components/layout/AppFooter';

export function FiscalModuleLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { userId } = useAuth();

  const [company, setCompany] = useState(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState(null);

  const [certStatus, setCertStatus] = useState(null);
  const [certLoading, setCertLoading] = useState(true);
  const [certError, setCertError] = useState(null);

  const cnpj = useMemo(() => {
    return (
      company?.cpfCnpj
      || company?.cnpj
      || certStatus?.documento
      || null
    );
  }, [company, certStatus]);

  const companyName = useMemo(() => {
    return (
      company?.razaoSocial
      || company?.nome
      || company?.nomeEmpresarial
      || null
    );
  }, [company]);

  /** Carrega dados compartilhados: certificado + empresa. */
  const loadSharedData = async () => {
    if (!userId) return;
    setCertLoading(true);
    setCertError(null);
    let status = null;
    try {
      status = await fetchCertificateStatus();
      setCertStatus(status || null);
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Falha ao consultar certificado.');
      setCertStatus(null);
    } finally {
      setCertLoading(false);
    }

    const doc = status?.documento || null;
    if (doc) {
      setCompanyLoading(true);
      setCompanyError(null);
      try {
        const data = await fetchFiscalCompany(doc);
        setCompany(data || null);
      } catch (err) {
        setCompanyError(err instanceof Error ? err.message : 'Falha ao consultar empresa.');
        setCompany(null);
      } finally {
        setCompanyLoading(false);
      }
    } else {
      setCompany(null);
    }
  };

  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (!userId || initialLoadRef.current) return;
    initialLoadRef.current = true;
    loadSharedData();
  }, [userId]);

  // Recarrega ao trocar empresa/contexto (invalida dados anteriores).
  const previousUserIdRef = useRef(userId);
  useEffect(() => {
    if (previousUserIdRef.current && previousUserIdRef.current !== userId) {
      setCompany(null);
      setCertStatus(null);
      setCompanyError(null);
      setCertError(null);
      initialLoadRef.current = false;
    }
    previousUserIdRef.current = userId;
  }, [userId]);

  const certState = resolveCertificateState({
    loading: certLoading,
    error: certError,
    hasUserCertificate: Boolean(certStatus?.hasUserCertificate),
    hasEnvCertificate: Boolean(certStatus?.hasEnvCertificate),
    validTo: certStatus?.certValidTo || null,
  });
  const certStateInfo = describeCertificateState(certState);

  const tabs = [
    { id: 'inicio', label: 'Início', href: '/notas' },
    { id: 'certificado', label: 'Certificado', href: '/notas/certificado' },
    { id: 'das', label: 'DAS Simples', href: '/notas/das' },
    { id: 'parcelamentos', label: 'Parcelamentos', href: '/notas/parcelamentos' },
    { id: 'notas-fiscais', label: 'Notas fiscais', href: '/notas/notas-fiscais' },
  ];

  const activeTab = tabs.find((tab) => {
    if (tab.href === '/notas') return pathname === '/notas';
    return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
  }) || tabs[0];

  const handleRefreshAll = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('focosimples:fiscal-refresh'));
    }
    loadSharedData();
  };

  const handleEmitirNota = () => {
    router.push('/notas/notas-fiscais?emitir=1');
  };

  // Faixa compacta com empresa, CNPJ e certificado
  const companyStrip = (
    <section className="rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 shadow-[var(--shadow-card)] sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <BuildingIcon />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Empresa selecionada
            </p>
            {companyLoading && !company ? (
              <p className="mt-1 text-sm text-[var(--text-muted)]">Carregando…</p>
            ) : companyName ? (
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {companyName}
              </p>
            ) : (
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Nenhuma empresa cadastrada
              </p>
            )}
            <p className="text-xs text-[var(--text-muted)]">
              {cnpj ? `CNPJ ${formatCnpj(cnpj)}` : 'Sem CNPJ vinculado'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${certStateToneClass(certStateInfo.tone)}`}>
            <span className={`h-2 w-2 rounded-full ${certStateDotClass(certStateInfo.tone)}`} aria-hidden />
            Certificado {certStateInfo.label.toLowerCase()}
          </span>
        </div>
      </div>
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
            Notas
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Sua rotina fiscal em um só lugar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRefreshAll}
            className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-4 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden />
            Atualizar
          </button>
          <button
            type="button"
            onClick={handleEmitirNota}
            className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-card)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Emitir nota
          </button>
        </div>
      </header>

      {/* Faixa da empresa */}
      {companyStrip}

      {/* Abas internas */}
      <nav
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--card-border)] px-1"
        aria-label="Abas de Notas"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`relative inline-flex h-11 shrink-0 items-center px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                active
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
              {active ? (
                <span
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]"
                  aria-hidden
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Conteúdo da aba */}
      <section className="flex flex-col gap-5">
        {children}
      </section>

      <AppFooter />
    </div>
  );
}

function certStateToneClass(tone) {
  switch (tone) {
    case 'success': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'danger': return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'warning': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300';
  }
}

function certStateDotClass(tone) {
  switch (tone) {
    case 'success': return 'bg-emerald-500';
    case 'danger': return 'bg-red-500';
    case 'warning': return 'bg-amber-500';
    default: return 'bg-slate-400';
  }
}

function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-4h4v4" />
    </svg>
  );
}
