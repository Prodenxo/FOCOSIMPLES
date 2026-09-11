'use client';

import { Loader2 } from 'lucide-react';

export function SettingsProfileField({
  label,
  value,
  onChange,
  onSave,
  saving = false,
  disabled = false,
  saveLabel = 'Salvar',
  savingLabel = 'Salvando…',
  hint,
  type = 'text',
  placeholder,
  isLast = false,
}) {
  return (
    <div className={`py-3 ${isLast ? '' : 'border-b border-[var(--card-border)]'}`}>
      <label className="mb-2 block text-xs font-medium text-[var(--text-muted)]">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 flex-1 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || saving}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
      {hint ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{hint}</p>
      ) : null}
    </div>
  );
}
