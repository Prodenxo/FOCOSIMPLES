'use client';

import { useId } from 'react';

/** Círculos concêntricos verdes suaves — cartão Saldo do período. */
export function PeriodBalanceDecor() {
  const gradId = useId();

  return (
    <svg
      className="pointer-events-none absolute -right-8 -top-8 h-[130px] w-[130px]"
      viewBox="0 0 130 130"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="55%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="72%" stopColor="var(--accent)" stopOpacity="0.08" />
          <stop offset="88%" stopColor="var(--accent)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="65" cy="65" r="65" fill={`url(#${gradId})`} />
      <circle cx="65" cy="65" r="48" stroke="var(--accent-soft)" strokeWidth="1" fill="none" opacity="0.55" />
      <circle cx="65" cy="65" r="30" stroke="var(--accent-soft)" strokeWidth="1" fill="none" opacity="0.45" />
    </svg>
  );
}
