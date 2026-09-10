'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import {
  fetchAccessReport,
  listPendingAccessRequests,
  manageAccessRequest,
} from '@/lib/manageAccessRequests';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { LoadingPanel } from '@/components/ui/LoadingPanel';

function formatCnpj(value) {
  const d = String(value || '').replace(/\D/g, '');
  if (d.length !== 14) return value || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default function SolicitacoesPage() {
  const { role } = useAuth();
  const isSuperadmin = role === 'superadmin';

  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const load = useCallback(async () => {
    if (!isSuperadmin) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'pending') {
        setRequests(await listPendingAccessRequests());
      } else {
        setHistory(await fetchAccessReport(100));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar solicitações.');
    } finally {
      setLoading(false);
    }
  }, [isSuperadmin, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (req) => {
    setActing(req.userId);
    try {
      await manageAccessRequest('approve', req.userId);
      setRequests((prev) => prev.filter((r) => r.userId !== req.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aprovar.');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setActing(rejectTarget.userId);
    try {
      await manageAccessRequest('reject', rejectTarget.userId);
      setRequests((prev) => prev.filter((r) => r.userId !== rejectTarget.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao recusar.');
    } finally {
      setActing(null);
      setRejectTarget(null);
    }
  };

  if (!isSuperadmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/minha-conta" className="inline-flex items-center gap-2 text-sm text-[var(--accent)]">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Card className="mt-4 p-6">
          <EmptyPanel title="Acesso restrito" description="Somente superadministradores podem revisar solicitações." />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 pb-6">
      <Link href="/minha-conta" className="inline-flex items-center gap-2 text-sm text-[var(--accent)]">
        <ArrowLeft className="h-4 w-4" /> Voltar às configurações
      </Link>
      <header>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Solicitações de acesso</h1>
        <p className="text-sm text-[var(--text-muted)]">Aprove ou recuse pedidos de entrada</p>
      </header>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('pending')} className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === 'pending' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--canvas)]'}`}>
          Pendentes
        </button>
        <button type="button" onClick={() => setTab('history')} className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === 'history' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--canvas)]'}`}>
          Histórico
        </button>
      </div>

      <Card className="p-4 sm:p-5">
        {loading ? <LoadingPanel label="Carregando…" /> : error ? (
          <ErrorPanel message={error} onRetry={load} />
        ) : tab === 'pending' ? (
          requests.length === 0 ? (
            <EmptyPanel title="Nenhuma solicitação pendente" />
          ) : (
            <ul className="space-y-4">
              {requests.map((req) => (
                <li key={req.userId} className="rounded-[12px] border border-[var(--card-border)] p-4">
                  <p className="font-semibold text-[var(--text-primary)]">{req.fullName || req.email}</p>
                  <p className="text-xs text-[var(--text-muted)]">{req.email} · {req.phone || '—'}</p>
                  {req.empresa ? (
                    <p className="mt-2 text-sm text-[var(--text-primary)]">
                      {req.empresa.nomeFantasia || req.empresa.razaoSocial || req.empresa.nome} · CNPJ {formatCnpj(req.empresa.cnpj)}
                    </p>
                  ) : null}
                  {req.observacao ? (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{req.observacao}</p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={acting === req.userId}
                      onClick={() => handleApprove(req)}
                      className="inline-flex h-9 items-center gap-1 rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white"
                    >
                      <Check className="h-3.5 w-3.5" /> Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={acting === req.userId}
                      onClick={() => setRejectTarget(req)}
                      className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-red-200 px-3 text-xs font-semibold text-red-700"
                    >
                      <X className="h-3.5 w-3.5" /> Recusar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : history.length === 0 ? (
          <EmptyPanel title="Histórico vazio" />
        ) : (
          <ul className="divide-y divide-[var(--card-border)]">
            {history.map((entry) => (
              <li key={entry.id} className="py-3 text-sm">
                <p className="font-medium">{entry.fullName || entry.email}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {entry.eventType === 'approved' ? 'Aprovado' : 'Enviado'} · {entry.occurredAt ? new Date(entry.occurredAt).toLocaleString('pt-BR') : '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Recusar solicitação?"
        message={`Recusar o acesso de ${rejectTarget?.fullName || rejectTarget?.email}?`}
        confirmLabel="Recusar"
        onConfirm={handleReject}
        onCancel={() => setRejectTarget(null)}
        loading={acting === rejectTarget?.userId}
        destructive
      />
    </div>
  );
}
