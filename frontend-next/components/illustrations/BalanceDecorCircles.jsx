'use client';

import { useId } from 'react';

/**
 * Ripple discreto no canto superior direito — anéis suaves, sem disco sólido no centro.
 */
export function BalanceDecorCircles() {
  const gradientId = useId();

  return (
    <svg
      className="pointer-events-none absolute -right-12 -top-12 h-[150px] w-[150px]"
      viewBox="0 0 150 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--decor-tone)" stopOpacity="0" />
          <stop offset="52%" stopColor="var(--decor-tone)" stopOpacity="0" />
          <stop offset="68%" stopColor="var(--decor-tone)" stopOpacity="0.07" />
          <stop offset="82%" stopColor="var(--decor-tone)" stopOpacity="0.05" />
          <stop offset="94%" stopColor="var(--decor-tone)" stopOpacity="0.09" />
          <stop offset="100%" stopColor="var(--decor-tone)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="75" cy="75" r="75" fill={`url(#${gradientId})`} />

      <circle
        cx="75"
        cy="75"
        r="58"
        stroke="var(--decor-tone)"
        strokeWidth="1"
        fill="none"
        opacity="0.12"
      />
      <circle
        cx="75"
        cy="75"
        r="38"
        stroke="var(--decor-tone)"
        strokeWidth="1"
        fill="none"
        opacity="0.10"
      />
      <circle
        cx="75"
        cy="75"
        r="20"
        stroke="var(--decor-tone)"
        strokeWidth="1"
        fill="none"
        opacity="0.08"
      />
    </svg>
  );
}
