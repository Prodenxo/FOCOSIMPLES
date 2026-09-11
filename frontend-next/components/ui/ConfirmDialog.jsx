'use client';

import { Loader2, X } from 'lucide-react';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false,
  destructive = false,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-[var(--shadow-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="confirm-dialog-title" className="text-base font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--canvas)]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {message ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex h-9 items-center rounded-[10px] border border-[var(--card-border)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex h-9 items-center gap-1 rounded-[10px] px-3 text-xs font-semibold text-white disabled:opacity-60 ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--accent)] hover:opacity-90'
            }`}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
