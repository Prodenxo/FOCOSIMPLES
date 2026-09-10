'use client';

import { Pencil, Plus, Repeat, Trash2, X } from 'lucide-react';
import { formatBrl } from '@/lib/format';
import { normalizarTipo } from '@/lib/dashboardUtils';
import { RecorrenciaFormModal } from '@/components/recorrencias/RecorrenciaFormModal';

export function RecorrenciasPanel({
  open,
  onClose,
  recorrencias,
  loading,
  categories,
  onRefresh,
  onSaveRecorrencia,
  onDeleteRecorrencia,
  formOpen,
  setFormOpen,
  editing,
  setEditing,
  formSaving,
  formError,
}) {
  if (!open) return null;

  const confirmDelete = (r) => {
    const msg =
      'Excluir recorrência?\n\nOs lançamentos já gerados serão mantidos. As projeções futuras serão removidas.';
    if (!window.confirm(msg)) return;
    void onDeleteRecorrencia(r);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex justify-end bg-black/40"
        role="dialog"
        aria-modal="true"
        aria-label="Recorrências"
        onClick={onClose}
      >
        <div
          className="app-scrollbar flex h-full w-full max-w-md flex-col bg-[var(--card-bg)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 py-4">
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-[var(--accent)]" aria-hidden />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recorrências</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="rounded-full bg-[var(--accent)] p-2 text-white"
                aria-label="Nova recorrência"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--canvas)]" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <p className="border-b border-[var(--card-border)] px-5 py-3 text-sm text-[var(--text-muted)]">
            No dia escolhido de cada mês, um lançamento aparece em Transações (projeção até você confirmar ou editar).
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {loading && recorrencias.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
            ) : recorrencias.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhuma recorrência. Toque em + para criar.</p>
            ) : (
              <ul className="space-y-2">
                {recorrencias.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start gap-3 rounded-[14px] border border-[var(--card-border)] px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Dia {r.dia_do_mes} · {r.classificacao}
                        {!r.ativo ? ' (pausada)' : ''}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {normalizarTipo(r.tipo) === 'entrada' ? 'Entrada' : 'Saída'} · {formatBrl(r.valor)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(r);
                          setFormOpen(true);
                        }}
                        className="rounded-lg p-2 text-[var(--accent)] hover:bg-[var(--canvas)]"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDelete(r)}
                        className="rounded-lg p-2 text-red-500 hover:bg-[var(--canvas)]"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-[var(--card-border)] px-5 py-3">
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="text-sm font-semibold text-[var(--accent)]"
            >
              Atualizar lista
            </button>
          </div>
        </div>
      </div>

      <RecorrenciaFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        recorrencia={editing}
        categories={categories}
        saving={formSaving}
        error={formError}
        onSave={onSaveRecorrencia}
      />
    </>
  );
}
