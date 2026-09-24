'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { confirmEmailChange } from '@/lib/profileApi';
import { BrandWordmark } from '@/components/brand/BrandLogo';

function ConfirmEmailContent() {
  const [status, setStatus] = useState('validating');
  const [message, setMessage] = useState('Confirmando seu novo e-mail…');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('invalid');
      setMessage('Link inválido. Peça a alteração de e-mail novamente nas configurações.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await confirmEmailChange(token);
        if (cancelled) return;
        setStatus('done');
        setMessage(
          result?.email
            ? `Pronto! Agora você entra no Foco Simples com ${result.email}.`
            : 'Pronto! Seu e-mail foi atualizado.',
        );
      } catch (err) {
        if (cancelled) return;
        setStatus('invalid');
        setMessage(
          err instanceof Error ? err.message : 'Não foi possível confirmar o novo e-mail.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B2030] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-[#15202b]">
        <BrandWordmark className="mx-auto mb-6 h-8" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Confirmar e-mail</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{message}</p>

        {status === 'validating' ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
          </div>
        ) : (
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[14px] border border-[var(--accent)] text-sm font-semibold text-[var(--accent)]"
          >
            Ir para login
          </Link>
        )}
      </div>
    </div>
  );
}

export default function ConfirmarEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Carregando…</div>}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
