'use client';

import { useId } from 'react';

/** Ilustração discreta do painel de detalhes — documento com círculos verdes suaves. */
export function TransactionDetailsIllustration() {
  const gradId = useId();

  return (
    <svg
      width="140"
      height="120"
      viewBox="0 0 140 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto opacity-90"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.12" />
        </radialGradient>
      </defs>

      <circle cx="98" cy="34" r="36" fill={`url(#${gradId})`} />
      <circle cx="98" cy="34" r="24" stroke="var(--accent-soft)" strokeWidth="1" fill="none" opacity="0.8" />
      <circle cx="98" cy="34" r="14" stroke="var(--accent-soft)" strokeWidth="1" fill="none" opacity="0.6" />

      <rect
        x="38"
        y="24"
        width="52"
        height="68"
        rx="8"
        fill="var(--card-bg)"
        stroke="var(--illustration-stroke)"
        strokeWidth="1.25"
      />
      <line x1="48" y1="40" x2="80" y2="40" stroke="var(--illustration-stroke)" strokeWidth="1.1" opacity="0.7" />
      <line x1="48" y1="50" x2="74" y2="50" stroke="var(--illustration-stroke)" strokeWidth="1.1" opacity="0.5" />
      <line x1="48" y1="60" x2="78" y2="60" stroke="var(--illustration-stroke)" strokeWidth="1.1" opacity="0.4" />
    </svg>
  );
}
