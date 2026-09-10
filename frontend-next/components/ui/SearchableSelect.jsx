'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

/**
 * Select padrão — substitui `<select>` nativo (tema escuro, busca, acessibilidade).
 * Use `AppSelect` import de `@/components/ui/AppSelect` nos novos arquivos.
 *
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   options: Array<{ value: string, label: string }>,
 *   placeholder?: string,
 *   label?: string,
 *   disabled?: boolean,
 *   emptyHint?: string,
 *   compact?: boolean,
 *   searchable?: boolean,
 *   ariaLabel?: string,
 *   className?: string,
 *   variant?: 'default' | 'inline',
 * }} props
 */
export function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Selecione…',
  label,
  disabled = false,
  emptyHint = 'Nenhum resultado',
  compact = false,
  searchable,
  ariaLabel,
  className = '',
  variant = 'default',
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const isInline = variant === 'inline';
  const showSearch = searchable ?? options.length > 8;

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open && showSearch && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open, showSearch]);

  const pick = (next) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const heightClass = compact || isInline ? 'h-10' : 'h-11';
  const triggerClass = isInline
    ? `flex ${heightClass} w-full min-w-0 items-center justify-between gap-1 border-0 bg-transparent px-0 text-left text-sm font-medium shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50`
    : `flex ${heightClass} w-full items-center justify-between gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-left text-sm shadow-[var(--shadow-card)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50 ${
      open ? 'border-[var(--accent)]/40 ring-2 ring-[var(--accent)]/20' : ''
    }`;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && !isInline ? (
        <span className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel || label || placeholder}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={triggerClass}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className={`absolute z-[60] overflow-hidden rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)] ${
            isInline ? 'left-0 min-w-[200px] top-[calc(100%+4px)]' : 'left-0 right-0 top-[calc(100%+6px)]'
          }`}
        >
          {showSearch ? (
            <div className="border-b border-[var(--card-border)] p-2">
              <label className="flex h-9 items-center gap-2 rounded-[10px] border border-[var(--card-border)] bg-[var(--canvas)] px-2.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar…"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setOpen(false);
                      setQuery('');
                    }
                    if (e.key === 'Enter' && filtered[0]) {
                      e.preventDefault();
                      pick(filtered[0].value);
                    }
                  }}
                />
              </label>
            </div>
          ) : null}
          <ul className="app-scrollbar max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--text-muted)]">{emptyHint}</li>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <li key={opt.value || '__empty'} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(opt.value)}
                      className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--accent-soft)]/40 ${
                        active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="min-w-0 flex-1 break-words leading-snug">{opt.label}</span>
                      {active ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
