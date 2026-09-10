'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeProvider';

const OPTIONS = [
  { id: 'light', label: 'Claro', Icon: Sun },
  { id: 'system', label: 'Automático', Icon: Monitor },
  { id: 'dark', label: 'Escuro', Icon: Moon },
];

export function ThemeAppearancePicker() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ id, label, Icon }) => {
        const selected = preference === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setPreference(id)}
            className={`relative flex flex-col items-center gap-2 rounded-[12px] border px-2 py-3 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              selected
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--card-border)] bg-[var(--canvas)] text-[var(--text-muted)] hover:border-[var(--accent)]/40'
            }`}
            aria-pressed={selected}
          >
            <span
              className={`flex h-12 w-full items-center justify-center rounded-[8px] border ${
                id === 'dark'
                  ? 'border-slate-700 bg-slate-900'
                  : id === 'system'
                    ? 'border-[var(--card-border)] bg-gradient-to-r from-white to-slate-900'
                    : 'border-[var(--card-border)] bg-white'
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  id === 'dark' ? 'text-white' : id === 'light' ? 'text-slate-600' : 'text-[var(--accent)]'
                }`}
                aria-hidden
              />
            </span>
            {label}
            {selected ? (
              <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
