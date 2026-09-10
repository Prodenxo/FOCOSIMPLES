'use client';

import { useId } from 'react';

/** Globo decorativo — canto do card de resumo (aproximação da referência). */
export function GlobalAccountSummaryDecor({ className = '' }) {
  const uid = useId().replace(/:/g, '');
  const gradId = `gg-${uid}`;

  return (
    <svg
      width="140"
      height="120"
      viewBox="0 0 140 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="78" cy="58" r="52" fill={`url(#${gradId})`} />
      <circle cx="78" cy="58" r="38" stroke="var(--accent-soft)" strokeWidth="1.2" fill="none" opacity="0.55" />
      <circle cx="78" cy="58" r="26" stroke="var(--accent-soft)" strokeWidth="1" fill="none" opacity="0.4" />
      <circle cx="78" cy="58" r="34" stroke="var(--accent)" strokeWidth="1.25" fill="none" opacity="0.35" />
      <ellipse cx="78" cy="58" rx="34" ry="12" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.3" />
      <ellipse cx="78" cy="58" rx="34" ry="22" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.22" />
      <line x1="44" y1="58" x2="112" y2="58" stroke="var(--accent)" strokeWidth="1" opacity="0.28" />
      <path d="M78 24 C 62 36 62 80 78 92 C 94 80 94 36 78 24 Z" stroke="var(--accent)" strokeWidth="1" fill="none" opacity="0.28" />
    </svg>
  );
}
