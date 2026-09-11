'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { MEI_PUBLIC_PACKAGES } from '@/lib/meiBillingPricing';
import { createSelfServeMeiCheckout, fetchMeiBillingStatus } from '@/lib/billingApi';
import { LoadingPanel } from '@/components/ui/LoadingPanel';

const formatBrl = (n) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

export function MeiPricingPlans() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut, user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [packages, setPackages] = useState(MEI_PUBLIC_PACKAGES);
  const [loadingSlots, setLoadingSlots] = useState(null);
  const [message, setMessage] = useState('');

  const refreshGate = useCallback(async () => {
    setChecking(true);
    try {
      const status = await fetchMeiBillingStatus();
      if (status.packages?.length) setPackages(status.packages);
      if (!status.required) {
        router.replace('/');
        return;
      }
    } catch {
      /* tabela local */
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    void refreshGate();
  }, [refreshGate]);

  useEffect(() => {
    const stripe = searchParams.get('stripe_mei');
    if (stripe === 'success') {
      setMessage('Pagamento recebido! Liberando acesso…');
      const t = setTimeout(() => void refreshGate(), 1500);
      return () => clearTimeout(t);
    }
    if (stripe === 'cancel') {
      setMessage('Checkout cancelado.');
    }
    return undefined;
  }, [searchParams, refreshGate]);

  const handleSelect = async (pack) => {
    setLoadingSlots(pack.meiSlots);
    setMessage('');
    try {
      const data = await createSelfServeMeiCheckout(pack.meiSlots);
      if (!data.checkoutUrl) throw new Error('Checkout sem URL');
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Não foi possível abrir o checkout.');
    } finally {
      setLoadingSlots(null);
    }
  };

  if (checking) {
    return <LoadingPanel label="Carregando planos…" />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Planos MEI</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Escolha quantos CNPJs MEI sua empresa pode usar.
          </p>
          {user?.email ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">{user.email}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="text-sm text-[var(--text-muted)] underline"
          onClick={() => void signOut().then(() => router.replace('/login'))}
        >
          Sair
        </button>
      </div>

      {message ? <p className="text-sm text-[var(--text-primary)]">{message}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {packages.map((pack) => (
          <div
            key={pack.meiSlots}
            className={`rounded-2xl border p-5 ${
              pack.featured
                ? 'border-[var(--accent)] bg-[var(--card-bg)] shadow-md'
                : 'border-[var(--card-border)] bg-[var(--card-bg)]'
            }`}
          >
            {pack.badge ? (
              <span className="text-xs font-bold uppercase text-[var(--accent)]">{pack.badge}</span>
            ) : null}
            <p className="mt-1 text-lg font-bold">{pack.label}</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{formatBrl(pack.total)}/mês</p>
            <p className="text-xs text-[var(--text-muted)]">
              {formatBrl(pack.unit)} por CNPJ
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={loadingSlots === pack.meiSlots}
              onClick={() => void handleSelect(pack)}
            >
              {loadingSlots === pack.meiSlots ? 'Abrindo…' : 'Assinar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
