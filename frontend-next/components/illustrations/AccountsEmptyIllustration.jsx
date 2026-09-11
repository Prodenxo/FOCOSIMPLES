'use client';

import { CreditCard, Wallet } from 'lucide-react';

/** Hero do estado vazio — ícone com contraste garantido (sem SVG artesanal). */
export function AccountsEmptyIllustration({ className = '' }) {
  return (
    <div
      className={`relative mx-auto flex h-[120px] w-[120px] items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full bg-[var(--accent)]/12" />
      <div className="absolute inset-4 rounded-full border border-[var(--accent)]/18" />

      <CreditCard
        className="absolute -left-1 top-2 h-12 w-12 -rotate-[14deg] text-[var(--accent)]/40"
        strokeWidth={1.5}
      />

      <div className="relative flex h-[76px] w-[76px] items-center justify-center rounded-[20px] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/25 shadow-[0_8px_24px_rgba(0,133,106,0.12)] dark:shadow-[0_8px_28px_rgba(0,168,132,0.18)]">
        <Wallet className="h-10 w-10 text-[var(--accent)]" strokeWidth={1.65} />
      </div>

      <span className="absolute right-0 top-3 h-2 w-2 rounded-full bg-[var(--accent)]/55" />
      <span className="absolute bottom-4 left-0 h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]/45" />
    </div>
  );
}
