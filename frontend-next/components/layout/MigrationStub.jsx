import Link from 'next/link';

export function MigrationStub({ title, expoRoute }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-[var(--text-primary)]">{title}</h1>
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        Esta tela ainda está em migração para o novo frontend Next.js.
        Enquanto validamos a Visão geral, use o app Expo/web atual para funcionalidades completas.
      </p>
      {expoRoute ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Rota equivalente no Expo: <code className="rounded bg-[var(--canvas)] px-1">{expoRoute}</code>
        </p>
      ) : null}
      <Link
        href="/"
        className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Voltar à Visão geral
      </Link>
    </div>
  );
}
