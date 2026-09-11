'use client';

import { LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';

export function ImpersonationBanner() {
  const { isImpersonating, stopImpersonating, displayName } = useAuth();
  if (!isImpersonating) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/40 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
      <p>
        Você está acessando como <strong>{displayName || 'outro usuário'}</strong>.
      </p>
      <button
        type="button"
        onClick={() => stopImpersonating()}
        className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-amber-400/60 bg-white px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-50"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        Voltar ao admin
      </button>
    </div>
  );
}
