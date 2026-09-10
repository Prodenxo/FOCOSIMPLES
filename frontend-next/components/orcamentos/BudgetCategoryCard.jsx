'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatBrl } from '@/lib/format';
import { getCategoryIconComponent } from '@/lib/categoryIcons';
import { getCategorySliceColorForId } from '@/lib/categoryColors';

const TONE_STYLES = {
  success: { bar: 'bg-[var(--accent)]', pill: 'bg-[var(--accent-soft)] text-[var(--accent)]', dot: 'bg-[var(--accent)]' },
  warning: { bar: 'bg-amber-500', pill: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  danger: { bar: 'bg-red-500', pill: 'bg-red-500/15 text-red-500', dot: 'bg-red-500' },
  neutral: { bar: 'bg-[var(--accent)]', pill: 'bg-[var(--canvas)] text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' },
  muted: { bar: 'bg-[var(--card-border)]', pill: 'bg-[var(--canvas)] text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' },
};

export function BudgetCategoryCard({ row, viewTipo, onEdit, onDelete }) {
  const Icon = getCategoryIconComponent(row.nome);
  const color = getCategorySliceColorForId(row.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const tone = TONE_STYLES[row.statusTone] || TONE_STYLES.neutral;
  const isEntrada = viewTipo === 'entrada';
  const orcadoLabel = isEntrada ? 'Meta' : 'Orçado';
  const realizadoLabel = isEntrada ? 'Recebido' : 'Realizado';
  const pctText = row.percentDisplay != null ? `${row.percentDisplay}%` : '—';

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-start gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
          style={{ backgroundColor: `${color}18`, borderColor: `${color}44`, color }}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{row.nome}</h3>
        </div>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--canvas)]"
            aria-label={`Mais ações para ${row.nome}`}
            aria-expanded={menuOpen}
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] py-1 shadow-[var(--shadow-card)]">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--canvas)]"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
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

      <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {orcadoLabel}
          </p>
          <p className="tabular-nums mt-0.5 font-semibold text-[var(--text-primary)]">
            {typeof row.orcado === 'number' ? formatBrl(row.orcado) : '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {realizadoLabel}
          </p>
          <p className="tabular-nums mt-0.5 font-semibold text-[var(--text-primary)]">
            {formatBrl(row.realizado)}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          {row.balanceLabel}
        </p>
        <p
          className={`tabular-nums mt-0.5 text-sm font-semibold ${
            row.statusTone === 'danger'
              ? 'text-red-500'
              : row.statusTone === 'success'
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-primary)]'
          }`}
        >
          {typeof row.balanceValue === 'number' ? formatBrl(row.balanceValue) : '—'}
        </p>
      </div>

      <div className="mt-auto">
        <div className="relative mb-2 h-2 overflow-hidden rounded-full bg-[var(--canvas)]">
          <div
            className={`h-full rounded-full transition-all ${tone.bar}`}
            style={{ width: `${row.barWidth}%` }}
          />
          {row.percentDisplay != null ? (
            <span
              className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.pill}`}
            >
              {pctText}
            </span>
          ) : null}
        </div>
        <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
          <span>
            {pctText} · {row.statusLabel}
          </span>
        </p>
      </div>
    </Card>
  );
}
