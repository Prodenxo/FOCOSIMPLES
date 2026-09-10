'use client';

import { useState } from 'react';
import { Hourglass, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';

export function PendingApprovalScreen() {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <Hourglass className="h-12 w-12" strokeWidth={1.5} aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-bold text-[var(--text-primary)]">Solicitação em análise</h1>
      <p className="mt-3 max-w-md text-sm text-[var(--text-muted)]">
        Recebemos seu cadastro e a equipe está analisando seu acesso. Assim que for aprovado, você poderá usar o sistema normalmente.
      </p>
      <button
        type="button"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
          }
        }}
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-[14px] border border-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent)] disabled:opacity-60"
      >
        {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Sair
      </button>
    </div>
  );
}
