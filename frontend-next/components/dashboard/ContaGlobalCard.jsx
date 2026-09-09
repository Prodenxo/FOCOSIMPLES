import Link from 'next/link';
import { ChevronRight, Globe } from 'lucide-react';

export function ContaGlobalCard() {
  return (
    <Link
      href="/conta-global"
      className="group relative flex flex-col justify-between overflow-hidden rounded-[14px] bg-[var(--accent)] p-6 text-white shadow-[var(--shadow-card)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <div className="relative z-10">
        <div className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Globe className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          Conta global
          <ChevronRight className="h-4 w-4 opacity-80" aria-hidden />
        </div>
        <p className="max-w-[240px] text-sm leading-relaxed text-white/90">
          USD, EUR e outras moedas. Saldos separados do saldo em reais.
        </p>
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
          Acessar →
        </span>
      </div>

      <div
        className="pointer-events-none absolute -bottom-6 -right-6 h-36 w-36 rounded-full border-2 border-white/15"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-3 right-3 h-20 w-20 rounded-full border border-white/25 opacity-50"
        aria-hidden
      />
    </Link>
  );
}
