'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, X } from 'lucide-react';

export function CategoriaFormModal({ open, categoria, onClose, onSubmit, saving, error }) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('saida');
  const [localError, setLocalError] = useState('');

  const isEdit = Boolean(categoria?.id);

  useEffect(() => {
    if (!open) return;
    setLocalError('');
    if (categoria) {
      setNome(categoria.nome);
      setTipo(categoria.tipo === 'entrada' ? 'entrada' : 'saida');
    } else {
      setNome('');
      setTipo('saida');
    }
  }, [open, categoria]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    const trimmed = nome.trim();
    if (!trimmed) {
      setLocalError('Informe o nome da categoria.');
      return;
    }
    try {
      await onSubmit({ nome: trimmed, tipo }, categoria?.id);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao salvar categoria.');
    }
  };

  const displayError = localError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="categoria-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)] sm:rounded-[16px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
              {isEdit ? 'Categoria' : 'Cadastro'}
            </p>
            <h2 id="categoria-modal-title" className="text-lg font-bold text-[var(--text-primary)]">
              {isEdit ? 'Editar categoria' : 'Nova categoria'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!saving) onClose();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)] text-[var(--text-muted)]"
            aria-label="Fechar formulário"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="cat-nome" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Nome
            </label>
            <input
              id="cat-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Alimentação"
              className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Tipo
            </span>
            <div className="inline-flex w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-1">
              <button
                type="button"
                onClick={() => setTipo('saida')}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-sm font-semibold ${
                  tipo === 'saida' ? 'bg-[var(--expense-soft)] text-red-500' : 'text-[var(--text-muted)]'
                }`}
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
                Saída
              </button>
              <button
                type="button"
                onClick={() => setTipo('entrada')}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-sm font-semibold ${
                  tipo === 'entrada' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)]'
                }`}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
                Entrada
              </button>
            </div>
          </div>

          {displayError ? (
            <p className="rounded-[10px] bg-red-500/10 px-3 py-2 text-sm text-red-500" role="alert">
              {displayError}
            </p>
          ) : null}
        </div>

        <div className="border-t border-[var(--card-border)] px-5 py-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Salvando…
              </>
            ) : (
              'Salvar'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
