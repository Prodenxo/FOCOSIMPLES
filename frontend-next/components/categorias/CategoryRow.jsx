'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { formatBrl } from '@/lib/format';
import { getCategoryIconComponent } from '@/lib/categoryIcons';
import { getCategorySliceColorForId } from '@/lib/categoryColors';

function formatTxDate(iso) {
  if (!iso) return '';
  const part = String(iso).split('T')[0];
  const [y, m, d] = part.split('-');
  if (d && m) return `${d}/${m}`;
  return part;
}

export function CategoryRow({
  row,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  hideActions = false,
  dimmed = false,
}) {
  const Icon = getCategoryIconComponent(row.nome);
  const color = getCategorySliceColorForId(row.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <div className={dimmed ? 'opacity-70' : ''}>
      <div className="flex items-center gap-2 border-b border-[var(--card-border)] py-3 last:border-b-0">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--canvas)]"
          aria-expanded={expanded}
          aria-label={expanded ? 'Recolher categoria' : 'Expandir categoria'}
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            aria-hidden
          />
        </button>

        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border"
          style={{
            backgroundColor: `${color}18`,
            borderColor: `${color}44`,
            color,
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>

        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
            {row.nome}
          </span>
        </button>

        <span className="tabular-nums shrink-0 text-sm font-bold text-[var(--text-primary)]">
          {formatBrl(row.amount)}
        </span>

        {!hideActions ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--canvas)]"
              aria-label={`Editar ${row.nome}`}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--canvas)]"
                aria-label={`Mais ações para ${row.nome}`}
                aria-expanded={menuOpen}
              >
                <MoreVertical className="h-4 w-4" aria-hidden />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] overflow-hidden rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] py-1 shadow-[var(--shadow-card)]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-[var(--canvas)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Excluir
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-b border-[var(--card-border)] pb-3 pl-12 pr-2">
          {row.transactions.length > 0 ? (
            <ul className="space-y-2">
              {row.transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-[var(--text-muted)]">
                    {String(tx.obs || '').trim() || formatTxDate(tx.data)}
                  </span>
                  <span className="tabular-nums shrink-0 font-semibold text-[var(--text-primary)]">
                    {formatBrl(tx.valor)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-[var(--text-muted)]">Nenhum lançamento neste mês</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
