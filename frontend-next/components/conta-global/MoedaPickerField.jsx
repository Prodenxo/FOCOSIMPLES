'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import { POPULAR_MOEDAS } from '@/lib/contaMoedaGlobalTypes';
import { filterCurrencyOptions, mergeCurrencyCatalog } from '@/lib/frankfurterCurrenciesFallback';
import { getMoedaAccent } from '@/lib/moedaAccent';
import { MoedaFlag } from './MoedaFlag';

export function MoedaPickerField({ value, onChange, catalog, loading = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const merged = useMemo(() => mergeCurrencyCatalog(catalog), [catalog]);
  const code = (value || 'USD').trim().toUpperCase();
  const accent = getMoedaAccent(code);
  const options = useMemo(() => filterCurrencyOptions(merged, search), [merged, search]);
  const popularOptions = useMemo(
    () => POPULAR_MOEDAS.filter((c) => merged[c]).map((c) => ({ code: c, name: merged[c] })),
    [merged],
  );

  const selectCode = (next) => {
    onChange(next.toUpperCase());
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative">
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Moeda
      </label>
      <button
        type="button"
        disabled={loading || disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 py-2.5 text-left disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <MoedaFlag moeda={code} size={32} label={merged[code]} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[var(--text-primary)]">{code}</span>
          <span className="block truncate text-xs text-[var(--text-muted)]">{merged[code] || code}</span>
        </span>
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--text-muted)]" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
        )}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Fechar seleção de moeda"
            onClick={() => {
              setOpen(false);
              setSearch('');
            }}
          />
          <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 border-b border-[var(--card-border)] px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar moeda…"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                autoFocus
              />
              {search ? (
                <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca">
                  <X className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
              ) : null}
            </div>

            {!search.trim() && popularOptions.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto px-3 py-2 app-scrollbar">
                {popularOptions.map(({ code: c }) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => selectCode(c)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      color: getMoedaAccent(c),
                      backgroundColor: `${getMoedaAccent(c)}18`,
                      border: `1px solid ${getMoedaAccent(c)}33`,
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}

            <ul className="max-h-[220px] overflow-y-auto app-scrollbar" role="listbox">
              {options.map(({ code: c, name }) => (
                <li key={c}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c === code}
                    onClick={() => selectCode(c)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--accent-soft)] ${
                      c === code ? 'bg-[var(--accent-soft)]' : ''
                    }`}
                  >
                    <MoedaFlag moeda={c} size={28} label={name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[var(--text-primary)]">{c}</span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">{name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <span className="sr-only" aria-live="polite">
        Moeda selecionada: {code}, {merged[code]}
      </span>
      <span
        className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden"
        style={{ color: accent }}
        aria-hidden
      />
    </div>
  );
}
