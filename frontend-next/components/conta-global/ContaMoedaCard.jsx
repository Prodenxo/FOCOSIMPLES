'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatBrl, formatMoedaValorAmount, formatRateToBrl } from '@/lib/moedaFormat';
import { getMoedaAccent } from '@/lib/moedaAccent';
import { getMoedaNomePt } from '@/lib/moedaNomesPt';
import { MoedaFlag } from './MoedaFlag';

export function ContaMoedaCard({
  conta,
  rate,
  ratesLoading,
  onEdit,
  onDelete,
}) {
  const accent = getMoedaAccent(conta.moeda);
  const moedaLabel = conta.nome || getMoedaNomePt(conta.moeda);
  const brl = rate != null ? conta.valor * rate : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <Card className="relative flex flex-col overflow-hidden p-0">
      <div className="relative px-4 pb-3 pt-4" style={{ backgroundColor: `${accent}12` }}>
        <div className="flex items-start gap-3">
          <MoedaFlag moeda={conta.moeda} size={40} label={moedaLabel} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-wide text-[var(--text-primary)]">{conta.moeda}</p>
            <p className="truncate text-xs text-[var(--text-muted)]" title={moedaLabel}>
              {moedaLabel}
            </p>
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--canvas)]"
              aria-label={`Ações para ${conta.moeda}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <MoreVertical className="h-4 w-4" aria-hidden />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] py-1 shadow-[var(--shadow-card)]"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
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
                  role="menuitem"
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
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="flex flex-1 flex-col px-4 py-4 text-left"
      >
        <p className="tabular-nums text-2xl font-bold leading-tight text-[var(--text-primary)]">
          {formatMoedaValorAmount(conta.valor, conta.moeda)}
        </p>
        {ratesLoading && rate == null ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">Carregando cotação…</p>
        ) : rate != null ? (
          <>
            <p className="tabular-nums mt-1 text-sm font-semibold text-[var(--text-primary)]">
              ≈ {formatBrl(brl ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {formatRateToBrl(conta.moeda, rate)}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">Cotação indisponível</p>
        )}
      </button>
    </Card>
  );
}
