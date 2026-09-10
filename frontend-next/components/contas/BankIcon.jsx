'use client';

import { useMemo } from 'react';
import {
  bankInitials,
  findBankById,
  findBankByNome,
  resolveLibraryNome,
} from '@/lib/bankCatalog';
import { renderBancoSvg } from '@/lib/bancoBrasilSvg';

function InitialsFallback({ label, accent, size }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: accent,
        fontSize: Math.max(10, size * 0.34),
      }}
      aria-hidden="true"
    >
      {bankInitials(label)}
    </span>
  );
}

function BancoSvgFromLibrary({ libraryNome, nome, cor, size, formato = 'circulo' }) {
  const xml = useMemo(
    () => renderBancoSvg({ nome: libraryNome, formato, tamanho: size }),
    [libraryNome, formato, size],
  );

  if (!xml) {
    return <InitialsFallback label={nome} accent={cor} size={size} />;
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center leading-none"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: xml }}
      aria-hidden="true"
    />
  );
}

export function BankIcon({
  instituicaoId,
  nome = '',
  cor,
  size = 36,
  formato = 'circulo',
}) {
  const bank = useMemo(
    () => findBankById(instituicaoId) ?? findBankByNome(nome),
    [instituicaoId, nome],
  );
  const libraryNome = resolveLibraryNome(bank);
  const accent = bank?.cor ?? cor ?? '#64748B';
  const label = bank?.nome ?? nome ?? 'Conta';

  if (!libraryNome) {
    return <InitialsFallback label={label} accent={accent} size={size} />;
  }

  return (
    <BancoSvgFromLibrary
      libraryNome={libraryNome}
      nome={label}
      cor={accent}
      size={size}
      formato={formato}
    />
  );
}

export function BankCatalogIcon({ bank, size = 40 }) {
  const libraryNome = resolveLibraryNome(bank);
  if (!libraryNome) {
    return <InitialsFallback label={bank.nome} accent={bank.cor} size={size} />;
  }
  return (
    <BancoSvgFromLibrary
      libraryNome={libraryNome}
      nome={bank.nome}
      cor={bank.cor}
      size={size}
    />
  );
}
