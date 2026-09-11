'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchActivationProgress, isActivationCoreComplete } from '@/lib/activationApi';
import { activationRouteToHref } from '@/lib/activationStepRoutes';
import { isEmpresaCnpjOnboardingRequired } from '@/lib/empresaCnpjGate';
import { setSessionActivationSkipped } from '@/lib/activationSession';
import { LoadingPanel } from '@/components/ui/LoadingPanel';
import { useAuth } from '@/context/AuthProvider';

export function ActivationSetup() {
  const router = useRouter();
  const { role } = useAuth();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    if (await isEmpresaCnpjOnboardingRequired(role)) {
      router.replace('/empresa-cnpj');
      return;
    }
    const data = await fetchActivationProgress();
    setPayload(data);
    setLoading(false);
    if (!data || isActivationCoreComplete(data)) {
      router.replace('/');
    }
  }, [router, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const steps = useMemo(
    () => (payload?.steps ?? []).filter((s) => activationRouteToHref(s.route)),
    [payload?.steps],
  );

  const progress = payload?.progress;

  if (loading && !payload) {
    return <LoadingPanel label="Carregando ativação…" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Primeiros passos</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Ative sua conta</h1>
        {progress ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {progress.completed}/{progress.totalRequired} passos essenciais · {progress.percent}%
          </p>
        ) : null}
      </div>

      <ul className="space-y-3">
        {steps.map((step) => {
          const href = activationRouteToHref(step.route);
          const done = step.status === 'completed';
          return (
            <li
              key={step.id}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{step.title}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{step.description}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {done ? 'Feito' : step.required ? 'Obrigatório' : 'Opcional'}
                </span>
              </div>
              {!done && href ? (
                <Link
                  href={href}
                  className="mt-3 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline"
                >
                  Ir para esta etapa →
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="text-sm text-[var(--text-muted)] underline"
        onClick={() => {
          setSessionActivationSkipped(true);
          router.replace('/');
        }}
      >
        Pular por agora
      </button>
    </div>
  );
}
