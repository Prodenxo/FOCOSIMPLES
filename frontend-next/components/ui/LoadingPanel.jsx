import { Loader2 } from 'lucide-react';

export function LoadingPanel({ label = 'Carregando…' }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}
