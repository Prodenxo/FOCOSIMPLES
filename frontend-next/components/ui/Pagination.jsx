'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, totalPages, total, pageSize, onPageChange }) {
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = [];
  const maxButtons = 5;
  let start = Math.max(1, page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--text-muted)]">
        Mostrando {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--text-muted)] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-label={`Página ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold ${
              p === page
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--card-border)] text-[var(--text-primary)] hover:bg-[var(--canvas)]'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Próxima página"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--text-muted)] disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
