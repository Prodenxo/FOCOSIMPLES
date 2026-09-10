'use client';

import { AppSelect } from '@/components/ui/AppSelect';

/**
 * Filtro compacto (barra de ferramentas) — usa o mesmo AppSelect do sistema.
 */
export function FilterSelect({ label, icon: Icon, value, onChange, options, className = '' }) {
  return (
    <div
      className={`inline-flex h-10 max-w-full items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs ${className}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden /> : null}
      {label ? <span className="shrink-0 text-[var(--text-muted)]">{label}:</span> : null}
      <AppSelect
        variant="inline"
        value={value}
        onChange={onChange}
        options={options}
        searchable={options.length > 8}
        className="min-w-[88px] flex-1"
      />
    </div>
  );
}
