'use client';

import { useId } from 'react';

/** Aproximação da referência: carteira com cartões e círculos suaves. */
export function AccountsEmptyIllustration({ className = '' }) {
  const gradId = useId();

  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.16" />
        </radialGradient>
      </defs>

      <circle cx="148" cy="48" r="52" fill={`url(#${gradId})`} />
      <circle cx="148" cy="48" r="36" stroke="var(--accent-soft)" strokeWidth="1" fill="none" opacity="0.7" />
      <circle cx="148" cy="48" r="22" stroke="var(--accent-soft)" strokeWidth="1" fill="none" opacity="0.5" />

      <rect x="52" y="72" width="96" height="64" rx="10" fill="#0B2030" />
      <rect x="60" y="80" width="80" height="48" rx="6" fill="#15202b" />

      <rect x="68" y="56" width="72" height="44" rx="8" fill="var(--accent)" transform="rotate(-8 104 78)" />
      <rect x="76" y="48" width="72" height="44" rx="8" fill="#1e293b" transform="rotate(6 112 70)" />
      <circle cx="132" cy="58" r="5" fill="#94a3b8" opacity="0.8" transform="rotate(6 112 70)" />

      <circle cx="36" cy="118" r="3" fill="var(--accent)" opacity="0.35" />
      <circle cx="168" cy="120" r="4" fill="var(--accent)" opacity="0.25" />
    </svg>
  );
}
