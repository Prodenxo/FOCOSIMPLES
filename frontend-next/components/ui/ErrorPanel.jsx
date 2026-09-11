import { AlertCircle } from 'lucide-react';

export function ErrorPanel({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/30"
    >
      <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" aria-hidden />
      <p className="max-w-md text-sm text-red-800 dark:text-red-200">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}
