'use client';

import { useMemo, useState } from 'react';
import { PenLine, Search, XCircle } from 'lucide-react';
import { CUSTOM_BANK_ID, filterBanksByQuery } from '@/lib/bankCatalog';
import { BankCatalogIcon } from './BankIcon';

export function BankPickerGrid({ selectedBankId, onSelectBank, onSelectCustom }) {
  const [query, setQuery] = useState('');
  const banks = useMemo(() => filterBanksByQuery(query), [query]);
  const isCustom = selectedBankId === CUSTOM_BANK_ID;

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
        Escolha o banco
      </p>

      <div className="flex items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar banco…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none"
          autoCapitalize="off"
          autoCorrect="off"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpar busca"
            className="text-[var(--text-muted)]"
          >
            <XCircle className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="app-scrollbar max-h-[280px] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {banks.map((bank) => {
            const active = selectedBankId === bank.id;
            return (
              <button
                key={bank.id}
                type="button"
                onClick={() => onSelectBank(bank)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-2 rounded-[12px] border px-2 py-3 text-center transition-colors ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--card-border)] bg-[var(--canvas)] hover:border-[var(--accent)]/30'
                }`}
              >
                <BankCatalogIcon bank={bank} size={40} />
                <span
                  className={`line-clamp-2 text-xs font-medium ${
                    active ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {bank.nome}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onSelectCustom}
        aria-pressed={isCustom}
        className={`flex w-full items-center gap-3 rounded-[12px] border px-3 py-3 text-left ${
          isCustom
            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
            : 'border-[var(--card-border)] bg-[var(--canvas)]'
        }`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card-bg)]">
          <PenLine className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[var(--text-primary)]">Outra conta</span>
          <span className="block text-xs text-[var(--text-muted)]">Carteira, cofre ou conta personalizada</span>
        </span>
      </button>
    </div>
  );
}
