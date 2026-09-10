'use client';

import { useEffect } from 'react';

function errorMessage(error) {
  if (!error) return 'Erro desconhecido';
  if (error instanceof Error && error.message) return error.message;
  const text = String(error);
  if (text === '[object Event]') {
    return 'Falha ao carregar parte da página (cache de desenvolvimento desatualizado).';
  }
  return text;
}

export default function AppRouteError({ error, reset }) {
  const message = errorMessage(error);
  const looksLikeDevCache =
    message.includes('cache de desenvolvimento')
    || /chunk|MODULE_NOT_FOUND|331\.js/i.test(message);

  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-[var(--text-primary)]">Algo deu errado</h1>
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
      {looksLikeDevCache ? (
        <p className="text-xs text-[var(--text-muted)]">
          No terminal do projeto: pare o servidor e rode{' '}
          <code className="rounded bg-[var(--canvas)] px-1">npm run restart</code>
          {' '}em <code className="rounded bg-[var(--canvas)] px-1">frontend-next</code>.
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-[14px] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Tentar de novo
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-[14px] border border-[var(--card-border)] px-5 py-2.5 text-sm font-semibold"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
}
