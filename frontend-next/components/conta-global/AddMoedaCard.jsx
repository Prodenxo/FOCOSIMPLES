'use client';

import { Plus } from 'lucide-react';

export function AddMoedaCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-[14px] border-2 border-dashed border-[var(--accent)]/35 bg-[var(--accent-soft)]/40 px-4 py-6 text-[var(--accent)] transition hover:border-[var(--accent)]/55 hover:bg-[var(--accent-soft)]/70"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/25">
        <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
      <span className="text-sm font-semibold">Adicionar moeda</span>
    </button>
  );
}
